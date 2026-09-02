-- Sign-in now uses the person's email address instead of a made-up
-- username. Renaming the column (rather than adding a new one) keeps every
-- existing account, its password, and its unique constraint intact — the
-- values just need updating to real email addresses.
ALTER TABLE "users" RENAME COLUMN "username" TO "email";
ALTER INDEX "users_username_key" RENAME TO "users_email_key";
