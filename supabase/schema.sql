-- FlashTransfer Database Schema
-- Updated: 2025-12-20

-- ============================================================================
-- MAIN TABLES
-- ============================================================================

-- File sharing sessions table
CREATE TABLE IF NOT EXISTS fileshare (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code VARCHAR(5) NOT NULL UNIQUE,
  p2p_offer JSONB NOT NULL,
  transfer_mode VARCHAR(20) DEFAULT 'p2p' CHECK (transfer_mode IN ('p2p', 'broadcast', 'bidirectional')),
  connection_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aggregate transfer statistics (platform-wide)
CREATE TABLE IF NOT EXISTS transfer_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_files_transferred INTEGER DEFAULT 0,
  total_bytes_transferred BIGINT DEFAULT 0,
  file_types JSONB DEFAULT '{}', -- {"pdf": 50, "image": 120, "video": 30}
  transfer_modes JSONB DEFAULT '{}', -- {"p2p": 100, "broadcast": 50, "bidirectional": 75}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- Optional: Session events for multi-user analytics
CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES fileshare(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'receiver_connected', 'file_downloaded', 'transfer_complete'
  metadata JSONB DEFAULT '{}', -- Additional event data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_fileshare_short_code ON fileshare(short_code);
CREATE INDEX IF NOT EXISTS idx_fileshare_expires_at ON fileshare(expires_at);
CREATE INDEX IF NOT EXISTS idx_fileshare_created_at ON fileshare(created_at);
CREATE INDEX IF NOT EXISTS idx_transfer_stats_date ON transfer_stats(date);
CREATE INDEX IF NOT EXISTS idx_session_events_share_id ON session_events(share_id);
CREATE INDEX IF NOT EXISTS idx_session_events_created_at ON session_events(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE fileshare ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

-- fileshare policies: Anyone can read and create, but not update/delete
CREATE POLICY "Allow public read access to fileshare"
  ON fileshare FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to fileshare"
  ON fileshare FOR INSERT
  WITH CHECK (true);

-- transfer_stats policies: Anyone can read, only service role can write
CREATE POLICY "Allow public read access to transfer_stats"
  ON transfer_stats FOR SELECT
  USING (true);

CREATE POLICY "Allow service role to insert/update transfer_stats"
  ON transfer_stats FOR ALL
  USING (auth.role() = 'service_role');

-- session_events policies: Anyone can read and insert
CREATE POLICY "Allow public read access to session_events"
  ON session_events FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to session_events"
  ON session_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update transfer statistics
CREATE OR REPLACE FUNCTION update_transfer_stats(
  p_files_transferred INTEGER,
  p_bytes_transferred BIGINT,
  p_file_types JSONB,
  p_transfer_mode VARCHAR(20)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_current_file_types JSONB;
  v_current_transfer_modes JSONB;
  v_updated_file_types JSONB;
  v_updated_transfer_modes JSONB;
  v_key TEXT;
  v_value INTEGER;
BEGIN
  -- Insert or get current values
  INSERT INTO transfer_stats (date, total_files_transferred, total_bytes_transferred, file_types, transfer_modes)
  VALUES (v_today, 0, 0, '{}', '{}')
  ON CONFLICT (date) DO NOTHING;

  -- Get current values
  SELECT file_types, transfer_modes INTO v_current_file_types, v_current_transfer_modes
  FROM transfer_stats
  WHERE date = v_today;

  -- Merge file_types
  v_updated_file_types := COALESCE(v_current_file_types, '{}'::JSONB);
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_file_types)
  LOOP
    v_updated_file_types := jsonb_set(
      v_updated_file_types,
      ARRAY[v_key],
      to_jsonb(COALESCE((v_updated_file_types->>v_key)::INTEGER, 0) + v_value::INTEGER)
    );
  END LOOP;

  -- Merge transfer_modes
  v_updated_transfer_modes := COALESCE(v_current_transfer_modes, '{}'::JSONB);
  v_updated_transfer_modes := jsonb_set(
    v_updated_transfer_modes,
    ARRAY[p_transfer_mode],
    to_jsonb(COALESCE((v_updated_transfer_modes->>p_transfer_mode)::INTEGER, 0) + p_files_transferred)
  );

  -- Update the record
  UPDATE transfer_stats
  SET
    total_files_transferred = total_files_transferred + p_files_transferred,
    total_bytes_transferred = total_bytes_transferred + p_bytes_transferred,
    file_types = v_updated_file_types,
    transfer_modes = v_updated_transfer_modes,
    updated_at = NOW()
  WHERE date = v_today;
END;
$$;

-- Function to cleanup expired sessions (call this periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM fileshare
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- CLEANUP OLD DATA (Optional - Run periodically)
-- ============================================================================

-- Delete session events older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM session_events
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- SAMPLE DATA FOR TESTING (Optional - Remove in production)
-- ============================================================================

-- Uncomment to insert sample aggregate stats
-- INSERT INTO transfer_stats (date, total_files_transferred, total_bytes_transferred, file_types, transfer_modes)
-- VALUES 
--   (CURRENT_DATE, 150, 5368709120, '{"pdf": 50, "image": 60, "video": 40}', '{"p2p": 100, "broadcast": 50}')
-- ON CONFLICT (date) DO NOTHING;
