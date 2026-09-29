const express = require('express');
const pool = require('../db');

const router = express.Router();



/**
 * @swagger
 * /api/chat/debug/users:
 *   get:
 *     summary: Get all users
 *     description: Returns user IDs, names and emails for debugging.
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 7
 *                   name:
 *                     type: string
 *                     example: suparna das
 *                   email:
 *                     type: string
 *                     example: su@gmail.com
 *       500:
 *         description: Failed to fetch users
 */
router.get('/debug/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
          id,
          name,
          email
      FROM users
      ORDER BY id ASC;
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);

    res.status(500).json({
      error: 'Could not fetch users',
      details: error.message
    });
  }
});//created bcz layerbase query console is not working 

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Rider-only ride chat APIs
 */

/**
 * @swagger
 * /api/chat/ride/{rideId}:
 *   get:
 *     summary: Get or create the rider chat for a ride
 *     description: |
 *       Returns the rider-only conversation for a ride.
 *       The driver is never added as a conversation participant.
 *       Active riders are automatically added to the conversation.
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Ride chat information
 *       400:
 *         description: Invalid ride ID
 *       404:
 *         description: Ride not found
 *       500:
 *         description: Could not create or fetch ride chat
 */
router.get('/ride/:rideId', async (req, res) => {
  const rideId = Number(req.params.rideId);

  if (!Number.isInteger(rideId) || rideId <= 0) {
    return res.status(400).json({
      error: 'Invalid rideId.'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ---------------------------------------------------------
    // 1. Check that the ride exists
    // ---------------------------------------------------------
    const rideResult = await client.query(
      `
      SELECT
        id,
        driver_id,
        status
      FROM rides
      WHERE id = $1
      `,
      [rideId]
    );

    if (rideResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Ride not found.'
      });
    }

    const ride = rideResult.rows[0];

    // ---------------------------------------------------------
    // 2. Find existing ride conversation
    // ---------------------------------------------------------
    let conversationResult = await client.query(
      `
      SELECT
        id,
        type,
        ride_id,
        user1_id,
        user2_id,
        created_at,
        closed_at
      FROM conversations
      WHERE ride_id = $1
      LIMIT 1
      `,
      [rideId]
    );

    let conversation;

    // ---------------------------------------------------------
    // 3. Create conversation if it doesn't exist
    // ---------------------------------------------------------
    if (conversationResult.rows.length === 0) {
      const conversationType =
        process.env.RIDE_CONVERSATION_TYPE || 'group';

      conversationResult = await client.query(
        `
        INSERT INTO conversations
          (type, ride_id)
        VALUES
          ($1, $2)
        RETURNING
          id,
          type,
          ride_id,
          user1_id,
          user2_id,
          created_at,
          closed_at
        `,
        [conversationType, rideId]
      );

      conversation = conversationResult.rows[0];
    } else {
      conversation = conversationResult.rows[0];
    }

    // ---------------------------------------------------------
    // 4. Get ONLY active riders
    // ---------------------------------------------------------
    const ridersResult = await client.query(
      `
      SELECT
        rp.user_id,
        u.name,
        u.email
      FROM ride_participants rp
      JOIN users u
        ON u.id = rp.user_id
      WHERE rp.ride_id = $1
        AND rp.role = 'rider'
        AND rp.status = 'active'
      ORDER BY rp.user_id
      `,
      [rideId]
    );

    const riders = ridersResult.rows;

    // ---------------------------------------------------------
    // 5. Add riders to conversation_participants
    // ---------------------------------------------------------
    for (const rider of riders) {
      await client.query(
        `
        INSERT INTO conversation_participants
          (conversation_id, user_id, active)
        VALUES
          ($1, $2, true)
        ON CONFLICT (conversation_id, user_id)
        DO UPDATE SET
          active = true,
          left_at = NULL
        `,
        [conversation.id, rider.user_id]
      );
    }

    // ---------------------------------------------------------
    // 6. Explicitly make sure driver is NOT a participant
    // ---------------------------------------------------------
    if (ride.driver_id) {
      await client.query(
        `
        UPDATE conversation_participants
        SET
          active = false,
          left_at = COALESCE(left_at, CURRENT_TIMESTAMP)
        WHERE conversation_id = $1
          AND user_id = $2
        `,
        [conversation.id, ride.driver_id]
      );
    }

    // ---------------------------------------------------------
    // 7. Fetch final participant list
    // ---------------------------------------------------------
    const participantsResult = await client.query(
      `
      SELECT
        cp.user_id,
        u.name,
        u.email,
        cp.joined_at,
        cp.left_at,
        cp.active
      FROM conversation_participants cp
      JOIN users u
        ON u.id = cp.user_id
      WHERE cp.conversation_id = $1
        AND cp.active = true
      ORDER BY cp.joined_at ASC
      `,
      [conversation.id]
    );

    await client.query('COMMIT');

    return res.json({
      success: true,

      conversation: {
        id: conversation.id,
        type: conversation.type,
        rideId: conversation.ride_id,
        createdAt: conversation.created_at,
        closedAt: conversation.closed_at
      },

      participants: participantsResult.rows,

      // Useful for debugging:
      driverId: ride.driver_id
    });

  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Get/create ride chat error:', err);

    return res.status(500).json({
      error: 'Could not create or fetch ride chat.',
      details: err.message
    });

  } finally {
    client.release();
  }
});


/**
 * @swagger
 * /api/chat/{conversationId}/messages:
 *   get:
 *     summary: Get messages from a rider-only conversation
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: List of chat messages
 *       400:
 *         description: Invalid conversation ID
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Could not fetch messages
 */
router.get('/:conversationId/messages', async (req, res) => {
  const conversationId = Number(req.params.conversationId);

  if (!Number.isInteger(conversationId) || conversationId <= 0) {
    return res.status(400).json({
      error: 'Invalid conversationId.'
    });
  }

  try {
    // ---------------------------------------------------------
    // Check conversation
    // ---------------------------------------------------------
    const conversationResult = await pool.query(
      `
      SELECT
        id,
        type,
        ride_id,
        created_at,
        closed_at
      FROM conversations
      WHERE id = $1
      `,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversation not found.'
      });
    }

    const conversation = conversationResult.rows[0];

    // ---------------------------------------------------------
    // Fetch messages
    // ---------------------------------------------------------
    const messagesResult = await pool.query(
      `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.name AS sender_name,
        m.message_type,
        m.content,
        m.file_url,
        m.created_at,
        m.read_at
      FROM messages m
      JOIN users u
        ON u.id = m.sender_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [conversationId]
    );

    return res.json({
      success: true,

      conversation,

      messages: messagesResult.rows
    });

  } catch (err) {
    console.error('Get chat messages error:', err);

    return res.status(500).json({
      error: 'Could not fetch messages.'
    });
  }
});


/**
 * @swagger
 * /api/chat/{conversationId}/messages:
 *   post:
 *     summary: Send a message to a rider-only conversation
 *     description: Sends a message and stores it permanently in PostgreSQL.
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - senderId
 *               - content
 *             properties:
 *               senderId:
 *                 type: integer
 *                 example: 7
 *               messageType:
 *                 type: string
 *                 enum:
 *                   - text
 *                   - image
 *                   - location
 *                   - file
 *                   - audio
 *                 example: text
 *               content:
 *                 type: string
 *                 example: Hey everyone!
 *               fileUrl:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *     responses:
 *       201:
 *         description: Message created successfully
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Sender is not an active rider in this chat
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Could not send message
 */
router.post('/:conversationId/messages', async (req, res) => {
  const conversationId = Number(req.params.conversationId);

  const {
    senderId,
    messageType = 'text',
    content,
    fileUrl = null
  } = req.body;

  const senderIdNumber = Number(senderId);

  // ---------------------------------------------------------
  // Validate IDs
  // ---------------------------------------------------------
  if (
    !Number.isInteger(conversationId) ||
    conversationId <= 0
  ) {
    return res.status(400).json({
      error: 'Invalid conversationId.'
    });
  }

  if (
    !Number.isInteger(senderIdNumber) ||
    senderIdNumber <= 0
  ) {
    return res.status(400).json({
      error: 'Invalid senderId.'
    });
  }

  // ---------------------------------------------------------
  // Validate message type
  // ---------------------------------------------------------
  const allowedMessageTypes = [
    'text',
    'image',
    'location',
    'file',
    'audio'
  ];

  if (!allowedMessageTypes.includes(messageType)) {
    return res.status(400).json({
      error: 'Invalid messageType.',
      allowedMessageTypes
    });
  }

  // ---------------------------------------------------------
  // Validate content/fileUrl
  // ---------------------------------------------------------
  const cleanContent =
    typeof content === 'string'
      ? content.trim()
      : null;

  if (
    messageType === 'text' &&
    !cleanContent
  ) {
    return res.status(400).json({
      error: 'Text message cannot be empty.'
    });
  }

  if (
    messageType !== 'text' &&
    !cleanContent &&
    !fileUrl
  ) {
    return res.status(400).json({
      error: 'Message must contain content or fileUrl.'
    });
  }

  try {
    // ---------------------------------------------------------
    // 1. Check conversation
    // ---------------------------------------------------------
    const conversationResult = await pool.query(
      `
      SELECT
        id,
        type,
        ride_id,
        closed_at
      FROM conversations
      WHERE id = $1
      `,
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Conversation not found.'
      });
    }

    const conversation = conversationResult.rows[0];

    // ---------------------------------------------------------
    // 2. Make sure sender is an ACTIVE RIDER
    // ---------------------------------------------------------
    const participantResult = await pool.query(
      `
      SELECT
        cp.user_id
      FROM conversation_participants cp
      JOIN ride_participants rp
        ON rp.user_id = cp.user_id
      WHERE cp.conversation_id = $1
        AND cp.user_id = $2
        AND cp.active = true
        AND rp.ride_id = $3
        AND rp.role = 'rider'
        AND rp.status = 'active'
      LIMIT 1
      `,
      [
        conversationId,
        senderIdNumber,
        conversation.ride_id
      ]
    );

    if (participantResult.rows.length === 0) {
      return res.status(403).json({
        error: 'You are not an active rider in this chat.'
      });
    }

    // ---------------------------------------------------------
    // 3. Insert message
    // ---------------------------------------------------------
    const messageResult = await pool.query(
      `
      INSERT INTO messages
        (
          conversation_id,
          sender_id,
          message_type,
          content,
          file_url
        )
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING
        id,
        conversation_id,
        sender_id,
        message_type,
        content,
        file_url,
        created_at,
        read_at
      `,
      [
        conversationId,
        senderIdNumber,
        messageType,
        cleanContent,
        fileUrl
      ]
    );

    const message = messageResult.rows[0];

    // ---------------------------------------------------------
    // 4. Get sender name
    // ---------------------------------------------------------
    const senderResult = await pool.query(
      `
      SELECT name
      FROM users
      WHERE id = $1
      `,
      [senderIdNumber]
    );

    return res.status(201).json({
      success: true,

      message: {
        ...message,
        sender_name: senderResult.rows[0]?.name || null
      }
    });

  } catch (err) {
    console.error('Send chat message error:', err);

    return res.status(500).json({
      error: 'Could not send message.'
    });
  }
});

/**
 * @swagger
 * /api/chat/debug/conversation-type:
 *   get:
 *     summary: Debug conversations type constraint
 *     description: Returns the PostgreSQL CHECK constraint definition for the conversations.type column.
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: Conversation type constraint retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   conname:
 *                     type: string
 *                     example: conversations_type_check
 *                   definition:
 *                     type: string
 *                     example: CHECK ((type = ANY (ARRAY['direct'::character varying, 'group'::character varying])))
 *       500:
 *         description: Failed to retrieve constraint
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 details:
 *                   type: string
 */
router.get('/debug/conversation-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
          conname,
          pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conname = 'conversations_type_check';
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Constraint check error:', error);

    res.status(500).json({
      error: 'Could not fetch conversation type constraint',
      details: error.message
    });
  }
});

module.exports = router;