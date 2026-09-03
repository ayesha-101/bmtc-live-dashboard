-- Showrooms work differently from projects: there is no quotation and no
-- invoicing step. They record the customer's LPO and the sale is complete,
-- so their rows land directly on a terminal `sold` stage. Revenue is still
-- recognised from the invoice_* columns, which the showroom form fills
-- from the LPO figures, so every existing report keeps working unchanged.
ALTER TYPE "Department" ADD VALUE 'showroom';
ALTER TYPE "DealStage" ADD VALUE 'sold';
