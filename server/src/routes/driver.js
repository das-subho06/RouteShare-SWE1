// const express = require('express');
// const pool = require('../db');

// const router = express.Router();

// router.post('/driver-details', async (req, res) => {
//   const { userId, licenseNumber, vehicleNumber, vehicleType, vehicleModel, seats, wheels } = req.body;
//   try {
//     await pool.query(
//       `INSERT INTO driver_profiles
//         (user_id, license_number, vehicle_number, vehicle_type, vehicle_model, seats, wheels)
//        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
//       [userId, licenseNumber, vehicleNumber, vehicleType, vehicleModel, seats, wheels]
//     );
//     res.json({ verificationStatus: 'verified' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not save vehicle details.' });
//   }
// });

// // NEW: fetch a driver's own profile for the dashboard sidebar
// router.get('/driver-details/:userId', async (req, res) => {
//   const { userId } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT dp.*, u.name
//        FROM driver_profiles dp
//        JOIN users u ON u.id = dp.user_id
//        WHERE dp.user_id = $1`,
//       [userId]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'No driver profile found.' });
//     }
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not fetch driver profile.' });
//   }
// });

// module.exports = router;
const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Driver
 *   description: Driver profile and vehicle management
 */

/**
 * @swagger
 * /api/driver/driver-details:
 *   post:
 *     summary: Save driver and vehicle details
 *     description: Stores the driver's license and vehicle information.
 *     tags: [Driver]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - licenseNumber
 *               - vehicleNumber
 *               - vehicleType
 *               - vehicleModel
 *               - seats
 *               - wheels
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               licenseNumber:
 *                 type: string
 *                 example: WB0120240012345
 *               vehicleNumber:
 *                 type: string
 *                 example: WB12AB1234
 *               vehicleType:
 *                 type: string
 *                 example: Car
 *               vehicleModel:
 *                 type: string
 *                 example: Maruti Swift
 *               seats:
 *                 type: integer
 *                 example: 4
 *               wheels:
 *                 type: integer
 *                 example: 4
 *     responses:
 *       200:
 *         description: Driver details saved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verificationStatus:
 *                   type: string
 *                   example: verified
 *       500:
 *         description: Could not save vehicle details.
 */
router.post('/driver-details', async (req, res) => {
  const {
    userId,
    licenseNumber,
    vehicleNumber,
    vehicleType,
    vehicleModel,
    seats,
    wheels
  } = req.body;

  try {
    await pool.query(
      `INSERT INTO driver_profiles
        (user_id, license_number, vehicle_number, vehicle_type, vehicle_model, seats, wheels)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId,
        licenseNumber,
        vehicleNumber,
        vehicleType,
        vehicleModel,
        seats,
        wheels
      ]
    );

    res.json({ verificationStatus: 'verified' });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Could not save vehicle details.'
    });
  }
});

/**
 * @swagger
 * /api/driver/driver-details/{userId}:
 *   get:
 *     summary: Get driver profile
 *     description: Fetches the driver's profile and vehicle details using the user ID.
 *     tags: [Driver]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Driver profile retrieved successfully.
 *       404:
 *         description: No driver profile found.
 *       500:
 *         description: Could not fetch driver profile.
 */
router.get('/driver-details/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT dp.*, u.name
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       WHERE dp.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No driver profile found.'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Could not fetch driver profile.'
    });
  }
});

module.exports = router;