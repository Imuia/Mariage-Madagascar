-- ============================================================================
-- MIGRATION DE SÉCURITÉ ADMIN : RÔLES & PROTECTION RLS (Mariage Madagascar)
-- ============================================================================

-- 1. Fonction Trigger : Empêcher les utilisateurs non super_admin de modifier leur propre rôle dans public.profiles
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la colonne 'role' est modifiée
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Seul un compte possédant le rôle super_admin peut modifier la colonne role
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        ) THEN
            RAISE EXCEPTION 'Privilege escalation error: Only super_admin can modify profile roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Activation du trigger sur la table public.profiles
DROP TRIGGER IF EXISTS trigger_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trigger_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_self_role_escalation();


-- 2. Politiques RLS renforcées pour la table profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Suppression des politiques existantes pour mise à jour propre
DROP POLICY IF EXISTS "select_profiles_policy" ON public.profiles;
DROP POLICY IF EXISTS "update_profiles_policy" ON public.profiles;

-- Politique de Lecture : Tout utilisateur authentifié peut lire son profil, les admins voient tous les profils
CREATE POLICY "select_profiles_policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'commercial', 'wedding_planner', 'travel_planner', 'accounting', 'support')
        )
    );

-- Politique de Mise à Jour : Un utilisateur peut mettre à jour son propre profil (le trigger empêche la modification du rôle)
CREATE POLICY "update_profiles_policy" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin')
        )
    );


-- 3. Politiques RLS renforcées pour la table bookings (réservations)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bookings_policy" ON public.bookings;

CREATE POLICY "select_bookings_policy" ON public.bookings
    FOR SELECT USING (
        auth.uid() = client_profile_id OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'commercial', 'wedding_planner', 'travel_planner', 'accounting')
        )
    );


-- 4. Politiques RLS renforcées pour la table payments (paiements)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payments_policy" ON public.payments;

CREATE POLICY "select_payments_policy" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings
            WHERE bookings.id = payments.booking_id AND bookings.client_profile_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'accounting')
        )
    );
