-- Add an `encrypted` flag to user_settings so we can tell at read time
-- whether the gmi_api_key column holds ciphertext (new format) or
-- plaintext (legacy / pre-encryption rows).
--
-- The Worker code defaults to treating missing flags as legacy
-- plaintext and will re-encrypt on next save.

ALTER TABLE user_settings ADD COLUMN key_encrypted INTEGER NOT NULL DEFAULT 0;
