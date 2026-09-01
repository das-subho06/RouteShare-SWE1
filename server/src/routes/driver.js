const express = require('express');
const pool = require('../db');

const router = express.Router();

router.post('/driver-details', async (req, res) => {
  const { userId, licenseNumber, vehicleNumber, vehicleType, vehicleModel, seats, wheels } = req.body;
  try {
    await pool.query(
      `INSERT INTO driver_profiles
        (user_id, license_number, vehicle_number, vehicle_type, vehicle_model, seats, wheels)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [userId, licenseNumber, vehicleNumber, vehicleType, vehicleModel, seats, wheels]
    );
    res.json({ verificationStatus: 'verified' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save vehicle details.' });
  }
});

module.exports = router;