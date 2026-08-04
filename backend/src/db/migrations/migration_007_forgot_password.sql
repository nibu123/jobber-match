-- migration_007_forgot_password.sql
-- Adds a `purpose` column to the existing otp_codes table so signup-verification
-- OTPs and password-reset OTPs never collide with each other.
-- Safe to run on the live DB — existing rows default to 'signup' (their current behavior).

ALTER TABLE otp_codes
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'signup';

-- Speeds up the "most recent active OTP for this email+purpose" lookups
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_purpose
  ON otp_codes (email, purpose, consumed);
