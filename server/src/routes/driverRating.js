// const express = require('express');
// const pool = require('../db');

// const router = express.Router();

// // POST /api/driver-rating — rider submits a rating + review for a completed ride
// router.post('/', async (req, res) => {
//   const { rideId, driverId, riderId, rating, description } = req.body;

//   const numRideId = Number(rideId);
//   const numRiderId = Number(riderId);
//   const numDriverId = driverId != null && driverId !== '' ? Number(driverId) : null;
//   const numRating = Number(rating);

//   if (!numRideId || Number.isNaN(numRideId)) {
//     return res.status(400).json({ error: 'Missing or invalid rideId.' });
//   }
//   if (!numRiderId || Number.isNaN(numRiderId)) {
//     return res.status(400).json({ error: 'Missing or invalid riderId.' });
//   }
//   if (!numRating || numRating < 1 || numRating > 5) {
//     return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
//   }
//   if (!description || !String(description).trim()) {
//     return res.status(400).json({ error: 'Description is required.' });
//   }

//   try {
//     const result = await pool.query(
//       `INSERT INTO driver_rating (ride_id, driver_id, rider_id, rating, description)
//        VALUES ($1, $2, $3, $4, $5)
//        RETURNING id`,
//       [numRideId, numDriverId, numRiderId, numRating, String(description).trim()]
//     );
//     res.status(201).json({ id: result.rows[0].id });
//   } catch (err) {
//     console.error('driver_rating insert error:', err);
//     res.status(500).json({ error: 'Could not save feedback.' });
//   }
// });

// module.exports = router;
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Driver Rating
 *   description: Ratings and reviews submitted by riders for drivers
 */

/**
 * @swagger
 * /api/driver-rating:
 *   post:
 *     summary: Submit a driver rating and review
 *     description: Allows a rider to submit a rating and review for a completed ride.
 *     tags: [Driver Rating]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rideId
 *               - riderId
 *               - rating
 *               - description
 *             properties:
 *               rideId:
 *                 type: integer
 *                 description: ID of the completed ride
 *                 example: 12
 *               driverId:
 *                 type: integer
 *                 nullable: true
 *                 description: ID of the driver
 *                 example: 5
 *               riderId:
 *                 type: integer
 *                 description: ID of the rider submitting the review
 *                 example: 3
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5
 *                 example: 5
 *               description:
 *                 type: string
 *                 description: Rider's review of the driver
 *                 example: Very friendly and safe driver.
 *     responses:
 *       201:
 *         description: Rating successfully saved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 25
 *       400:
 *         description: Invalid or missing ride, rider, rating, or review information.
 *       500:
 *         description: Could not save feedback.
 */
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
    return res.status(400).json({
      error: 'Rating must be between 1 and 5.'
    });
  }

  if (!description || !String(description).trim()) {
    return res.status(400).json({
      error: 'Description is required.'
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO driver_rating
       (ride_id, driver_id, rider_id, rating, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        numRideId,
        numDriverId,
        numRiderId,
        numRating,
        String(description).trim()
      ]
    );

    res.status(201).json({
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('driver_rating insert error:', err);

    res.status(500).json({
      error: 'Could not save feedback.'
    });
  }
});

module.exports = router;