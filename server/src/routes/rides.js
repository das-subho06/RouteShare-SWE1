const express = require('express');
const pool = require('../db');

const router = express.Router();

// Past rides for a user, as either rider or driver — for a "My Rides" screen.
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM rides
       WHERE (rider_id = $1 OR driver_id = $1)
         AND status IN ('completed', 'cancelled')
       ORDER BY requested_at DESC
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

module.exports = router;