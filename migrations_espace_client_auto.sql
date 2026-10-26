-- ============================================================================
-- AUTOMATISATION DU PORTAIL ESPACE CLIENT - MARIAGE MADAGASCAR
-- Fichier : migrations_espace_client_auto.sql
-- Description : Compatible avec public.client_profiles et public.client_projects(owner_id)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ----------------------------------------------------------------------------
-- 0. TABLE PUBLIC.CLIENT_PROFILES (si non existante)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_profiles (
    id UUID PRIMARY KEY,
    email VARCHAR(255),
    full_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_client_profile ON public.client_profiles;
CREATE POLICY select_own_client_profile ON public.client_profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS update_own_client_profile ON public.client_profiles;
CREATE POLICY update_own_client_profile ON public.client_profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);


-- ----------------------------------------------------------------------------
-- 1. TABLE PUBLIC.DOCUMENTS (Liée à Supabase Auth / client_profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    client_profile_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
    user_id UUID,
    title VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    document_type VARCHAR(100) DEFAULT 'other',
    is_validated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_documents ON public.documents;
CREATE POLICY select_own_documents ON public.documents
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (
            client_profile_id = auth.uid() OR user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS insert_own_documents ON public.documents;
CREATE POLICY insert_own_documents ON public.documents
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            client_profile_id = auth.uid() OR user_id = auth.uid()
        )
    );


-- ----------------------------------------------------------------------------
-- 2. TABLE PUBLIC.CLIENT_PROJECTS (owner_id, title, event_date, status)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_projects (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    owner_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Mon mariage',
    event_date DATE,
    location VARCHAR(255) DEFAULT 'Nosy Be, Madagascar',
    status VARCHAR(50) DEFAULT 'in_preparation',
    budget_limit DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_projects_owner_id ON public.client_projects(owner_id);

-- Politique RLS sécurisée sur client_projects
DROP POLICY IF EXISTS select_own_client_project ON public.client_projects;
CREATE POLICY select_own_client_project ON public.client_projects
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND owner_id = auth.uid()
    );

DROP POLICY IF EXISTS update_own_client_project ON public.client_projects;
CREATE POLICY update_own_client_project ON public.client_projects
    FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS insert_own_client_project ON public.client_projects;
CREATE POLICY insert_own_client_project ON public.client_projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);


-- ----------------------------------------------------------------------------
-- 3. DÉCLENCHEUR AUTOMATIQUE POST-INSCRIPTION SUR AUTH.USERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_client_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
    v_project_exists BOOLEAN := FALSE;
    v_has_orders BOOLEAN := FALSE;
    v_has_order_user_id BOOLEAN := FALSE;
    v_has_order_guest_email BOOLEAN := FALSE;
BEGIN
    BEGIN
        v_full_name := COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            SPLIT_PART(NEW.email, '@', 1)
        );

        -- 1. Profil client dans public.client_profiles
        INSERT INTO public.client_profiles (id, email, full_name, created_at, updated_at)
        VALUES (NEW.id, NEW.email, v_full_name, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            updated_at = NOW();

        -- 2. Entrée optionnelle dans public.profiles (si la table existe)
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
            INSERT INTO public.profiles (id) VALUES (NEW.id)
            ON CONFLICT (id) DO NOTHING;
        END IF;

        -- 3. Projet "Mon mariage" (owner_id) sans créer de doublon
        SELECT EXISTS (
            SELECT 1 FROM public.client_projects WHERE owner_id = NEW.id
        ) INTO v_project_exists;

        IF NOT v_project_exists THEN
            INSERT INTO public.client_projects (id, owner_id, title, status, created_at, updated_at)
            VALUES (public.uuid_generate_v4(), NEW.id, 'Mon mariage', 'in_preparation', NOW(), NOW());
        END IF;

        -- 4. Rattachement des commandes invitées si la table orders existe
        SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') INTO v_has_orders;
        IF v_has_orders THEN
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id') INTO v_has_order_user_id;
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='guest_email') INTO v_has_order_guest_email;

            IF v_has_order_user_id AND v_has_order_guest_email AND NEW.email IS NOT NULL AND NEW.email != '' THEN
                UPDATE public.orders
                SET user_id = NEW.id
                WHERE user_id IS NULL
                  AND LOWER(guest_email) = LOWER(NEW.email);
            END IF;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_client_signup warning: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_client_signup();


-- ----------------------------------------------------------------------------
-- 4. FONCTION RPC SÉCURISÉE DE SECOURS ET D'INITIALISATION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_client_profile_and_project()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT := auth.jwt()->>'email';
    v_user_meta JSONB := COALESCE((auth.jwt()->'user_metadata')::jsonb, '{}'::jsonb);
    v_project_id UUID;
    v_project_title TEXT;
    v_full_name TEXT;
    v_has_orders BOOLEAN := FALSE;
    v_has_order_user_id BOOLEAN := FALSE;
    v_has_order_guest_email BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

    v_full_name := COALESCE(
        v_user_meta->>'full_name',
        v_user_meta->>'name',
        SPLIT_PART(v_user_email, '@', 1)
    );

    -- client_profiles
    INSERT INTO public.client_profiles (id, email, full_name, created_at, updated_at)
    VALUES (v_user_id, v_user_email, v_full_name, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

    -- client_projects
    SELECT id, title INTO v_project_id, v_project_title
    FROM public.client_projects
    WHERE owner_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_project_id IS NULL THEN
        INSERT INTO public.client_projects (id, owner_id, title, status, created_at, updated_at)
        VALUES (public.uuid_generate_v4(), v_user_id, 'Mon mariage', 'in_preparation', NOW(), NOW())
        RETURNING id, title INTO v_project_id, v_project_title;
    END IF;

    -- Rattachement des commandes
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') INTO v_has_orders;
    IF v_has_orders THEN
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id') INTO v_has_order_user_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='guest_email') INTO v_has_order_guest_email;

        IF v_has_order_user_id AND v_has_order_guest_email AND v_user_email IS NOT NULL AND v_user_email != '' THEN
            UPDATE public.orders
            SET user_id = v_user_id
            WHERE user_id IS NULL
              AND LOWER(guest_email) = LOWER(v_user_email);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'user_id', v_user_id,
        'project_id', v_project_id,
        'project_title', COALESCE(v_project_title, 'Mon mariage')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.ensure_client_profile_and_project() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_client_profile_and_project() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_client_profile_and_project() TO authenticated;
