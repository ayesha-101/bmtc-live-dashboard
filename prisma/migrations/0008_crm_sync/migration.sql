-- CRM ingestion.
--
-- Deals can now originate from an external CRM instead of the in-app form.
-- `external_id` is the CRM's own record id and is UNIQUE, so the same
-- record arriving twice (a retry, a re-fired webhook, an edit) updates the
-- existing row instead of creating a duplicate. NULL for manually entered
-- deals, and Postgres allows many NULLs in a UNIQUE column.
ALTER TABLE "deals" ADD COLUMN "external_id" TEXT;
ALTER TABLE "deals" ADD COLUMN "external_source" TEXT NOT NULL DEFAULT '';
-- Where the project is. Only Abu Dhabi projects are accepted from the CRM,
-- and this stores what the CRM actually said so the filter is auditable.
ALTER TABLE "deals" ADD COLUMN "location" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "deals_external_id_key" ON "deals"("external_id");

-- Every inbound CRM record, accepted or not, with the reason. This is the
-- integration's black box: if a salesperson says "my LPO isn't showing",
-- the answer is one query away. Payload is kept so a rejected record can
-- be replayed once the cause is fixed (e.g. the account was created).
CREATE TABLE "crm_sync_log" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "external_id" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "sales_person" TEXT NOT NULL DEFAULT '',
    "deal_id" INTEGER,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_sync_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_sync_log_created_at_idx" ON "crm_sync_log"("created_at");
CREATE INDEX "crm_sync_log_status_idx" ON "crm_sync_log"("status");
