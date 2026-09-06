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

// NEW: fetch a driver's own profile for the dashboard sidebar
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
      return res.status(404).json({ error: 'No driver profile found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch driver profile.' });
  }
});

module.exports = router;