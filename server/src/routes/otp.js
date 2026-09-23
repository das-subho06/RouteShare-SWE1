// const express = require('express');
// const twilio = require('twilio');
// const pool = require('../db');
// const bcrypt = require('bcrypt');
// const router = express.Router();

// const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// const verifySid = process.env.TWILIO_VERIFY_SID;

// // ---- Send OTP ----
// router.post('/send-otp', async (req, res) => {
//   const { phone } = req.body;
//   if (!phone || phone.length !== 10) {
//     return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
//   }
//   try {
//     // Reject early if this phone is already tied to an existing account
//     const existing = await pool.query(
//       'SELECT id FROM users WHERE phone = $1',
//       [phone]
//     );
//     if (existing.rows.length > 0) {
//       return res.status(409).json({ error: 'This phone number is already registered.' });
//     }

//     await client.verify.v2
//       .services(verifySid)
//       .verifications.create({ to: `+91${phone}`, channel: 'sms' });
//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not send verification code.' });
//   }
// });

// // ---- Verify OTP ----
// router.post('/verify-otp', async (req, res) => {
//   const { phone, code } = req.body;
//   if (!phone || !code) {
//     return res.status(400).json({ error: 'Phone and code are required.' });
//   }
//   try {
//     const check = await client.verify.v2
//       .services(verifySid)
//       .verificationChecks.create({ to: `+91${phone}`, code });

//     if (check.status === 'approved') {
//       res.json({ verified: true });
//     } else {
//       res.status(400).json({ verified: false, error: 'Incorrect code.' });
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Verification failed.' });
//   }
// });

// // ---- Send OTP for password reset (phone must already be registered) ----
// router.post('/send-reset-otp', async (req, res) => {
//   const { phone } = req.body;
//   if (!phone || phone.length !== 10) {
//     return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
//   }
//   try {
//     const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
//     if (existing.rows.length === 0) {
//       return res.status(404).json({ error: 'No account found with this phone number.' });
//     }

//     await client.verify.v2
//       .services(verifySid)
//       .verifications.create({ to: `+91${phone}`, channel: 'sms' });
//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not send verification code.' });
//   }
// });

// // ---- Verify OTP + set new password ----
// router.post('/reset-password', async (req, res) => {
//   const { phone, code, newPassword } = req.body;
//   if (!phone || !code || !newPassword) {
//     return res.status(400).json({ error: 'Phone, code, and new password are required.' });
//   }
//   if (newPassword.length < 8) {
//     return res.status(400).json({ error: 'Password should be at least 8 characters.' });
//   }

//   try {
//     const check = await client.verify.v2
//       .services(verifySid)
//       .verificationChecks.create({ to: `+91${phone}`, code });

//     if (check.status !== 'approved') {
//       return res.status(400).json({ error: 'Incorrect or expired code.' });
//     }

//     const hash = await bcrypt.hash(newPassword, 10);
//     const result = await pool.query(
//       'UPDATE users SET password_hash = $1 WHERE phone = $2 RETURNING id',
//       [hash, phone]
//     );

//     if (result.rowCount === 0) {
//       return res.status(404).json({ error: 'No account found with this phone number.' });
//     }

//     res.json({ success: true });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Password reset failed.' });
//   }
// });
// module.exports = router;

const express = require('express');
const twilio = require('twilio');
const pool = require('../db');
const bcrypt = require('bcrypt');

const router = express.Router();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const verifySid = process.env.TWILIO_VERIFY_SID;

/**
 * @swagger
 * tags:
 *   name: OTP
 *   description: Phone verification and password reset
 */

/**
 * @swagger
 * /api/otp/send-otp:
 *   post:
 *     summary: Send OTP for phone verification
 *     description: Sends an SMS verification code to a new user's phone number.
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 description: 10-digit Indian phone number
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid phone number.
 *       409:
 *         description: Phone number is already registered.
 *       500:
 *         description: Could not send verification code.
 */
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone || phone.length !== 10) {
    return res.status(400).json({
      error: 'Enter a valid 10-digit phone number.'
    });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'This phone number is already registered.'
      });
    }

    await client.verify.v2
      .services(verifySid)
      .verifications.create({
        to: `+91${phone}`,
        channel: 'sms'
      });

    res.json({ success: true });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Could not send verification code.'
    });
  }
});

/**
 * @swagger
 * /api/otp/verify-otp:
 *   post:
 *     summary: Verify phone OTP
 *     description: Verifies the OTP sent to the user's phone number.
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing information or incorrect OTP.
 *       500:
 *         description: Verification failed.
 */
router.post('/verify-otp', async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({
      error: 'Phone and code are required.'
    });
  }

  try {
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({
        to: `+91${phone}`,
        code
      });

    if (check.status === 'approved') {
      res.json({ verified: true });
    } else {
      res.status(400).json({
        verified: false,
        error: 'Incorrect code.'
      });
    }

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Verification failed.'
    });
  }
});

/**
 * @swagger
 * /api/otp/send-reset-otp:
 *   post:
 *     summary: Send OTP for password reset
 *     description: Sends a password-reset OTP if the phone number belongs to an existing account.
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *     responses:
 *       200:
 *         description: Password reset OTP sent successfully.
 *       400:
 *         description: Invalid phone number.
 *       404:
 *         description: No account found with this phone number.
 *       500:
 *         description: Could not send verification code.
 */
router.post('/send-reset-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone || phone.length !== 10) {
    return res.status(400).json({
      error: 'Enter a valid 10-digit phone number.'
    });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'No account found with this phone number.'
      });
    }

    await client.verify.v2
      .services(verifySid)
      .verifications.create({
        to: `+91${phone}`,
        channel: 'sms'
      });

    res.json({ success: true });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Could not send verification code.'
    });
  }
});

/**
 * @swagger
 * /api/otp/reset-password:
 *   post:
 *     summary: Reset account password
 *     description: Verifies the OTP and sets a new password for the account.
 *     tags: [OTP]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *               - newPassword
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               code:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: "NewPassword@123"
 *     responses:
 *       200:
 *         description: Password reset successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Missing information, invalid password, or incorrect OTP.
 *       404:
 *         description: No account found with this phone number.
 *       500:
 *         description: Password reset failed.
 */
router.post('/reset-password', async (req, res) => {
  const { phone, code, newPassword } = req.body;

  if (!phone || !code || !newPassword) {
    return res.status(400).json({
      error: 'Phone, code, and new password are required.'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: 'Password should be at least 8 characters.'
    });
  }

  try {
    const check = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({
        to: `+91${phone}`,
        code
      });

    if (check.status !== 'approved') {
      return res.status(400).json({
        error: 'Incorrect or expired code.'
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE phone = $2 RETURNING id',
      [hash, phone]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'No account found with this phone number.'
      });
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Password reset failed.'
    });
  }
});

module.exports = router;