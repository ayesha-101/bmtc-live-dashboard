-- Which brand(s) an enquiry was quoted on. Free text rather than an enum:
-- a job can span several brands and the list changes as supplier
-- agreements do, so a fixed set would go stale.
ALTER TABLE "deals" ADD COLUMN "brand" TEXT NOT NULL DEFAULT '';
