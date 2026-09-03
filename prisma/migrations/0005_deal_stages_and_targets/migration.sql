-- Split the single "amount" record into three real commercial stages, each
-- with its own reference, value, GP and date (a 500k quote can be awarded
-- at 480k and invoiced at 475k), add the Estimation team's own enquiry
-- columns, and introduce annual revenue/GP targets per department.
--
-- Written by hand so existing rows survive: old values are backfilled into
-- the quotation/LPO/invoice columns before the old ones are dropped.

-- 1. New stage enum (replaces LpoStatus).
CREATE TYPE "DealStage" AS ENUM ('enquiry', 'quoted', 'lpo_received', 'pending_invoice', 'invoiced', 'lost');

-- 2. Rename the table and its audit foreign key to match the new model.
ALTER TABLE "lpos" RENAME TO "deals";
ALTER TABLE "audit_log" RENAME COLUMN "lpo_id" TO "deal_id";

-- 3. Enquiry columns from the Estimation sheet.
ALTER TABLE "deals" ADD COLUMN "enquiry_date"   TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "customer"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "deals" ADD COLUMN "sales_person"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "deals" ADD COLUMN "de_responsible" TEXT NOT NULL DEFAULT '';

-- 4. Per-stage reference / value / GP / date.
ALTER TABLE "deals" ADD COLUMN "quote_ref"     TEXT;
ALTER TABLE "deals" ADD COLUMN "quote_value"   DECIMAL(14,2);
ALTER TABLE "deals" ADD COLUMN "quote_gp"      DECIMAL(14,2);
ALTER TABLE "deals" ADD COLUMN "quote_date"    TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "lpo_ref"       TEXT;
ALTER TABLE "deals" ADD COLUMN "lpo_value"     DECIMAL(14,2);
ALTER TABLE "deals" ADD COLUMN "lpo_gp"        DECIMAL(14,2);
ALTER TABLE "deals" ADD COLUMN "lpo_date"      TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "invoice_ref"   TEXT;
ALTER TABLE "deals" ADD COLUMN "invoice_value" DECIMAL(14,2);
ALTER TABLE "deals" ADD COLUMN "invoice_gp"    DECIMAL(14,2);
ALTER TABLE "deals" ADD COLUMN "invoice_date"  TIMESTAMP(3);
ALTER TABLE "deals" ADD COLUMN "lost_reason"   TEXT;
ALTER TABLE "deals" ADD COLUMN "stage" "DealStage" NOT NULL DEFAULT 'enquiry';

-- 5. Backfill any existing rows from the old single-amount shape.
UPDATE "deals" SET
  "enquiry_date" = COALESCE("enquiry_date", "created_at"),
  "quote_value"  = "amount",
  "quote_gp"     = "margin",
  "quote_date"   = "created_at",
  "lpo_ref"      = "customer_lpo_ref",
  "invoice_date" = "invoiced_at",
  "stage" = CASE "status"::text
    WHEN 'quoted'          THEN 'quoted'::"DealStage"
    WHEN 'converted_lpo'   THEN 'lpo_received'::"DealStage"
    WHEN 'pending_invoice' THEN 'pending_invoice'::"DealStage"
    WHEN 'invoiced'        THEN 'invoiced'::"DealStage"
    WHEN 'lost'            THEN 'lost'::"DealStage"
    ELSE 'enquiry'::"DealStage"
  END;
-- Rows that had already been awarded/invoiced carry their value forward.
UPDATE "deals" SET "lpo_value" = "quote_value"
  WHERE "stage" IN ('lpo_received', 'pending_invoice', 'invoiced');
UPDATE "deals" SET "invoice_value" = "quote_value", "invoice_gp" = "quote_gp"
  WHERE "stage" = 'invoiced';

-- 6. enquiry_date is required once backfilled.
ALTER TABLE "deals" ALTER COLUMN "enquiry_date" SET NOT NULL;

-- 7. Drop the superseded columns and the old enum.
ALTER TABLE "deals" DROP COLUMN "amount";
ALTER TABLE "deals" DROP COLUMN "margin";
ALTER TABLE "deals" DROP COLUMN "customer_lpo_ref";
ALTER TABLE "deals" DROP COLUMN "invoiced_at";
ALTER TABLE "deals" DROP COLUMN "status";
DROP TYPE "LpoStatus";

-- 8. Indexes for the reporting queries (revenue by invoice_date, etc).
DROP INDEX IF EXISTS "lpos_status_idx";
DROP INDEX IF EXISTS "lpos_created_by_idx";
DROP INDEX IF EXISTS "audit_log_lpo_id_idx";
CREATE INDEX "deals_stage_idx"        ON "deals"("stage");
CREATE INDEX "deals_created_by_idx"   ON "deals"("created_by");
CREATE INDEX "deals_invoice_date_idx" ON "deals"("invoice_date");
CREATE INDEX "deals_lpo_date_idx"     ON "deals"("lpo_date");
CREATE INDEX "audit_log_deal_id_idx"  ON "audit_log"("deal_id");

-- 9. Annual revenue / GP target per department, set by the BM.
CREATE TABLE "targets" (
    "id"             SERIAL NOT NULL,
    "department"     "Department" NOT NULL,
    "year"           INTEGER NOT NULL,
    "revenue_target" DECIMAL(14,2) NOT NULL,
    "gp_target"      DECIMAL(14,2) NOT NULL,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "targets_department_year_key" ON "targets"("department", "year");
