-- ============================================================================
-- ADDITION SQL : METADATA FACTURE STRIPE ET TRACKING EMAILS
-- ============================================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS stripe_invoice_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS internal_notification_sent_at TIMESTAMP WITH TIME ZONE;
