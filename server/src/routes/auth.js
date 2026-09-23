// const express = require('express');
// const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
// const pool = require('../db');

// const router = express.Router();

// router.post('/signup', async (req, res) => {
//   const { name, email, password, phone, aadhar, designation, username, gender, dob } = req.body;
//   const dobForDb = dob ? dob.split('/').reverse().join('-') : null;
//   const client = await pool.connect();
//   try {
//     await client.query('BEGIN');
//     const passwordHash = await bcrypt.hash(password, 10);

//     const userResult = await client.query(
//       `INSERT INTO users (name, email, password_hash, phone, aadhar, designation)
//        VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
//       [name, email, passwordHash, phone, aadhar, designation]
//     );
//     const userId = userResult.rows[0].id;

//     if (designation === 'user') {
//       await client.query(
//         `INSERT INTO rider_profiles (user_id, username, gender, dob) VALUES ($1,$2,$3,$4)`,
//         [userId, username, gender, dobForDb]
//       );
//     }

//     await client.query('COMMIT');
//     res.json({ userId, designation });
//   } catch (err) {
//     await client.query('ROLLBACK');
//     if (err.code === '23505') {
//       const field = {
//         users_phone_key: 'Phone number',
//         users_email_key: 'Email',
//         users_aadhar_key: 'Aadhar number',
//         rider_profiles_username_key: 'Username',
//       }[err.constraint] || null;

//       return res.status(409).json({
//         error: field ? `${field} already in use.` : 'Already in use.',
//       });
//     }
//     console.error(err);
//     res.status(500).json({ error: 'Signup failed.' });
//   } finally {
//     client.release();
//   }
// });

// router.post('/login', async (req, res) => {
//   const { username, password, designation } = req.body;

//   if (!username || !password || !designation) {
//     return res.status(400).json({ error: 'Username, password, and designation are required.' });
//   }

//   try {
//     // Look up the user by identifier FIRST, regardless of designation,
//     // so we can tell "no such user" apart from "wrong password".
//     const result = await pool.query(
//       `SELECT u.*, r.username AS rider_username
//        FROM users u
//        LEFT JOIN rider_profiles r ON r.user_id = u.id
//        WHERE r.username = $1 OR u.email = $1 OR u.name = $1`,
//       [username]
//     );
//     const user = result.rows[0];

//     // Case: no account at all with this identifier
//     if (!user) {
//       return res.status(404).json({
//         error: 'new_user',
//         message: 'You are a new user, please signup.',
//       });
//     }

//     // Case: account exists, check password
//     const validPassword = await bcrypt.compare(password, user.password_hash);
//     if (!validPassword) {
//       return res.status(401).json({
//         error: 'wrong_password',
//         message: 'Password incorrect.',
//       });
//     }

//     // Case: password correct, but designation doesn't match this account
//     if (user.designation !== designation) {
//       return res.status(403).json({
//         error: 'designation_mismatch',
//         message: `This account is registered as a ${user.designation}, not a ${designation}.`,
//       });
//     }

//     // Success
//     const token = jwt.sign(
//       { userId: user.id, designation: user.designation },
//       process.env.JWT_SECRET,
//       { expiresIn: '7d' }
//     );

//     res.json({
//       token,
//       userId: user.id,
//       name: user.name,
//       // username: user.rider_username || username,
//       designation: user.designation,
//       // frontend uses this to decide ride.tsx vs driverDashboard.tsx
//       redirectTo: user.designation === 'driver' ? '/driverDashboard' : '/rider',
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'server_error', message: 'Login failed.' });
//   }
// });

// module.exports = router;

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User registration and login
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     description: Creates a user account and, for riders, creates a rider profile.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phone
 *               - aadhar
 *               - designation
 *             properties:
 *               name:
 *                 type: string
 *                 example: Rahul Das
 *               email:
 *                 type: string
 *                 format: email
 *                 example: rahul@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               aadhar:
 *                 type: string
 *                 example: "123456789012"
 *               designation:
 *                 type: string
 *                 enum: [user, driver]
 *                 example: user
 *               username:
 *                 type: string
 *                 example: rahul123
 *               gender:
 *                 type: string
 *                 example: Male
 *               dob:
 *                 type: string
 *                 example: 15/08/2004
 *     responses:
 *       200:
 *         description: User successfully registered.
 *       409:
 *         description: Phone, email, Aadhar number, or username already exists.
 *       500:
 *         description: Signup failed.
 */
router.post('/signup', async (req, res) => {
  const { name, email, password, phone, aadhar, designation, username, gender, dob } = req.body;
  const dobForDb = dob ? dob.split('/').reverse().join('-') : null;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, aadhar, designation)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, email, passwordHash, phone, aadhar, designation]
    );

    const userId = userResult.rows[0].id;

    if (designation === 'user') {
      await client.query(
        `INSERT INTO rider_profiles (user_id, username, gender, dob) VALUES ($1,$2,$3,$4)`,
        [userId, username, gender, dobForDb]
      );
    }

    await client.query('COMMIT');
    res.json({ userId, designation });

  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      const field = {
        users_phone_key: 'Phone number',
        users_email_key: 'Email',
        users_aadhar_key: 'Aadhar number',
        rider_profiles_username_key: 'Username',
      }[err.constraint] || null;

      return res.status(409).json({
        error: field ? `${field} already in use.` : 'Already in use.',
      });
    }

    console.error(err);
    res.status(500).json({ error: 'Signup failed.' });

  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 *     description: Authenticates a rider or driver and returns a JWT token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - designation
 *             properties:
 *               username:
 *                 type: string
 *                 description: Rider username, email, or name.
 *                 example: rahul123
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password@123
 *               designation:
 *                 type: string
 *                 enum: [user, driver]
 *                 example: user
 *     responses:
 *       200:
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 userId:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 designation:
 *                   type: string
 *                 redirectTo:
 *                   type: string
 *       400:
 *         description: Missing username, password, or designation.
 *       401:
 *         description: Incorrect password.
 *       403:
 *         description: Account designation does not match.
 *       404:
 *         description: User does not exist.
 *       500:
 *         description: Login failed.
 */
router.post('/login', async (req, res) => {
  const { username, password, designation } = req.body;

  if (!username || !password || !designation) {
    return res.status(400).json({
      error: 'Username, password, and designation are required.'
    });
  }

  try {
    const result = await pool.query(
      `SELECT u.*, r.username AS rider_username
       FROM users u
       LEFT JOIN rider_profiles r ON r.user_id = u.id
       WHERE r.username = $1 OR u.email = $1 OR u.name = $1`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        error: 'new_user',
        message: 'You are a new user, please signup.',
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        error: 'wrong_password',
        message: 'Password incorrect.',
      });
    }

    if (user.designation !== designation) {
      return res.status(403).json({
        error: 'designation_mismatch',
        message: `This account is registered as a ${user.designation}, not a ${designation}.`,
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        designation: user.designation
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    res.json({
      token,
      userId: user.id,
      name: user.name,
      designation: user.designation,
      redirectTo: user.designation === 'driver'
        ? '/driverDashboard'
        : '/rider',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'server_error',
      message: 'Login failed.'
    });
  }
});

module.exports = router;