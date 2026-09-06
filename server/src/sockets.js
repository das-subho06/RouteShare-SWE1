// sockets.js
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
        price,
        rideName,       // e.g. "Go Mini"
        riderCount,     // how many people — must match driver.seats
      paymentMethod = 'cash',   // NEW, default matches column default
  rideOptions = [], 
      } = payload;

      const rideCode = `ROUTE${Math.floor(10 + Math.random() * 90)}`;

      try {
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
           WHERE seats >= $1 AND user_id = ANY($2::int[])`,
          [riderCount, onlineIds.map(Number)]
        );
        console.log('🎯 matched drivers:', matches.rows);

        // The row is the single source of truth for this ride from here on —
        // its serial id becomes the requestId used everywhere else.
        const inserted = await pool.query(
  `INSERT INTO rides
    (rider_id, ride_class, pickup_label, pickup_lat, pickup_lng,
     destination_label, destination_lat, destination_lng,
     distance_km, duration_minutes, price, seats_requested, ride_code, status,
     ride_options, payment_method)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'requested',$14,$15)
   RETURNING id`,
  [
    riderId, rideName, pickup.label, pickup.latitude, pickup.longitude,
    destination.label, destination.latitude, destination.longitude,
    distanceKm, durationMinutes, price, riderCount, rideCode,
    rideOptions, paymentMethod,
  ]
);
        const requestId = String(inserted.rows[0].id);

        matches.rows.forEach((driver) => {
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

        socket.emit('request_sent', { requestId, notifiedDrivers: matches.rows.length });
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
      `UPDATE rides SET status = 'cancelled', cancelled_at = now()
       WHERE id = $1 AND driver_id = $2
       RETURNING id`,
      [numRequestId, numDriverId]
    );
    if (updated.rowCount === 0) {
      const row = await pool.query(`SELECT id, driver_id, status FROM rides WHERE id = $1`, [numRequestId]);
      console.warn(`⚠️ cancel_ride mismatch. Sent driverUserId=${numDriverId}. Row in DB:`, row.rows[0]);
      return callback?.({ ok: false, error: 'Ride not found for this driver.' });
    }
    if (riderId) io.to(`rider_${riderId}`).emit('ride_cancelled', { requestId });
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
      `UPDATE rides SET status = 'cancelled', cancelled_at = now()
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

  });
}

module.exports = initSockets;