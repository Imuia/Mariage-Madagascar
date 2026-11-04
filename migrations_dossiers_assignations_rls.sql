-- ============================================================================
-- MIGRATION : AFFECTATION DES DOSSIERS & POLITIQUES RLS INVITÉS (client_guests)
-- ============================================================================
-- Objectifs :
-- 1. Ajout additif et non bloquant de l'affectation des dossiers (commercial / chargé de production)
--    sur public.client_projects et public.orders.
-- 2. Définition des politiques RLS strictes sur public.client_guests :
--    - Client propriétaire : accès à ses seuls invités (via client_projects.owner_id = auth.uid())
--    - Administrateurs : accès global (rôles super_admin, admin ou email admin)
--    - Chargé de production : accès aux seuls dossiers/invités qui lui sont affectés
--    - Commercial : accès aux seuls dossiers/invités qui lui sont affectés
--    - Tiers / invités : aucun accès par défaut
-- ============================================================================

-- 1. Colonnes d'assignation sur client_projects (si non existantes)
ALTER TABLE public.client_projects
    ADD COLUMN IF NOT EXISTS assigned_production_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_commercial_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_projects_assigned_prod ON public.client_projects(assigned_production_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_assigned_comm ON public.client_projects(assigned_commercial_id);

-- 2. Colonnes d'assignation sur orders (si non existantes, pour réconciliation commandes/dossiers)
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS assigned_production_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_commercial_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_assigned_prod ON public.orders(assigned_production_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_comm ON public.orders(assigned_commercial_id);

-- 3. Fonction helper de vérification des privilèges internes
CREATE OR REPLACE FUNCTION public.mm_is_staff_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (
              role IN ('super_admin', 'admin')
              OR email IN ('info@mariage-madagascar.com', 'admin@mariage-madagascar.com')
          )
    )
    OR (
        (auth.jwt() ->> 'email') IN ('info@mariage-madagascar.com', 'admin@mariage-madagascar.com')
    );
$$;

-- 4. Activation de RLS sur public.client_guests
ALTER TABLE public.client_guests ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques sur client_guests pour éviter tout conflit ou doublon
DROP POLICY IF EXISTS "client_guests_select_policy" ON public.client_guests;
DROP POLICY IF EXISTS "client_guests_insert_policy" ON public.client_guests;
DROP POLICY IF EXISTS "client_guests_update_policy" ON public.client_guests;
DROP POLICY IF EXISTS "client_guests_delete_policy" ON public.client_guests;

-- A. LECTURE (SELECT) :
-- Un utilisateur peut lire un invité si :
-- 1. Il est l'administrateur
-- 2. Il est le client propriétaire du projet
-- 3. Il est le chargé de production assigné au projet
-- 4. Il est le commercial assigné au projet
CREATE POLICY "client_guests_select_policy" ON public.client_guests
    FOR SELECT
    USING (
        public.mm_is_staff_admin()
        OR EXISTS (
            SELECT 1 FROM public.client_projects p
            WHERE p.id = client_guests.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR p.assigned_production_id = auth.uid()
                  OR p.assigned_commercial_id = auth.uid()
              )
        )
    );

-- B. INSERTION (INSERT) :
-- Le client propriétaire du projet ou un admin/chargé de production assigné peut ajouter un invité
CREATE POLICY "client_guests_insert_policy" ON public.client_guests
    FOR INSERT
    WITH CHECK (
        public.mm_is_staff_admin()
        OR EXISTS (
            SELECT 1 FROM public.client_projects p
            WHERE p.id = client_guests.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR p.assigned_production_id = auth.uid()
              )
        )
    );

-- C. MODIFICATION (UPDATE) :
-- Le client propriétaire du projet ou un admin/chargé de production assigné peut modifier un invité
CREATE POLICY "client_guests_update_policy" ON public.client_guests
    FOR UPDATE
    USING (
        public.mm_is_staff_admin()
        OR EXISTS (
            SELECT 1 FROM public.client_projects p
            WHERE p.id = client_guests.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR p.assigned_production_id = auth.uid()
              )
        )
    )
    WITH CHECK (
        public.mm_is_staff_admin()
        OR EXISTS (
            SELECT 1 FROM public.client_projects p
            WHERE p.id = client_guests.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR p.assigned_production_id = auth.uid()
              )
        )
    );

-- D. SUPPRESSION (DELETE) :
-- Le client propriétaire du projet ou un administrateur peut supprimer un invité
CREATE POLICY "client_guests_delete_policy" ON public.client_guests
    FOR DELETE
    USING (
        public.mm_is_staff_admin()
        OR EXISTS (
            SELECT 1 FROM public.client_projects p
            WHERE p.id = client_guests.project_id
              AND (
                  p.owner_id = auth.uid()
                  OR p.assigned_production_id = auth.uid()
              )
        )
    );
