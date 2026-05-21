-- ============================================================
-- Migration: Create videos table for landing page
-- Run this in Supabase SQL Editor after 001_create_missing_tables.sql
-- ============================================================

-- Drop if exists (for idempotency)
DROP TABLE IF EXISTS videos CASCADE;

-- Create videos table
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    youtube_id TEXT NOT NULL,           -- e.g. 'MLDChN3C1bI'
    sort_order INTEGER DEFAULT 0,       -- display order in playlist
    active BOOLEAN DEFAULT true,        -- show on landing page?
    section TEXT DEFAULT 'landing',     -- 'landing' or other future sections
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Anyone can read active videos (public)
CREATE POLICY "Public can read active videos"
    ON videos FOR SELECT
    USING (active = true);

-- Only admins can manage videos
CREATE POLICY "Admin full access to videos"
    ON videos FOR ALL
    USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Insert the 3 existing YouTube videos
INSERT INTO videos (title, youtube_id, sort_order, active) VALUES
('Psychedelic Research & Reform', 'MLDChN3C1bI', 1, true),
('Psychedelics for Stress Relief', '0b-w8j6lIKQ', 2, true),
('CNN: Psychedelic Therapy', 'MOBdkkeXLto', 3, true);
