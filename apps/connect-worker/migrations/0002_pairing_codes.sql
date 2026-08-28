-- Short-lived codes minted by the register.<apex> web login flow and
-- redeemed by a vozen server (POST /api/connect/redeem) — matches bb's own
-- pairing model: the credential is only ever handed to whoever redeems the
-- code, never shown in a browser tab or passed through a URL.
CREATE TABLE pairing_codes (
    code TEXT PRIMARY KEY,
    handle TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
);
