-- Migration: extended LGBTQ+-focused profile fields on profiles table

-- Identity
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beyond_binary BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_tags TEXT[] DEFAULT '{}';

-- Relationship preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS relationship_structure TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interested_in TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_pref_min INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_pref_max INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS distance_pref_km INTEGER;

-- Interests / tags
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[] DEFAULT '{}';

-- Lifestyle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS smoking TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drinking TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS drug_friendly TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kids TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS star_sign TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation TEXT;

-- Location & languages
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hometown TEXT;

-- Bio & prompts
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prompts JSONB DEFAULT '[]';

-- Safety & privacy
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_blur BOOLEAN DEFAULT FALSE;

-- Trust/community
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS community_tags TEXT[] DEFAULT '{}';

-- Indexes for filters used in /browse (relationship structure, height range)
CREATE INDEX IF NOT EXISTS idx_profiles_relationship_structure ON profiles(relationship_structure);
CREATE INDEX IF NOT EXISTS idx_profiles_height_cm ON profiles(height_cm);

-- GIN indexes for array-based filtering (interests overlap, interested_in match)
CREATE INDEX IF NOT EXISTS idx_profiles_interests ON profiles USING GIN (interests);
CREATE INDEX IF NOT EXISTS idx_profiles_interested_in ON profiles USING GIN (interested_in);