const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await pool.query(`
      TRUNCATE TABLE
        ride_join_request_approvals,
        ride_join_requests,
        conversation_participants,
        messages,
        conversations,
        ride_participants,
        rides
      RESTART IDENTITY CASCADE;
    `);

    console.log("✅ RouteShare test data truncated successfully.");
  } catch (error) {
    console.error("❌ TRUNCATE failed:", error);
  } finally {
    await pool.end();
  }
}

main();
