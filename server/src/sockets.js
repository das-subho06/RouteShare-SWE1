const pool = require('./db');
const { randomUUID } = require('crypto');

// In-memory map instead of DB columns: userId -> socketId
const onlineDrivers = new Map();

// ---------------------------------------------------------------------------
// Join-request approval chain (new rider -> existing riders -> driver).
// Ephemeral like onlineDrivers above — a join request only needs to live for
// the few seconds it takes riders/driver to answer, so no DB table for it.
//
// joinRequestId -> {
//   rideId, requesterRiderId, requesterName, pickup, destination,
//   seatsRequested, status: 'pending_passengers' | 'waiting_driver',
//   awaitingRiderIds: string[],   // riders who haven't answered yet
// }
// ---------------------------------------------------------------------------
const joinRequests = new Map();

// Riders currently seated in a shared ride (accept_ride only inserts into
// ride_participants when ride_options includes 'shared_ride' — for a plain
// solo ride this comes back empty).
async function getActiveRiderIds(rideId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM ride_participants
     WHERE ride_id = $1 AND role = 'rider' AND status = 'active'`,
    [rideId]
  );
  return rows.map((r) => String(r.user_id));
}

// Ride + vehicle info needed to show/act on a join request. Only rides that
// are actually underway can accept a new rider.
async function getRideForJoinRequest(rideId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.driver_id, r.price, r.ride_code,
            dp.vehicle_model, dp.vehicle_number, dp.seats AS car_seats
     FROM rides r
     JOIN driver_profiles dp ON dp.user_id = r.driver_id
     WHERE r.id = $1
       AND r.status IN ('accepted', 'driver_arrived', 'in_progress')`,
    [rideId]
  );
  return rows[0] || null;
}

function initSockets(io) {
  // A shared ride's rider_id column only ever points at whoever made the
  // ORIGINAL request — ride_started / ride_cancelled / ride_completed used
  // to notify just that one room, which silently left any rider who joined
  // later (via the join-request flow below) without pickup/cancel/complete
  // updates. This fans the same payload out to every active participant,
  // falling back to the single known riderId for a plain non-shared ride.
  async function notifyRideRiders(rideId, fallbackRiderId, event, payload) {
    let riderIds = [];
    try {
      riderIds = await getActiveRiderIds(rideId);
    } catch (err) {
      console.error(`notifyRideRiders: failed to load participants for ride ${rideId}`, err);
    }
    const targets = riderIds.length > 0 ? riderIds : [String(fallbackRiderId)].filter(Boolean);
    targets.forEach((id) => io.to(`rider_${id}`).emit(event, payload));
  }

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Driver goes online — client emits this right after driverDashboard mounts
    socket.on('driver_online', ({ userId }) => {
      console.log("DRIVER ONLINE:", userId);
      onlineDrivers.set(String(userId), socket.id);
      console.log("ONLINE DRIVERS MAP:", [...onlineDrivers.entries()]);
      socket.data.userId = userId;
      socket.data.role = 'driver';
    });

    // Rider confirms a ride in ChooseRide.tsx
    socket.on('request_ride', async (payload) => {
      console.log('📥 request_ride received:', payload);
      const {
        riderId,
        riderName,
        pickup,        // { label, latitude, longitude }
        destination,   // { label, latitude, longitude }
        distanceKm,
        durationMinutes,
        price, carSeats,
        rideName,       // e.g. "Go Mini"
        riderCount,     // how many people — must match driver.seats
      paymentMethod = 'cash',   // NEW, default matches column default
  rideOptions = [], 
  excludeDriverId = null,   // NEW — set when this is an auto-retry after a driver cancelled
      } = payload;
      if (!pickup?.label || !destination?.label || !pickup?.latitude || !destination?.latitude) {
    console.warn('⚠️ rejected malformed request_ride payload:', payload);
    socket.emit('request_error', { message: 'Missing pickup or destination — please try again.' });
    return;
  }
      const rideCode = `ROUTE${Math.floor(10 + Math.random() * 90)}`;

      try {
        // NOTE: this used to be a SELECT for an existing 'requested' row,
        // and only INSERT if none was found. That's a classic
        // check-then-act race: if request_ride fires twice in quick
        // succession (double emit from the client, a flaky connection
        // retry, the same rider open in two browser tabs both reacting to
        // the same 'ride_cancelled' broadcast, etc.) both calls can run
        // the SELECT before either INSERT commits — both see zero rows, so
        // both insert, and you get two DB rows for one logical ride.
        //
        // Fixed by making the insert itself atomic via a partial unique
        // index scoped to the RIDER (not the route/class) + ON CONFLICT DO
        // NOTHING — a rider can only ever have one 'requested' row at a
        // time, no matter how many sockets/tabs/retries try to create one.
        // This requires running, once, against your rides table:
        //
        //   DROP INDEX IF EXISTS uniq_open_ride_request;
        //   CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_ride_per_rider
        //     ON rides (rider_id)
        //     WHERE status = 'requested';
        //
        const onlineIds = Array.from(onlineDrivers.keys());
        console.log('🟢 currently online drivers:', onlineIds);

        if (onlineIds.length === 0) {
          console.log('⚠️ no drivers online — nothing to send');
          // Still persist the request so it shows up in ride history as
          // "no driver found" instead of silently vanishing.
          await pool.query(
  `INSERT INTO rides
    (rider_id, ride_class, pickup_label, pickup_lat, pickup_lng,
     destination_label, destination_lat, destination_lng,
     distance_km, duration_minutes, price, seats_requested, ride_code, status,
     ride_options, payment_method)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'no_driver',$14,$15)`,
  [
    riderId, rideName, pickup.label, pickup.latitude, pickup.longitude,
    destination.label, destination.latitude, destination.longitude,
    distanceKm, durationMinutes, price, riderCount, rideCode,
    rideOptions, paymentMethod,
  ]
);
          socket.emit('request_sent', { requestId: null, notifiedDrivers: 0 });
          return;
        }

        // Only drivers currently online AND whose car fits the rider count
        const matches = await pool.query(
          `SELECT user_id, seats FROM driver_profiles
           WHERE seats = $1 AND user_id = ANY($2::int[])`,
          [carSeats, onlineIds.map(Number)]
        );
        // Never re-offer this trip to the driver who just cancelled it —
        // without this, a solo/small pool of online drivers means the
        // cancelling driver immediately sees their own just-cancelled ride
        // come right back as a "new" request.
        const eligibleDrivers = excludeDriverId
          ? matches.rows.filter((d) => String(d.user_id) !== String(excludeDriverId))
          : matches.rows;
        console.log('🎯 matched drivers:', matches.rows, '→ eligible after exclusion:', eligibleDrivers);

        // The row is the single source of truth for this ride from here on —
        // its serial id becomes the requestId used everywhere else.
        // ON CONFLICT DO NOTHING relies on the partial unique index above:
        // if a duplicate emit lands here concurrently, only one INSERT can
        // ever win the row — the other returns 0 rows instead of creating
        // a second, orphaned "requested" ride.
        // Persist the exclusion on the row itself (not just in-memory for
        // this one emit) — otherwise a driver's REST resync of
        // /rides/pending/:driverId (fired on every socket reconnect) has no
        // idea this driver was excluded and will hand the ride straight
        // back to them.
        const excludedIds = excludeDriverId ? [Number(excludeDriverId)] : [];

        const inserted = await pool.query(
  `INSERT INTO rides
    (rider_id, ride_class, pickup_label, pickup_lat, pickup_lng,
     destination_label, destination_lat, destination_lng,
     distance_km, duration_minutes, price, seats_requested, ride_code, status,
     ride_options, payment_method, excluded_driver_ids)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'requested',$14,$15,$16)
   ON CONFLICT (rider_id)
     WHERE status = 'requested'
   DO NOTHING
   RETURNING id`,
  [
    riderId, rideName, pickup.label, pickup.latitude, pickup.longitude,
    destination.label, destination.latitude, destination.longitude,
    distanceKm, durationMinutes, price, riderCount, rideCode,
    rideOptions, paymentMethod, excludedIds,
  ]
);

        let requestId;
        let isNewRow = true;
        if (inserted.rowCount > 0) {
          requestId = String(inserted.rows[0].id);
        } else {
          // Another tab/socket for this same rider already won the row —
          // reuse whatever open request currently exists for them instead
          // of creating a duplicate, and don't re-notify drivers below.
          isNewRow = false;
          const existing = await pool.query(
            `SELECT id FROM rides WHERE rider_id = $1 AND status = 'requested'
               ORDER BY requested_at DESC LIMIT 1`,
            [riderId]
          );
          requestId = String(existing.rows[0]?.id ?? '');
          console.log('⚠️ duplicate request_ride ignored (rider already has an open request), reusing existing row', requestId);
        }

        if (isNewRow) {
          eligibleDrivers.forEach((driver) => {
            const socketId = onlineDrivers.get(String(driver.user_id));
            if (!socketId) return;
            io.to(socketId).emit('incoming_request', {
              id: requestId,
              riderId,
              riderName,
              pickup: pickup.label,
              destination: destination.label,
              pickupCoords: { latitude: pickup.latitude, longitude: pickup.longitude },
              destinationCoords: { latitude: destination.latitude, longitude: destination.longitude },
              distance: `${distanceKm} km`,
              time: `${durationMinutes} min`,
              price,
              carType: rideName,
              requestedSeats: riderCount,
              rideCode,
            });
          });
        }

        socket.emit('request_sent', { requestId, notifiedDrivers: isNewRow ? eligibleDrivers.length : onlineDrivers.size });
      } catch (err) {
        console.error('request_ride error:', err);
        socket.emit('request_error', { message: 'Could not send ride request.' });
      }
    });

// Driver accepts — notify the rider directly
socket.on(
  'accept_ride',
  async ({ requestId, riderId, driverUserId, driver: clientDriver }, callback) => {
    const numDriverId = Number(driverUserId);
    const numRequestId = Number(requestId);

    if (!numDriverId || Number.isNaN(numDriverId)) {
      console.warn(
        '⚠️ accept_ride called with invalid driverUserId:',
        driverUserId
      );

      return callback?.({
        ok: false,
        error: 'Missing driver id — please refresh and try again.',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ---------------------------------------------------------
      // 1. Accept the original ride
      // ---------------------------------------------------------
      //
      // We also return the actual rider_id, seats_requested and
      // ride_options from the database instead of trusting the
      // values coming from the frontend.
      //
      const updated = await client.query(
        `UPDATE rides
         SET driver_id = $1,
             status = 'accepted',
             accepted_at = now()
         WHERE id = $2
           AND status = 'requested'
         RETURNING
             id,
             rider_id,
             driver_id,
             seats_requested,
             ride_code,
             ride_options`,
        [numDriverId, numRequestId]
      );

      if (updated.rowCount === 0) {
        await client.query('ROLLBACK');

        console.log(
          `⚠️ ride ${requestId} already taken — ignoring accept from driver ${numDriverId}`
        );

        socket.emit('ride_unavailable', {
          requestId,
        });

        return callback?.({
          ok: false,
          error: 'This ride was already taken.',
        });
      }

      const ride = updated.rows[0];

      // ---------------------------------------------------------
      // 2. Check whether this is a shared ride
      // ---------------------------------------------------------

      const isSharedRide =
        Array.isArray(ride.ride_options) &&
        ride.ride_options.includes('shared_ride');

      if (isSharedRide) {
        // -------------------------------------------------------
        // 3. Add the DRIVER to ride_participants
        // -------------------------------------------------------

        await client.query(
          `INSERT INTO ride_participants
           (
             ride_id,
             user_id,
             role,
             seats_requested,
             status
           )
           VALUES ($1, $2, 'driver', 1, 'active')
           ON CONFLICT (ride_id, user_id)
           DO UPDATE SET
             role = 'driver',
             seats_requested = 1,
             status = 'active'`,
          [
            ride.id,
            numDriverId,
          ]
        );

        // -------------------------------------------------------
        // 4. Add the ORIGINAL RIDER to ride_participants
        // -------------------------------------------------------

        await client.query(
          `INSERT INTO ride_participants
           (
             ride_id,
             user_id,
             role,
             seats_requested,
             status
           )
           VALUES ($1, $2, 'rider', $3, 'active')
           ON CONFLICT (ride_id, user_id)
           DO UPDATE SET
             role = 'rider',
             seats_requested = EXCLUDED.seats_requested,
             status = 'active'`,
          [
            ride.id,
            ride.rider_id,
            ride.seats_requested || 1,
          ]
        );

        console.log(
          `👥 Shared ride participants created for ride ${ride.id}:`,
          `driver=${numDriverId},`,
          `rider=${ride.rider_id},`,
          `seats=${ride.seats_requested || 1}`
        );
      }

      // ---------------------------------------------------------
      // 5. Everything succeeded
      // ---------------------------------------------------------

      await client.query('COMMIT');

      // ---------------------------------------------------------
      // 6. Get driver information
      // ---------------------------------------------------------

      const driverInfo = await pool.query(
        `SELECT
           dp.*,
           u.name
         FROM driver_profiles dp
         JOIN users u
           ON u.id = dp.user_id
         WHERE dp.user_id = $1`,
        [numDriverId]
      );

      const driver = driverInfo.rows[0] || clientDriver;

      // ---------------------------------------------------------
      // 7. Tell the rider that the ride was accepted
      // ---------------------------------------------------------

      io.to(`rider_${ride.rider_id}`).emit('ride_accepted', {
        requestId,
        driver,
        rideCode: ride.ride_code,
      });

      // ---------------------------------------------------------
      // 8. Tell other online drivers that this request is taken
      // ---------------------------------------------------------

      onlineDrivers.forEach((socketId, uid) => {
        if (String(uid) !== String(numDriverId)) {
          io.to(socketId).emit('request_taken', {
            id: requestId,
          });
        }
      });

      callback?.({
        ok: true,
        rideCode: ride.ride_code,
      });

    } catch (err) {
      await client.query('ROLLBACK');

      console.error('accept_ride error:', err);

      callback?.({
        ok: false,
        error: 'Server error.',
      });

    } finally {
      client.release();
    }
  }
);

    // Driver taps "Reached Pickup Location"
    socket.on('ride_reached_pickup', async ({ requestId, driverUserId }, callback) => {
  try {
    const updated = await pool.query(
      `UPDATE rides SET status = 'driver_arrived', pickup_reached_at = now()
       WHERE id = $1 AND driver_id = $2
       RETURNING id`,
      [requestId, driverUserId]
    );
    if (updated.rowCount === 0) {
       const row = await pool.query(`SELECT id, driver_id, status FROM rides WHERE id = $1`, [Number(requestId)]);
      console.warn(`⚠️ ride_reached_pickup mismatch. Sent driverUserId=${driverUserId}. Row in DB:`, row.rows[0]);
      return callback?.({ ok: false, error: 'Ride not found for this driver.' });
    }
    callback?.({ ok: true });
  } catch (err) {
    console.error('ride_reached_pickup error:', err);
    callback?.({ ok: false, error: 'Server error.' });
  }
});
    // Driver enters the rider's code and it matches (checked client-side
    // against the rideCode it already has) — this just persists the moment
    // the trip actually starts.
    socket.on('ride_code_verified', async ({ requestId, driverUserId }, callback) => {
  const numDriverId = Number(driverUserId);
  const numRequestId = Number(requestId);
  if (!numDriverId || Number.isNaN(numDriverId)) {
    return callback?.({ ok: false, error: 'Missing driver id — please refresh and try again.' });
  }
  try {
    const updated = await pool.query(
      `UPDATE rides SET status = 'in_progress', started_at = now()
       WHERE id = $1 AND driver_id = $2
       RETURNING id, rider_id`,
      [numRequestId, numDriverId]
    );
    if (updated.rowCount === 0) {
      console.warn(`⚠️ ride_code_verified: no match for id=${numRequestId} driver_id=${numDriverId}`);
      return callback?.({ ok: false, error: 'Ride not found for this driver.' });
    }
      const riderId = updated.rows[0]?.rider_id;
    if (riderId) {
      await notifyRideRiders(numRequestId, riderId, 'ride_started', { requestId: numRequestId, riderId });
    }
    callback?.({ ok: true });
  } catch (err) {
    console.error('ride_code_verified error:', err);
    callback?.({ ok: false, error: 'Server error.' });
  }
});

    // Rider joins their own room so the server can reach them directly
    socket.on('rider_online', ({ riderId }) => {
      socket.join(`rider_${riderId}`);
      socket.data.userId = riderId;
      socket.data.role = 'rider';
    });

    // ----------------------------------------------------------------------
    // Join-request approval chain
    // ----------------------------------------------------------------------

    // Rider taps "Send Join Request" on FindRideScreen for a ride that's
    // already underway. Mirrors request_ride's ack-based contract rather
    // than going over REST, so it behaves the same way if the app is
    // offline/reconnecting.
    socket.on('send_join_request', async ({ rideId, riderId, riderName, pickup, destination, seatsRequested }, callback) => {
      const numRideId = Number(rideId);
      if (!numRideId || Number.isNaN(numRideId) || !riderId) {
        return callback?.({ ok: false, error: 'Missing rideId or riderId.' });
      }

      try {
        const ride = await getRideForJoinRequest(numRideId);
        if (!ride) {
          return callback?.({ ok: false, error: 'This ride is no longer accepting riders.' });
        }

        const riderIds = await getActiveRiderIds(numRideId);
        if (riderIds.includes(String(riderId))) {
          return callback?.({ ok: false, error: 'You are already in this ride.' });
        }

        const seats = Number(seatsRequested) || 1;
        const joinRequestId = randomUUID();
        const status = riderIds.length > 0 ? 'pending_passengers' : 'waiting_driver';

        joinRequests.set(joinRequestId, {
          rideId: numRideId,
          requesterRiderId: String(riderId),
          requesterName: riderName || 'A rider',
          pickup: pickup || 'Requested pickup',
          destination: destination || 'Requested drop-off',
          seatsRequested: seats,
          status,
          awaitingRiderIds: [...riderIds],
        });

        if (status === 'pending_passengers') {
          const payload = {
            joinRequestId,
            rideId: numRideId,
            requesterName: riderName || 'A rider',
            pickup,
            destination,
            seatsRequested: seats,
          };
          riderIds.forEach((id) => io.to(`rider_${id}`).emit('join_request_pending', payload));
        } else {
          const driverSocketId = onlineDrivers.get(String(ride.driver_id));
          if (driverSocketId) {
            io.to(driverSocketId).emit('join_request_incoming', {
              joinRequestId,
              rideId: numRideId,
              requesterName: riderName || 'A rider',
              pickup,
              destination,
              seatsRequested: seats,
              price: ride.price,
            });
          }
        }

        console.log(`📨 join request ${joinRequestId} for ride ${numRideId} from rider ${riderId} -> ${status}`);
        callback?.({ ok: true, status, joinRequestId });
      } catch (err) {
        console.error('send_join_request error:', err);
        callback?.({ ok: false, error: 'Server error.' });
      }
    });

    // An existing rider in the car allows/denies the newcomer. First denial
    // wins and the driver never sees it; once every current rider has said
    // "allow", it gets forwarded on to the driver for the final call.
    socket.on('join_request_rider_decision', async ({ joinRequestId, riderId, decision }, callback) => {
      const record = joinRequests.get(joinRequestId);
      if (!record || record.status !== 'pending_passengers') {
        return callback?.({ ok: false, error: 'This request is no longer active.' });
      }

      try {
        if (decision === 'deny') {
          joinRequests.delete(joinRequestId);
          io.to(`rider_${record.requesterRiderId}`).emit('join_request_result', {
            joinRequestId,
            status: 'denied',
            deniedBy: 'rider',
          });
          const riderIds = await getActiveRiderIds(record.rideId);
          riderIds.forEach((id) => io.to(`rider_${id}`).emit('join_request_closed', { joinRequestId }));
          return callback?.({ ok: true });
        }

        // decision === 'allow'
        record.awaitingRiderIds = record.awaitingRiderIds.filter((id) => String(id) !== String(riderId));
        if (record.awaitingRiderIds.length === 0) {
          record.status = 'waiting_driver';
          const ride = await getRideForJoinRequest(record.rideId);
          if (!ride) {
            joinRequests.delete(joinRequestId);
            io.to(`rider_${record.requesterRiderId}`).emit('join_request_result', {
              joinRequestId,
              status: 'denied',
              deniedBy: 'driver',
            });
            return callback?.({ ok: true });
          }
          const driverSocketId = onlineDrivers.get(String(ride.driver_id));
          if (driverSocketId) {
            io.to(driverSocketId).emit('join_request_incoming', {
              joinRequestId,
              rideId: record.rideId,
              requesterName: record.requesterName,
              pickup: record.pickup,
              destination: record.destination,
              seatsRequested: record.seatsRequested,
              price: ride.price,
            });
          }
        }
        callback?.({ ok: true });
      } catch (err) {
        console.error('join_request_rider_decision error:', err);
        callback?.({ ok: false, error: 'Server error.' });
      }
    });

    // The driver makes the final call, once every existing rider has
    // already said "allow".
    socket.on('join_request_driver_decision', async ({ joinRequestId, decision }, callback) => {
      const record = joinRequests.get(joinRequestId);
      if (!record || record.status !== 'waiting_driver') {
        return callback?.({ ok: false, error: 'This request is no longer active.' });
      }

      try {
        if (decision === 'deny') {
          joinRequests.delete(joinRequestId);
          io.to(`rider_${record.requesterRiderId}`).emit('join_request_result', {
            joinRequestId,
            status: 'denied',
            deniedBy: 'driver',
          });
          return callback?.({ ok: true });
        }

        // decision === 'allow' — seat them.
        const ride = await getRideForJoinRequest(record.rideId);
        if (!ride) {
          joinRequests.delete(joinRequestId);
          return callback?.({ ok: false, error: 'Ride no longer available.' });
        }

        await pool.query(
          `INSERT INTO ride_participants (ride_id, user_id, role, seats_requested, status)
           VALUES ($1, $2, 'rider', $3, 'active')
           ON CONFLICT (ride_id, user_id)
           DO UPDATE SET seats_requested = EXCLUDED.seats_requested, status = 'active'`,
          [record.rideId, record.requesterRiderId, record.seatsRequested]
        );

        joinRequests.delete(joinRequestId);
        io.to(`rider_${record.requesterRiderId}`).emit('join_request_result', {
          joinRequestId,
          status: 'approved',
          requestId: record.rideId,
          rideCode: ride.ride_code,
          vehicleModel: ride.vehicle_model,
          vehicleNumber: ride.vehicle_number,
        });
        callback?.({ ok: true });
      } catch (err) {
        console.error('join_request_driver_decision error:', err);
        callback?.({ ok: false, error: 'Server error.' });
      }
    });

    socket.on('disconnect', () => {
      if (socket.data.role === 'driver' && socket.data.userId) {
        onlineDrivers.delete(String(socket.data.userId));
      }
    });
        // Driver taps "Cancel Ride" (only offered before pickup is reached)
  socket.on('cancel_ride', async ({ requestId, driverUserId, riderId }, callback) => {
  const numDriverId = Number(driverUserId);
  const numRequestId = Number(requestId);
  if (!numDriverId || Number.isNaN(numDriverId)) {
    return callback?.({ ok: false, error: 'Missing driver id — please refresh and try again.' });
  }
  try {
    const updated = await pool.query(
       `UPDATE rides SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'driver'
       WHERE id = $1 AND driver_id = $2 AND status IN ('accepted','driver_arrived')
       RETURNING id, pickup_label, pickup_lat, pickup_lng,
                 destination_label, destination_lat, destination_lng,
                 distance_km, duration_minutes, ride_class, seats_requested,
                 ride_options, payment_method`,
      [numRequestId, numDriverId]
    );
    if (updated.rowCount === 0) {
      const row = await pool.query(`SELECT id, driver_id, status FROM rides WHERE id = $1`, [numRequestId]);
      console.warn(`⚠️ cancel_ride mismatch. Sent driverUserId=${numDriverId}. Row in DB:`, row.rows[0]);
      return callback?.({ ok: false, error: 'Ride not found for this driver.' });
    }
     const r = updated.rows[0];
    // Tell the rider WHICH driver cancelled, so that when they auto-search
    // again for the same trip, that driver can be excluded from the
    // rebroadcast — otherwise the driver who just cancelled immediately
    // sees the exact same ride pop back up as a "new" request.
    if (riderId) await notifyRideRiders(numRequestId, riderId, 'ride_cancelled', {
      requestId, cancelledByDriverId: numDriverId,
    ride: {
          pickup: { label: r.pickup_label, latitude: r.pickup_lat, longitude: r.pickup_lng },
          destination: { label: r.destination_label, latitude: r.destination_lat, longitude: r.destination_lng },
          distanceKm: r.distance_km,
          durationMinutes: r.duration_minutes,
          rideName: r.ride_class,
          riderCount: r.seats_requested,
          rideOptions: r.ride_options,
          paymentMethod: r.payment_method,
        }, });
    callback?.({ ok: true });
  } catch (err) {
    console.error('cancel_ride error:', err);
    callback?.({ ok: false, error: 'Server error.' });
  }
});
// Rider backs out of search after request_ride already went through —
// withdraw the still-open row so it doesn't linger as an orphan, and
// let any drivers who were shown it know it's gone.
socket.on('cancel_ride_request', async ({ requestId }) => {
  const numRequestId = Number(requestId);
  if (!numRequestId || Number.isNaN(numRequestId)) return;
  try {
    const updated = await pool.query(
      `UPDATE rides SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'rider'
       WHERE id = $1 AND status = 'requested'
       RETURNING id`,
      [numRequestId]
    );
    if (updated.rowCount > 0) {
      console.log(`🗑️ rider withdrew request ${numRequestId} before any driver accepted`);
      onlineDrivers.forEach((socketId) => {
        io.to(socketId).emit('request_taken', { id: requestId });
      });
    }
  } catch (err) {
    console.error('cancel_ride_request error:', err);
  }
});
        // Driver taps "Complete Drop-off"
    socket.on('ride_completed', async ({ requestId, driverUserId, riderId }, callback) => {
  const numDriverId = Number(driverUserId);
  const numRequestId = Number(requestId);
  if (!numDriverId || Number.isNaN(numDriverId)) {
    return callback?.({ ok: false, error: 'Missing driver id — please refresh and try again.' });
  }
  try {
    const updated = await pool.query(
      `UPDATE rides SET status = 'completed', completed_at = now()
       WHERE id = $1 AND driver_id = $2
       RETURNING rider_id`,
      [numRequestId, numDriverId]
    );
    if (updated.rowCount === 0) {
      console.warn(`⚠️ ride_completed: no match for id=${numRequestId} driver_id=${numDriverId}`);
      return callback?.({ ok: false, error: 'Ride not found for this driver.' });
    }
    const finalRiderId = updated.rows[0]?.rider_id ?? riderId;
    if (finalRiderId) {
      await notifyRideRiders(numRequestId, finalRiderId, 'ride_completed', { requestId, riderId: finalRiderId });
    }
    callback?.({ ok: true });
  } catch (err) {
    console.error('ride_completed error:', err);
    callback?.({ ok: false, error: 'Server error.' });
  }
});
// Chat between rider and driver for an active ride. The client tells us
// who it's for (riderId/driverId) — the server just routes it, no history
// is stored server-side.
socket.on('send_message', ({ requestId, riderId, driverId, sender, text }) => {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return;
  const message = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requestId,
    sender, // 'rider' | 'driver'
    text: trimmed,
  };
  if (sender === 'rider') {
    const driverSocketId = onlineDrivers.get(String(driverId));
    if (driverSocketId) io.to(driverSocketId).emit('receive_message', message);
  } else {
    io.to(`rider_${riderId}`).emit('receive_message', message);
  }
});
// Requests nobody accepted or declined-and-cleaned-up eventually go stale.
// Sweep them every 2 minutes so they can't linger in 'requested' forever.
setInterval(async () => {
  try {
    await pool.query(
      `UPDATE rides SET status = 'expired', cancelled_at = now()
       WHERE status = 'requested' AND requested_at < now() - interval '10 minutes'`
    );
  } catch (err) {
    console.error('stale-request sweep error:', err);
  }
}, 2 * 60 * 1000);
  });
}

module.exports = initSockets;