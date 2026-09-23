// const express = require('express');
// const pool = require('../db');

// const router = express.Router();

// // Past rides for a user, as either rider or driver — for a "My Rides" screen.
// router.get('/history/:userId', async (req, res) => {
//   const { userId } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT r.*, u.name AS driver_name, dr.rating AS rider_given_rating
//        FROM rides r
//        LEFT JOIN users u ON u.id = r.driver_id
//        LEFT JOIN driver_rating dr ON dr.ride_id = r.id
//        WHERE (r.rider_id = $1 OR r.driver_id = $1)
//          AND r.status = 'completed'
//        ORDER BY r.requested_at DESC
//        LIMIT 50`,
//       [userId]
//     );
//     res.json(result.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not fetch ride history.' });
//   }
// });

// // The in-progress ride for a user, if any — lets driverDashboard / confirmPage
// // recover state after a refresh instead of relying only on socket state.
// router.get('/active/:userId', async (req, res) => {
//   const { userId } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT * FROM rides
//        WHERE (rider_id = $1 OR driver_id = $1)
//          AND status IN ('accepted', 'driver_arrived', 'in_progress')
//        ORDER BY requested_at DESC
//        LIMIT 1`,
//       [userId]
//     );
//     if (result.rows.length === 0) {
//       return res.status(404).json({ error: 'No active ride.' });
//     }
//     res.json(result.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not fetch active ride.' });
//   }
// });
// router.get('/pending/:driverId', async (req, res) => {
//   const { driverId } = req.params;
//   try {
//     const driverRes = await pool.query(
//       `SELECT seats FROM driver_profiles WHERE user_id = $1`,
//       [driverId]
//     );
//     const seats = driverRes.rows[0]?.seats;
//     if (!seats) return res.json([]);

//     const result = await pool.query(
//   `SELECT r.*, u.name AS rider_name
//    FROM rides r
//    JOIN users u ON u.id = r.rider_id
//    WHERE r.status = 'requested' AND r.seats_requested <= $1
//      AND r.pickup_label <> '' AND r.destination_label <> ''
//      AND NOT ($2 = ANY(r.excluded_driver_ids))
//    ORDER BY r.requested_at DESC`,
//   [seats, Number(driverId)]
// );

//     const requests = result.rows.map((row) => ({
//       id: String(row.id),
//       riderId: row.rider_id,
//       riderName: row.rider_name,
//       pickup: row.pickup_label,
//       destination: row.destination_label,
//       pickupCoords: { latitude: row.pickup_lat, longitude: row.pickup_lng },
//       destinationCoords: { latitude: row.destination_lat, longitude: row.destination_lng },
//       distance: `${row.distance_km} km`,
//       time: `${row.duration_minutes} min`,
//       price: row.price,
//       carType: row.ride_class,
//       requestedSeats: row.seats_requested,
//       rideCode: row.ride_code,
//     }));

//     res.json(requests);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not fetch pending requests.' });
//   }
// });
// module.exports = router;

const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Rides
 *   description: Ride history, active rides, and pending ride requests
 */

/**
 * @swagger
 * /api/rides/history/{userId}:
 *   get:
 *     summary: Get user's completed ride history
 *     description: Returns completed rides where the user was either the rider or the driver.
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: List of completed rides.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       500:
 *         description: Could not fetch ride history.
 */
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT r.*, u.name AS driver_name, dr.rating AS rider_given_rating
       FROM rides r
       LEFT JOIN users u ON u.id = r.driver_id
       LEFT JOIN driver_rating dr ON dr.ride_id = r.id
       WHERE (r.rider_id = $1 OR r.driver_id = $1)
         AND r.status = 'completed'
       ORDER BY r.requested_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Could not fetch ride history.'
    });
  }
});

/**
 * @swagger
 * /api/rides/active/{userId}:
 *   get:
 *     summary: Get user's active ride
 *     description: Returns the current in-progress ride for a rider or driver.
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 5
 *     responses:
 *       200:
 *         description: Active ride found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: No active ride found.
 *       500:
 *         description: Could not fetch active ride.
 */
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
      return res.status(404).json({
        error: 'No active ride.'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Could not fetch active ride.'
    });
  }
});

/**
 * @swagger
 * /api/rides/pending/{driverId}:
 *   get:
 *     summary: Get pending ride requests for a driver
 *     description: Returns ride requests that match the driver's available seating capacity and have not excluded the driver.
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: List of pending ride requests.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "42"
 *                   riderId:
 *                     type: integer
 *                     example: 5
 *                   riderName:
 *                     type: string
 *                     example: Rahul Das
 *                   pickup:
 *                     type: string
 *                     example: Salt Lake
 *                   destination:
 *                     type: string
 *                     example: Park Street
 *                   pickupCoords:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                         example: 22.5726
 *                       longitude:
 *                         type: number
 *                         example: 88.3639
 *                   destinationCoords:
 *                     type: object
 *                     properties:
 *                       latitude:
 *                         type: number
 *                         example: 22.5550
 *                       longitude:
 *                         type: number
 *                         example: 88.3500
 *                   distance:
 *                     type: string
 *                     example: 8.5 km
 *                   time:
 *                     type: string
 *                     example: 25 min
 *                   price:
 *                     type: number
 *                     example: 180
 *                   carType:
 *                     type: string
 *                     example: Sedan
 *                   requestedSeats:
 *                     type: integer
 *                     example: 2
 *                   rideCode:
 *                     type: string
 *                     example: RS42
 *       500:
 *         description: Could not fetch pending requests.
 */
router.get('/pending/:driverId', async (req, res) => {
  const { driverId } = req.params;

  try {
    const driverRes = await pool.query(
      `SELECT seats FROM driver_profiles WHERE user_id = $1`,
      [driverId]
    );

    const seats = driverRes.rows[0]?.seats;

    if (!seats) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT r.*, u.name AS rider_name
       FROM rides r
       JOIN users u ON u.id = r.rider_id
       WHERE r.status = 'requested'
         AND r.seats_requested <= $1
         AND r.pickup_label <> ''
         AND r.destination_label <> ''
         AND NOT ($2 = ANY(r.excluded_driver_ids))
       ORDER BY r.requested_at DESC`,
      [seats, Number(driverId)]
    );

    const requests = result.rows.map((row) => ({
      id: String(row.id),
      riderId: row.rider_id,
      riderName: row.rider_name,
      pickup: row.pickup_label,
      destination: row.destination_label,

      pickupCoords: {
        latitude: row.pickup_lat,
        longitude: row.pickup_lng
      },

      destinationCoords: {
        latitude: row.destination_lat,
        longitude: row.destination_lng
      },

      distance: `${row.distance_km} km`,
      time: `${row.duration_minutes} min`,
      price: row.price,
      carType: row.ride_class,
      requestedSeats: row.seats_requested,
      rideCode: row.ride_code,
    }));

    res.json(requests);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Could not fetch pending requests.'
    });
  }
});

/**
 * @swagger
 * /api/rides/shared:
 *   get:
 *     summary: Find available shared rides
 *     tags: [Rides]
 *     parameters:
 *       - in: query
 *         name: pickupLat
 *         required: true
 *         schema:
 *           type: number
 *
 *       - in: query
 *         name: pickupLng
 *         required: true
 *         schema:
 *           type: number
 *
 *       - in: query
 *         name: destinationLat
 *         required: true
 *         schema:
 *           type: number
 *
 *       - in: query
 *         name: destinationLng
 *         required: true
 *         schema:
 *           type: number
 *
 *       - in: query
 *         name: distanceKm
 *         required: true
 *         schema:
 *           type: number
 *
 *       - in: query
 *         name: seatsRequested
 *         required: true
 *         schema:
 *           type: integer
 *
 *     responses:
 *       200:
 *         description: Matching shared rides
 *       400:
 *         description: Invalid search parameters
 *       500:
 *         description: Could not find shared rides
 */

router.get('/shared', async (req, res) => {
  try {
    const {
      riderId,
      pickupLat,
      pickupLng,
      destinationLat,
      destinationLng,
      distanceKm,
      seatsRequested
    } = req.query;

    // ---------------------------------------------------------
    // Validate input
    // ---------------------------------------------------------

    const pickupLatitude = Number(pickupLat);
    const pickupLongitude = Number(pickupLng);
    const destinationLatitude = Number(destinationLat);
    const destinationLongitude = Number(destinationLng);
    const requestedDistance = Number(distanceKm);
    const requestedSeats = Number(seatsRequested);

    if (
      !Number.isFinite(pickupLatitude) ||
      !Number.isFinite(pickupLongitude) ||
      !Number.isFinite(destinationLatitude) ||
      !Number.isFinite(destinationLongitude) ||
      !Number.isFinite(requestedDistance) ||
      !Number.isInteger(requestedSeats) ||
      requestedSeats <= 0
    ) {
      return res.status(400).json({
        error: 'Invalid pickup, destination, distance, or seats.'
      });
    }
    const currentUserId = Number(riderId);

    if (!Number.isInteger(currentUserId)) {
      return res.status(400).json({
        error: 'riderId is required'
      });
    }

    // ---------------------------------------------------------
    // Configuration
    // ---------------------------------------------------------

    // Existing ride can be up to 25% shorter or longer
    // than the requested route.
    const DISTANCE_TOLERANCE = 0.25;

    // ---------------------------------------------------------
    // Find compatible shared rides
    // ---------------------------------------------------------

    const result = await pool.query(
      `
      SELECT
          r.id,
          r.rider_id,
          r.driver_id,

          r.ride_class,
          r.pickup_label,
          r.pickup_lat,
          r.pickup_lng,

          r.destination_label,
          r.destination_lat,
          r.destination_lng,

          r.distance_km,
          r.duration_minutes,
          r.price,

          r.seats_requested,
          r.ride_code,

          r.status,
          r.requested_at,
          r.accepted_at,

          u.name AS rider_name,

          dp.seats AS driver_total_seats,

          du.name AS driver_name,

          -- Available seats based on this ride record
          (dp.seats - r.seats_requested) AS available_seats

      FROM rides r

      -- Rider who created the existing ride
      LEFT JOIN users u
          ON u.id = r.rider_id

      -- Driver profile
      INNER JOIN driver_profiles dp
          ON dp.user_id = r.driver_id

      -- Driver user information
      LEFT JOIN users du
          ON du.id = r.driver_id

          WHERE
          'shared_ride' = ANY(r.ride_options)
      
          AND r.driver_id IS NOT NULL
      
          AND r.status IN ('accepted', 'driver_arrived', 'in_progress'  )
      
          AND (dp.seats - r.seats_requested) >= $1

          AND r.rider_id <> $4
      
          AND r.distance_km BETWEEN
              ($2::numeric * (1 - $3::numeric))
              AND
              ($2::numeric * (1 + $3::numeric))
      
      ORDER BY
          ABS(r.distance_km - $2::numeric) ASC,
          r.requested_at ASC
      `,
      [
        requestedSeats,
        requestedDistance,
        DISTANCE_TOLERANCE,
        currentUserId
      ]
    );

    // ---------------------------------------------------------
    // Return frontend-friendly data
    // ---------------------------------------------------------

    const rides = result.rows.map((row) => ({
      id: String(row.id),

      routeFrom: row.pickup_label,
      routeTo: row.destination_label,

      leavingInMinutes: 0,

      carName: row.ride_class,

      // We don't currently have an AC column in the rides data
      // being used by this endpoint.
      ac: true,

      driverName: row.driver_name || 'Driver',

      // Rating can be added later from your rating table.
      driverRating: 0,

      seats: {
        filled: Number(row.seats_requested),
        total: Number(row.driver_total_seats),
      },

      pricePerRider: Number(row.price),

      stops: [],

      occupants: [
        {
          id: String(row.rider_id),
          name: row.rider_name || 'Rider',
          role: 'Passenger'
        }
      ],

      // Useful internally/frontend later
      availableSeats: Number(row.available_seats),

      distanceKm: Number(row.distance_km),
      durationMinutes: Number(row.duration_minutes),

      pickup: {
        label: row.pickup_label,
        latitude: Number(row.pickup_lat),
        longitude: Number(row.pickup_lng)
      },

      destination: {
        label: row.destination_label,
        latitude: Number(row.destination_lat),
        longitude: Number(row.destination_lng)
      },

      rideCode: row.ride_code,

      driverId: row.driver_id,

      status: row.status
    }));

    return res.json(rides);

  } catch (err) {
    console.error('Shared rides error:', err);

    return res.status(500).json({
      error: 'Could not find shared rides.'
    });
  }
});

/**
 * @swagger
 * /api/rides/{rideId}/join-request:
 *   post:
 *     summary: Send a request to join a shared ride
 *     description: Creates a join request for a rider. If the ride already has passengers, all passengers must approve before the request reaches the driver.
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 4
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - riderId
 *             properties:
 *               riderId:
 *                 type: integer
 *                 example: 7
 *     responses:
 *       201:
 *         description: Join request created successfully
 *       400:
 *         description: Invalid request or ride cannot accept passengers
 *       404:
 *         description: Ride not found
 *       409:
 *         description: Rider already has a pending request
 *       500:
 *         description: Could not create join request
 */
router.post('/:rideId/join-request', async (req, res) => {
  const { rideId } = req.params;
  const { riderId } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const rideIdNumber = Number(rideId);
    const riderIdNumber = Number(riderId);

    // ---------------------------------------------------------
    // 1. Validate input
    // ---------------------------------------------------------

    if (
      !Number.isInteger(rideIdNumber) ||
      !Number.isInteger(riderIdNumber)
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Invalid rideId or riderId.'
      });
    }

    // ---------------------------------------------------------
    // 2. Get ride
    // ---------------------------------------------------------

    const rideResult = await client.query(
      `
      SELECT
          r.id,
          r.driver_id,
          r.status,
          r.ride_options
      FROM rides r
      WHERE r.id = $1
      FOR UPDATE
      `,
      [rideIdNumber]
    );

    if (rideResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Ride not found.'
      });
    }

    const ride = rideResult.rows[0];

    // ---------------------------------------------------------
    // 3. Check shared ride
    // ---------------------------------------------------------

    if (
      !ride.ride_options ||
      !ride.ride_options.includes('shared_ride')
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'This is not a shared ride.'
      });
    }

    // ---------------------------------------------------------
    // 4. Check ride status
    // ---------------------------------------------------------

    if (
      ![
        'accepted',
        'driver_arrived',
        'in_progress'
      ].includes(ride.status)
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'This ride is no longer accepting passengers.'
      });
    }

    // ---------------------------------------------------------
    // 5. Driver cannot request own ride
    // ---------------------------------------------------------

    if (Number(ride.driver_id) === riderIdNumber) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Driver cannot join their own ride.'
      });
    }

    // ---------------------------------------------------------
    // 6. Check if already a passenger
    // ---------------------------------------------------------

    const participantResult = await client.query(
      `
      SELECT id
      FROM ride_participants
      WHERE ride_id = $1
        AND user_id = $2
        AND role = 'rider'
        AND status = 'active'
      `,
      [rideIdNumber, riderIdNumber]
    );

    if (participantResult.rows.length > 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'You are already a passenger in this ride.'
      });
    }

    // ---------------------------------------------------------
    // 7. Check existing request
    // ---------------------------------------------------------

    const existingRequestResult = await client.query(
      `
      SELECT id, status
      FROM ride_join_requests
      WHERE ride_id = $1
        AND rider_id = $2
      `,
      [rideIdNumber, riderIdNumber]
    );

    if (existingRequestResult.rows.length > 0) {

      const existingRequest =
        existingRequestResult.rows[0];

      if (
        existingRequest.status === 'pending_passengers' ||
        existingRequest.status === 'waiting_driver'
      ) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          error: 'You already have a pending join request.',
          requestId: existingRequest.id,
          status: existingRequest.status
        });
      }

      if (existingRequest.status === 'approved') {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: 'Your request has already been approved.'
        });
      }
    }

    // ---------------------------------------------------------
    // 8. Find active passengers
    // ---------------------------------------------------------

    const passengersResult = await client.query(
      `
      SELECT user_id
      FROM ride_participants
      WHERE ride_id = $1
        AND role = 'rider'
        AND status = 'active'
        AND user_id <> $2
      `,
      [
        rideIdNumber,
        riderIdNumber
      ]
    );

    const passengers = passengersResult.rows;

    // ---------------------------------------------------------
    // 9. Decide initial request status
    // ---------------------------------------------------------

    const initialStatus =
      passengers.length === 0
        ? 'waiting_driver'
        : 'pending_passengers';

    // ---------------------------------------------------------
    // 10. Create join request
    // ---------------------------------------------------------

    const requestResult = await client.query(
      `
      INSERT INTO ride_join_requests
      (
        ride_id,
        rider_id,
        status
      )
      VALUES
      (
        $1,
        $2,
        $3
      )
      RETURNING
        id,
        ride_id,
        rider_id,
        status,
        requested_at
      `,
      [
        rideIdNumber,
        riderIdNumber,
        initialStatus
      ]
    );

    const request = requestResult.rows[0];

    // ---------------------------------------------------------
    // 11. Create approval records
    // ---------------------------------------------------------

    for (const passenger of passengers) {

      await client.query(
        `
        INSERT INTO ride_join_request_approvals
        (
          request_id,
          passenger_id
        )
        VALUES
        (
          $1,
          $2
        )
        `,
        [
          request.id,
          passenger.user_id
        ]
      );
    }

    // ---------------------------------------------------------
    // 12. Commit
    // ---------------------------------------------------------

    await client.query('COMMIT');

    return res.status(201).json({
      message:
        passengers.length === 0
          ? 'Join request sent to driver.'
          : 'Join request sent to all passengers for approval.',

      requestId: request.id,

      status: request.status,

      passengerApprovalsRequired:
        passengers.length
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(
      'Join request error:',
      err
    );

    return res.status(500).json({
      error: 'Could not create join request.'
    });

  } finally {

    client.release();

  }
});

/**
 * @swagger
 * /api/rides/join-requests/{requestId}/passenger-response:
 *   post:
 *     summary: Approve or reject a shared ride join request
 *     description: Allows an existing passenger to approve or reject a rider's request to join a shared ride.
 *     tags: [Rides]
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 2
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - passengerId
 *               - decision
 *             properties:
 *               passengerId:
 *                 type: integer
 *                 example: 6
 *               decision:
 *                 type: string
 *                 enum:
 *                   - approved
 *                   - rejected
 *                 example: approved
 *     responses:
 *       200:
 *         description: Passenger response recorded successfully
 *       400:
 *         description: Invalid request or decision
 *       403:
 *         description: User is not a passenger in this ride
 *       404:
 *         description: Join request not found
 *       409:
 *         description: Passenger has already responded
 *       500:
 *         description: Could not process passenger response
 */
router.post('/join-requests/:requestId/passenger-response', async (req, res) => {
  const { requestId } = req.params;
  const { passengerId, decision } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const requestIdNumber = Number(requestId);
    const passengerIdNumber = Number(passengerId);

    // ---------------------------------------------------------
    // 1. Validate input
    // ---------------------------------------------------------

    if (
      !Number.isInteger(requestIdNumber) ||
      !Number.isInteger(passengerIdNumber)
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Invalid requestId or passengerId.'
      });
    }

    if (!['approved', 'rejected'].includes(decision)) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: "Decision must be either 'approved' or 'rejected'."
      });
    }

    // ---------------------------------------------------------
    // 2. Get the join request
    // ---------------------------------------------------------

    const requestResult = await client.query(
      `
      SELECT
          rjr.id,
          rjr.ride_id,
          rjr.rider_id,
          rjr.status
      FROM ride_join_requests rjr
      WHERE rjr.id = $1
      FOR UPDATE
      `,
      [requestIdNumber]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Join request not found.'
      });
    }

    const joinRequest = requestResult.rows[0];

    // ---------------------------------------------------------
    // 3. Request must still be waiting for passengers
    // ---------------------------------------------------------

    if (joinRequest.status !== 'pending_passengers') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'This join request is no longer waiting for passenger approval.',
        status: joinRequest.status
      });
    }

    // ---------------------------------------------------------
    // 4. Verify this user is an active passenger
    // ---------------------------------------------------------

    const passengerResult = await client.query(
      `
      SELECT id
      FROM ride_participants
      WHERE ride_id = $1
        AND user_id = $2
        AND role = 'rider'
        AND status = 'active'
      `,
      [
        joinRequest.ride_id,
        passengerIdNumber
      ]
    );

    if (passengerResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'You are not an active passenger in this ride.'
      });
    }

    // ---------------------------------------------------------
    // 5. Get this passenger's approval record
    // ---------------------------------------------------------

    const approvalResult = await client.query(
      `
      SELECT
          id,
          status
      FROM ride_join_request_approvals
      WHERE request_id = $1
        AND passenger_id = $2
      FOR UPDATE
      `,
      [
        requestIdNumber,
        passengerIdNumber
      ]
    );

    if (approvalResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'You are not required to approve this request.'
      });
    }

    const approval = approvalResult.rows[0];

    // ---------------------------------------------------------
    // 6. Check if passenger already responded
    // ---------------------------------------------------------

    if (approval.status !== 'pending') {
      await client.query('ROLLBACK');

      return res.status(409).json({
        error: 'You have already responded to this join request.',
        status: approval.status
      });
    }

    // ---------------------------------------------------------
    // 7. REJECTION
    // ---------------------------------------------------------

    if (decision === 'rejected') {

      await client.query(
        `
        UPDATE ride_join_request_approvals
        SET
            status = 'rejected',
            responded_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [approval.id]
      );

      // One rejection immediately rejects the whole request.
      await client.query(
        `
        UPDATE ride_join_requests
        SET
            status = 'rejected',
            responded_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [requestIdNumber]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        message: 'Join request rejected.',
        requestId: requestIdNumber,
        status: 'rejected'
      });
    }

    // ---------------------------------------------------------
    // 8. APPROVAL
    // ---------------------------------------------------------

    await client.query(
      `
      UPDATE ride_join_request_approvals
      SET
          status = 'approved',
          responded_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [approval.id]
    );

    // ---------------------------------------------------------
    // 9. Check whether other passengers are still pending
    // ---------------------------------------------------------

    const pendingResult = await client.query(
      `
      SELECT COUNT(*)::int AS pending_count
      FROM ride_join_request_approvals
      WHERE request_id = $1
        AND status = 'pending'
      `,
      [requestIdNumber]
    );

    const pendingCount = pendingResult.rows[0].pending_count;

    // ---------------------------------------------------------
    // 10. If everyone approved, send request to driver
    // ---------------------------------------------------------

    if (pendingCount === 0) {

      await client.query(
        `
        UPDATE ride_join_requests
        SET
            status = 'waiting_driver'
        WHERE id = $1
        `,
        [requestIdNumber]
      );

      await client.query('COMMIT');

      return res.status(200).json({
        message: 'All passengers approved. Join request sent to driver.',
        requestId: requestIdNumber,
        status: 'waiting_driver'
      });
    }

    // ---------------------------------------------------------
    // 11. Still waiting for other passengers
    // ---------------------------------------------------------

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Passenger approval recorded. Waiting for other passengers.',
      requestId: requestIdNumber,
      status: 'pending_passengers',
      pendingPassengerApprovals: pendingCount
    });

  } catch (err) {

    await client.query('ROLLBACK');

    console.error(
      'Passenger response error:',
      err
    );

    return res.status(500).json({
      error: 'Could not process passenger response.'
    });

  } finally {

    client.release();

  }
});

module.exports = router;