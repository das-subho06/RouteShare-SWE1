const express = require('express');
const axios = require('axios');
const pool = require('../db');
const router = express.Router();

// ---------------------------------------------------------------------------
// NOTE: This uses Setu's Aadhaar eKYC API shape as a reference implementation.
// You need real credentials from a licensed provider (Setu, Signzy, Digio, etc.)
// before this will actually work — sign up for sandbox access, then set:
//   AADHAAR_BASE_URL, AADHAAR_CLIENT_ID, AADHAAR_CLIENT_SECRET, AADHAAR_PRODUCT_INSTANCE_ID
// in your .env. The exact endpoint paths / field names may differ slightly from
// what's below depending on which provider you pick — check their docs and
// adjust the axios calls accordingly.
// ---------------------------------------------------------------------------

const AADHAAR_BASE_URL = process.env.AADHAAR_BASE_URL;
const headers = {
  'x-client-id': process.env.AADHAAR_CLIENT_ID,
  'x-client-secret': process.env.AADHAAR_CLIENT_SECRET,
  'x-product-instance-id': process.env.AADHAAR_PRODUCT_INSTANCE_ID,
  'Content-Type': 'application/json',
};

// ---- Step 1: trigger Aadhaar OTP (sent by UIDAI to the phone linked to that Aadhaar) ----
router.post('/send-otp', async (req, res) => {
  const { aadhaar } = req.body;
  if (!aadhaar || aadhaar.length !== 12) {
    return res.status(400).json({ error: 'Enter a valid 12-digit Aadhaar number.' });
  }
  try {
    // Reject early if this Aadhaar is already tied to an existing account
    const existing = await pool.query('SELECT id FROM users WHERE aadhar = $1', [aadhaar]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This Aadhaar number is already registered.' });
    }

    const response = await axios.post(
      `${AADHAAR_BASE_URL}/api/v2/aadhaar/get-otp`,
      { aadhaarNumber: aadhaar },
      { headers }
    );

    // referenceId must be sent back on the verify step
    res.json({ referenceId: response.data.referenceId });
  } catch (err) {
    console.error('Aadhaar send-otp error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Could not send Aadhaar verification code.' });
  }
});

// ---- Step 2: verify the code the user received on their Aadhaar-linked phone ----
router.post('/verify-otp', async (req, res) => {
  const { referenceId, otp } = req.body;
  if (!referenceId || !otp || otp.length !== 6) {
    return res.status(400).json({ error: 'Reference ID and 6-digit code are required.' });
  }
  try {
    const response = await axios.post(
      `${AADHAAR_BASE_URL}/api/v2/aadhaar/verify-otp`,
      { referenceId, otp },
      { headers }
    );

    // response.data typically includes verified KYC fields (name, dob, gender, etc.)
    res.json({ verified: true, kyc: response.data });
  } catch (err) {
    console.error('Aadhaar verify-otp error:', err.response?.data || err.message);
    res.status(400).json({ verified: false, error: 'Incorrect or expired code.' });
  }
});

module.exports = router;
