-- vozen connect: one row per registered machine. Deliberately much smaller
-- than bb connect's users/servers/machines schema — vozen connect has no
-- account system, so there's nothing to link a device to besides its own
-- handle and credential.
CREATE TABLE devices (
    handle TEXT PRIMARY KEY,
    credential_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
);
