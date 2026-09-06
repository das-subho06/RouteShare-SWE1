const express = require('express');
const pool = require('../db');

const router = express.Router();

// POST /api/driver-rating — rider submits a rating + review for a completed ride
router.post('/', async (req, res) => {
  const { rideId, driverId, riderId, rating, description } = req.body;

  const numRideId = Number(rideId);
  const numRiderId = Number(riderId);
  const numDriverId = driverId != null && driverId !== '' ? Number(driverId) : null;
  const numRating = Number(rating);

  if (!numRideId || Number.isNaN(numRideId)) {
    return res.status(400).json({ error: 'Missing or invalid rideId.' });
  }
  if (!numRiderId || Number.isNaN(numRiderId)) {
    return res.status(400).json({ error: 'Missing or invalid riderId.' });
  }
  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
  }
  if (!description || !String(description).trim()) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO driver_rating (ride_id, driver_id, rider_id, rating, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [numRideId, numDriverId, numRiderId, numRating, String(description).trim()]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('driver_rating insert error:', err);
    res.status(500).json({ error: 'Could not save feedback.' });
  }
});

module.exports = router;