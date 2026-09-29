const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
async function main() {
  try {
    console.log("\n========== RIDE JOIN REQUESTS ==========\n");
    const requests = await pool.query(`
      SELECT *
      FROM ride_join_requests
      ORDER BY id;
    `);
    console.table(requests.rows);

    console.log("\n========== JOIN REQUEST APPROVALS ==========\n");
    const approvals = await pool.query(`
      SELECT *
      FROM ride_join_request_approvals
      ORDER BY id;
    `);
    console.table(approvals.rows);

    console.log("\n========== RIDE PARTICIPANTS ==========\n");
    const participants = await pool.query(`
      SELECT *
      FROM ride_participants
      ORDER BY ride_id, id;
    `);
    console.table(participants.rows);

    console.log("\n========== RIDES ==========\n");
    const rides = await pool.query(`
      SELECT *
      FROM rides
      ORDER BY id;
    `);
    console.table(rides.rows);
  } catch (error) {
    console.error("❌ DB ERROR:", error);
  } finally {
    await pool.end();
  }
}
main();

