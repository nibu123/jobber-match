/**
 * One-time script to create the first super_admin.
 * Run locally with: npx ts-node scripts/create-admin.ts
 *
 * Needs DATABASE_URL env var pointing to your Supabase Postgres instance
 * (same one your backend uses -- copy from Railway env vars).
 */
import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

async function main() {
  const email = (await ask('Admin email: ')).trim().toLowerCase();
  const name = (await ask('Admin name: ')).trim();
  const password = await ask('Admin password: ');
  rl.close();

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name, role) VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3`,
    [email, passwordHash, name]
  );

  console.log(`âœ… Admin created/updated: ${email}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to create admin:', err);
  process.exit(1);
});
