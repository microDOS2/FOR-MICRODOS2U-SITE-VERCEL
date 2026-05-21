-- ============================================================
-- Migration: Create videos table for self-hosted landing page videos
-- Run this in Supabase SQL Editor after 001_create_missing_tables.sql
-- ============================================================

-- Drop if exists (for idempotency)
DROP TABLE IF EXISTS videos CASCADE;

-- Create videos table for self-hosted files
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    storage_path TEXT NOT NULL,         -- Supabase Storage path, e.g. 'videos/microDOS2-video-1.mp4'
    file_size BIGINT DEFAULT 0,         -- file size in bytes
    mime_type TEXT DEFAULT 'video/mp4', -- video/mp4, video/webm, etc.
    sort_order INTEGER DEFAULT 0,       -- display order in carousel
    active BOOLEAN DEFAULT true,        -- show on landing page?
    section TEXT DEFAULT 'landing',     -- 'landing' or other future sections
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Anyone can read active videos (public)
DROP POLICY IF EXISTS "Public can read active videos" ON videos;
CREATE POLICY "Public can read active videos"
    ON videos FOR SELECT
    USING (active = true);

-- Only admins can manage videos
DROP POLICY IF EXISTS "Admin full access to videos" ON videos;
CREATE POLICY "Admin full access to videos"
    ON videos FOR ALL
    USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));
