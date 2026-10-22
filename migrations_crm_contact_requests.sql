-- ============================================================================
-- MIGRATION SÉCURISÉE ET ISOLÉE CRM : public.contact_requests
-- Mariage Madagascar
-- ============================================================================

-- 1. Ajout des colonnes CRM à public.contact_requests
ALTER TABLE public.contact_requests
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'meeting_scheduled', 'proposal_sent', 'follow_up', 'negotiating', 'confirmed', 'completed', 'lost_cancelled')),
ADD COLUMN IF NOT EXISTS estimated_budget DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS assigned_planner VARCHAR(255),
ADD COLUMN IF NOT EXISTS target_date DATE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Trigger spécifique pour la mise à jour automatique de updated_at sur contact_requests
CREATE OR REPLACE FUNCTION public.set_contact_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contact_requests_updated_at ON public.contact_requests;
CREATE TRIGGER trg_contact_requests_updated_at
    BEFORE UPDATE ON public.contact_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_contact_requests_updated_at();

-- 3. Activation de Row Level Security (RLS)
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Clean-up : Nettoyage préventif des éventuelles politiques permissives temporaires
DROP POLICY IF EXISTS "public can select contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "public can update contact requests" ON public.contact_requests;
DROP POLICY IF EXISTS "allow select for contact_requests" ON public.contact_requests;
DROP POLICY IF EXISTS "allow update for contact_requests" ON public.contact_requests;

-- Note : La politique INSERT publique "public can submit contact requests" d'origine est conservée inchangée :
-- CREATE POLICY "public can submit contact requests" ON public.contact_requests FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 4. Politique RLS SELECT : Lecture réservée aux seuls administrateurs autorisés
DROP POLICY IF EXISTS "admins can select contact requests" ON public.contact_requests;
CREATE POLICY "admins can select contact requests"
ON public.contact_requests
FOR SELECT
TO authenticated
USING (
  LOWER(auth.jwt() ->> 'email') IN (
    'info@mariage-madagascar.com',
    'contact@mariage-madagascar.com',
    'admin@mariage-madagascar.com'
  )
);

-- 5. Politique RLS UPDATE : Modification réservée aux seuls administrateurs autorisés
DROP POLICY IF EXISTS "admins can update contact requests" ON public.contact_requests;
CREATE POLICY "admins can update contact requests"
ON public.contact_requests
FOR UPDATE
TO authenticated
USING (
  LOWER(auth.jwt() ->> 'email') IN (
    'info@mariage-madagascar.com',
    'contact@mariage-madagascar.com',
    'admin@mariage-madagascar.com'
  )
)
WITH CHECK (
  LOWER(auth.jwt() ->> 'email') IN (
    'info@mariage-madagascar.com',
    'contact@mariage-madagascar.com',
    'admin@mariage-madagascar.com'
  )
);
