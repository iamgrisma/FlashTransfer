-- Migration: Add Browser Locking to fileshare
-- Description: Adds device ID tracking and 7-day expiry for browser-locked P2P connections

ALTER TABLE fileshare 
  ADD COLUMN initiator_device_id TEXT,
  ADD COLUMN joiner_device_id TEXT,
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN reusable_until TIMESTAMPTZ;

-- Index for efficient cleanup queries
CREATE INDEX idx_fileshare_reusable_until ON fileshare(reusable_until);

-- Index for device ID lookups
CREATE INDEX idx_fileshare_devices ON fileshare(initiator_device_id, joiner_device_id);

-- Update existing records to set reusable_until based on expires_at
UPDATE fileshare 
SET reusable_until = expires_at 
WHERE reusable_until IS NULL;

COMMENT ON COLUMN fileshare.initiator_device_id IS 'Browser fingerprint of connection creator';
COMMENT ON COLUMN fileshare.joiner_device_id IS 'Browser fingerprint of connection joiner (locked on first join)';
COMMENT ON COLUMN fileshare.locked_at IS 'Timestamp when connection was locked by joiner';
COMMENT ON COLUMN fileshare.reusable_until IS 'Connection expiry for reconnection (7 days from lock)';
