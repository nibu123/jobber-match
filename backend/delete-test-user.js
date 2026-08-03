require("dotenv").config();
const { Pool } = require("pg");

const emailToDelete = process.argv[2];
if (!emailToDelete) {
  console.error("Usage: node delete-test-user.js <email>");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [emailToDelete]);
  if (userResult.rows.length === 0) {
    console.log(`No user found with email ${emailToDelete}`);
    await pool.end();
    return;
  }
  const userId = userResult.rows[0].id;

  await pool.query("DELETE FROM profiles WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);

  console.log(`SUCCESS: deleted user ${emailToDelete} (id: ${userId}) and their profile`);
  await pool.end();
}

run().catch((err) => {
  console.error("Delete failed:", err.message);
  process.exit(1);
});
