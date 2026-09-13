const pool = require('./db');

// In-memory map instead of DB columns: userId -> socketId
const onlineDrivers = new Map();

function initSockets(io) {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Driver goes online — client emits this right after driverDashboard mounts
    socket.on('driver_online', ({ userId }) => {
      onlineDrivers.set(String(userId), socket.id);
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
socket.on('accept_ride', async ({ requestId, riderId, driverUserId, driver: clientDriver }, callback) => {
  const numDriverId = Number(driverUserId);
  const numRequestId = Number(requestId);
  if (!numDriverId || Number.isNaN(numDriverId)) {
    console.warn('⚠️ accept_ride called with invalid driverUserId:', driverUserId);
    return callback?.({ ok: false, error: 'Missing driver id — please refresh and try again.' });
  }

  try {
    const updated = await pool.query(
      `UPDATE rides
         SET driver_id = $1, status = 'accepted', accepted_at = now()
       WHERE id = $2 AND status = 'requested'
       RETURNING ride_code`,
      [numDriverId, numRequestId]
    );

    if (updated.rowCount === 0) {
      console.log(`⚠️ ride ${requestId} already taken — ignoring accept from driver ${numDriverId}`);
      socket.emit('ride_unavailable', { requestId });
      return callback?.({ ok: false, error: 'This ride was already taken.' });
    }

    const rideCode = updated.rows[0].ride_code;

    const driverInfo = await pool.query(
      `SELECT dp.*, u.name FROM driver_profiles dp JOIN users u ON u.id = dp.user_id WHERE dp.user_id = $1`,
      [numDriverId]
    );
    const driver = driverInfo.rows[0] || clientDriver;

    io.to(`rider_${riderId}`).emit('ride_accepted', { requestId, driver, rideCode });

    onlineDrivers.forEach((socketId, uid) => {
      if (String(uid) !== String(numDriverId)) {
        io.to(socketId).emit('request_taken', { id: requestId });
      }
    });
    callback?.({ ok: true, rideCode });
  } catch (err) {
    console.error('accept_ride error:', err);
    callback?.({ ok: false, error: 'Server error.' });
  }
});

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
       RETURNING id`,
      [numRequestId, numDriverId]
    );
    if (updated.rowCount === 0) {
      console.warn(`⚠️ ride_code_verified: no match for id=${numRequestId} driver_id=${numDriverId}`);
      return callback?.({ ok: false, error: 'Ride not found for this driver.' });
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
    if (riderId) io.to(`rider_${riderId}`).emit('ride_cancelled', { 
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
      io.to(`rider_${finalRiderId}`).emit('ride_completed', { requestId, riderId: finalRiderId });
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