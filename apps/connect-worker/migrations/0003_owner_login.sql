-- Bind each handle (and each pending pairing code) to the GitHub login that
-- registered it, so a visitor session can only reach its own devices.
-- Nullable: rows claimed before this migration have no recorded owner and
-- must be backfilled by hand (or re-registered) before the ownership gate
-- lets anyone in.
ALTER TABLE devices ADD COLUMN owner_login TEXT;
ALTER TABLE pairing_codes ADD COLUMN owner_login TEXT;
