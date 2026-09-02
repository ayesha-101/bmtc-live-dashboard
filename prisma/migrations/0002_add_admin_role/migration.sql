-- Split "manager" into two separate jobs: the BM (manager) keeps the
-- read-only dashboard, and a new "admin" role owns accounts + security
-- and never sees business data. Adding the enum value is safe inside
-- Prisma's migration transaction on Postgres 12+ as long as the new value
-- isn't used in the same transaction (it isn't).
ALTER TYPE "UserRole" ADD VALUE 'admin';
