const express = require('express');
const twilio = require('twilio');
const pool = require('../db');
const bcrypt = require('bcrypt');
const router = express.Router();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const verifySid = process.env.TWILIO_VERIFY_SID;

// ---- Send OTP ----
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }
  try {
    // Reject early if this phone is already tied to an existing account
    const existing = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This phone number is already registered.' });
    }

    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: `+91${phone}`, channel: 'sms' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send verification code.' });
  }
});

// ---- Verify OTP ----
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and code are required.' });
  }
  try {
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: `+91${phone}`, code });

    if (check.status === 'approved') {
      res.json({ verified: true });
    } else {
      res.status(400).json({ verified: false, error: 'Incorrect code.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// ---- Send OTP for password reset (phone must already be registered) ----
router.post('/send-reset-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this phone number.' });
    }

    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: `+91${phone}`, channel: 'sms' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not send verification code.' });
  }
});

// ---- Verify OTP + set new password ----
router.post('/reset-password', async (req, res) => {
  const { phone, code, newPassword } = req.body;
  if (!phone || !code || !newPassword) {
    return res.status(400).json({ error: 'Phone, code, and new password are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password should be at least 8 characters.' });
  }

  try {
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: `+91${phone}`, code });

    if (check.status !== 'approved') {
      return res.status(400).json({ error: 'Incorrect or expired code.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE phone = $2 RETURNING id',
      [hash, phone]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No account found with this phone number.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password reset failed.' });
  }
});
module.exports = router;