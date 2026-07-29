import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Supabase requires SSL for external connections
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export async function testDbConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Postgres connected:", result.rows[0].now);
  } catch (err) {
    console.error("❌ Postgres connection failed:", err);
  }
}
