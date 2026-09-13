const express = require('express');
const pool = require('../db');

const router = express.Router();

// Past rides for a user, as either rider or driver — for a "My Rides" screen.
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS driver_name, dr.rating AS rider_given_rating
       FROM rides r
       LEFT JOIN users u ON u.id = r.driver_id
       LEFT JOIN driver_rating dr ON dr.ride_id = r.id
       WHERE (r.rider_id = $1 OR r.driver_id = $1)
         AND r.status = 'completed'
       ORDER BY r.requested_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch ride history.' });
  }
});

// The in-progress ride for a user, if any — lets driverDashboard / confirmPage
// recover state after a refresh instead of relying only on socket state.
router.get('/active/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM rides
       WHERE (rider_id = $1 OR driver_id = $1)
         AND status IN ('accepted', 'driver_arrived', 'in_progress')
       ORDER BY requested_at DESC
       LIMIT 1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No active ride.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch active ride.' });
  }
});
router.get('/pending/:driverId', async (req, res) => {
  const { driverId } = req.params;
  try {
    const driverRes = await pool.query(
      `SELECT seats FROM driver_profiles WHERE user_id = $1`,
      [driverId]
    );
    const seats = driverRes.rows[0]?.seats;
    if (!seats) return res.json([]);

    const result = await pool.query(
  `SELECT r.*, u.name AS rider_name
   FROM rides r
   JOIN users u ON u.id = r.rider_id
   WHERE r.status = 'requested' AND r.seats_requested <= $1
     AND r.pickup_label <> '' AND r.destination_label <> ''
     AND NOT ($2 = ANY(r.excluded_driver_ids))
   ORDER BY r.requested_at DESC`,
  [seats, Number(driverId)]
);

    const requests = result.rows.map((row) => ({
      id: String(row.id),
      riderId: row.rider_id,
      riderName: row.rider_name,
      pickup: row.pickup_label,
      destination: row.destination_label,
      pickupCoords: { latitude: row.pickup_lat, longitude: row.pickup_lng },
      destinationCoords: { latitude: row.destination_lat, longitude: row.destination_lng },
      distance: `${row.distance_km} km`,
      time: `${row.duration_minutes} min`,
      price: row.price,
      carType: row.ride_class,
      requestedSeats: row.seats_requested,
      rideCode: row.ride_code,
    }));

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch pending requests.' });
  }
});
module.exports = router;