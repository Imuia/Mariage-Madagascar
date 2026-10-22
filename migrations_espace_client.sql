-- ============================================================================
-- MIGRATION DE SÉCURITÉ ET RLS POUR L'ESPACE CLIENT MARIAGE MADAGASCAR
-- Fichier : migrations_espace_client.sql
-- Description : Configuration RLS, protection du rôle admin et rattachement des commandes
-- Prérequis : Tables `profiles`, `orders`, `order_items`, `payments`, `messages`, `invites`, `documents` existantes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. VÉRIFICATIONS ET CONTRÔLES PRÉALABLES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Vérification des tables minimales requises
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        RAISE EXCEPTION 'La table public.orders est introuvable dans le schéma.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        RAISE EXCEPTION 'La table public.messages est introuvable dans le schéma.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'invites') THEN
        RAISE EXCEPTION 'La table public.invites est introuvable dans le schéma.';
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 1. ACTIVATION DE ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES PRIVÉES
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 2. PROTECTION DU CHAMP ROLE DANS PROFILES (Anti-élévation de privilèges)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.before_profile_update_protect_role()
RETURNS TRIGGER AS $$
BEGIN
    -- Si la colonne `role` est modifiée
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Interdire la modification si l'appelant n'est pas le service_role ou un super_admin
        IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role'
           AND (SELECT role FROM public.profiles WHERE id = auth.uid()) NOT IN ('super_admin', 'admin') THEN
            RAISE EXCEPTION 'Modification du rôle non autorisée.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.before_profile_update_protect_role();

-- Politiques RLS pour PROFILES
DROP POLICY IF EXISTS select_own_profile ON public.profiles;
CREATE POLICY select_own_profile ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS update_own_profile ON public.profiles;
CREATE POLICY update_own_profile ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);


-- ----------------------------------------------------------------------------
-- 3. RATTACHEMENT SÉCURISÉ DES COMMANDES INVITÉES (RPC & Trigger)
-- ----------------------------------------------------------------------------
-- Fonction RPC appelable par le client connecté pour rattacher ses commandes passées en invité
CREATE OR REPLACE FUNCTION public.claim_guest_orders()
RETURNS INTEGER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT := auth.jwt()->>'email';
    v_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL OR v_user_email IS NULL OR v_user_email = '' THEN
        RETURN 0;
    END IF;

    UPDATE public.orders
    SET user_id = v_user_id
    WHERE user_id IS NULL
      AND LOWER(guest_email) = LOWER(v_user_email);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger de rattachement automatique lors de la modification de l'e-mail d'un profil
CREATE OR REPLACE FUNCTION public.auto_link_user_orders()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NOT NULL THEN
        UPDATE public.orders
        SET user_id = NEW.id
        WHERE user_id IS NULL
          AND LOWER(guest_email) = LOWER(NEW.email);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_auto_link_orders ON public.profiles;
CREATE TRIGGER trg_auto_link_orders
    AFTER INSERT OR UPDATE OF email ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_user_orders();


-- ----------------------------------------------------------------------------
-- 4. POLITIQUES RLS POUR COMMANDES, LIGNES ET PAIEMENTS (Orders, Items, Payments)
-- ----------------------------------------------------------------------------
-- orders : Lecture restreinte au propriétaire (user_id ou guest_email vérifié par JWT)
DROP POLICY IF EXISTS select_own_orders ON public.orders;
CREATE POLICY select_own_orders ON public.orders
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid()
            OR (guest_email IS NOT NULL AND LOWER(guest_email) = LOWER(auth.jwt()->>'email'))
        )
    );

-- order_items : Lecture restreinte aux éléments de ses propres commandes
DROP POLICY IF EXISTS select_order_items ON public.order_items;
CREATE POLICY select_order_items ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND auth.uid() IS NOT NULL
              AND (o.user_id = auth.uid() OR (o.guest_email IS NOT NULL AND LOWER(o.guest_email) = LOWER(auth.jwt()->>'email')))
        )
    );

-- payments : Lecture restreinte aux paiements de ses propres commandes
DROP POLICY IF EXISTS select_payments ON public.payments;
CREATE POLICY select_payments ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
              AND auth.uid() IS NOT NULL
              AND (o.user_id = auth.uid() OR (o.guest_email IS NOT NULL AND LOWER(o.guest_email) = LOWER(auth.jwt()->>'email')))
        )
    );


-- ----------------------------------------------------------------------------
-- 5. POLITIQUES RLS POUR MESSAGES (Anti-usurpation d'identité admin)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS select_own_messages ON public.messages;
CREATE POLICY select_own_messages ON public.messages
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid()
            OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'support')
        )
    );

DROP POLICY IF EXISTS insert_own_messages ON public.messages;
CREATE POLICY insert_own_messages ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
        AND (est_admin IS FALSE OR est_admin IS NULL)
    );


-- ----------------------------------------------------------------------------
-- 6. POLITIQUES RLS GRANULAIRES POUR INVITÉS (CRUD Complet par Utilisateur)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS select_own_invites ON public.invites;
CREATE POLICY select_own_invites ON public.invites
    FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS insert_own_invites ON public.invites;
CREATE POLICY insert_own_invites ON public.invites
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS update_own_invites ON public.invites;
CREATE POLICY update_own_invites ON public.invites
    FOR UPDATE
    USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS delete_own_invites ON public.invites;
CREATE POLICY delete_own_invites ON public.invites
    FOR DELETE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 7. POLITIQUES RLS POUR DOCUMENTS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS select_own_documents ON public.documents;
CREATE POLICY select_own_documents ON public.documents
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            user_id = auth.uid()
            OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin', 'wedding_planner', 'travel_planner')
        )
    );
