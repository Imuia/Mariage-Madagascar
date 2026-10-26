-- ============================================================================
-- AUTOMATISATION DU PORTAIL ESPACE CLIENT - MARIAGE MADAGASCAR (VERSION SÉCURISÉE)
-- Fichier : migrations_espace_client_auto.sql
-- Description : Déclencheurs automatiques pour la création de profil et de projet client à l'inscription.
-- Compatibility : S'adapte dynamiquement si `user_id` ou `profile_id` / `client_id` est utilisé.
-- ============================================================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. TABLE CLIENT_PROJECTS (si elle n'existe pas encore)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Mon mariage',
    wedding_date DATE,
    location VARCHAR(255) DEFAULT 'Nosy Be, Madagascar',
    status VARCHAR(50) DEFAULT 'in_preparation',
    budget_limit DECIMAL(12,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_projects_user_id ON public.client_projects(user_id);
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour client_projects
DROP POLICY IF EXISTS select_own_client_project ON public.client_projects;
CREATE POLICY select_own_client_project ON public.client_projects
    FOR SELECT USING (
        auth.uid() = user_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('super_admin', 'admin')
    );

DROP POLICY IF EXISTS update_own_client_project ON public.client_projects;
CREATE POLICY update_own_client_project ON public.client_projects
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS insert_own_client_project ON public.client_projects;
CREATE POLICY insert_own_client_project ON public.client_projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. DÉCLENCHEUR ET FONCTION AUTOMATIQUE POST-INSCRIPTION SUPABASE AUTH
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_client_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_full_name TEXT;
BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
    v_first_name := COALESCE(
        NEW.raw_user_meta_data->>'first_name',
        NULLIF(SPLIT_PART(v_full_name, ' ', 1), ''),
        'Client'
    );
    v_last_name := COALESCE(
        NEW.raw_user_meta_data->>'last_name',
        NULLIF(SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1), ''),
        ''
    );

    -- 1. Création ou mise à jour du profil dans public.profiles
    INSERT INTO public.profiles (id, first_name, last_name, phone, role, created_at, updated_at)
    VALUES (
        NEW.id,
        v_first_name,
        v_last_name,
        NEW.raw_user_meta_data->>'phone',
        'client',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = NOW();

    -- 2. Création de l'entrée dans public.clients si elle existe
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
        INSERT INTO public.clients (profile_id, created_at)
        VALUES (NEW.id, NOW())
        ON CONFLICT (profile_id) DO NOTHING;
    END IF;

    -- 3. Création automatique du projet mariage s'il n'en possède aucun
    IF NOT EXISTS (SELECT 1 FROM public.client_projects WHERE user_id = NEW.id) THEN
        INSERT INTO public.client_projects (id, user_id, title, status, created_at, updated_at)
        VALUES (
            uuid_generate_v4(),
            NEW.id,
            'Mon mariage',
            'in_preparation',
            NOW(),
            NOW()
        );
    END IF;

    -- 4. Rattachement automatique des commandes passées en invité avec ce même email
    IF NEW.email IS NOT NULL AND NEW.email != '' THEN
        UPDATE public.orders
        SET user_id = NEW.id
        WHERE user_id IS NULL
          AND LOWER(guest_email) = LOWER(NEW.email);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Attachement du trigger sur auth.users
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_client_signup();

-- ----------------------------------------------------------------------------
-- 3. FONCTION RPC SÉCURISÉE DE SECOURS & D'INITIALISATION
-- Dynamique : supporte les schémas existants avec `user_id` ou `profile_id`
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_client_profile_and_project()
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT := auth.jwt()->>'email';
    v_user_meta JSONB := COALESCE((auth.jwt()->'user_metadata')::jsonb, '{}'::jsonb);
    v_project_id UUID;
    v_project_title TEXT;
    v_first_name TEXT;
    v_last_name TEXT;
    v_full_name TEXT;
    v_has_user_id BOOLEAN := FALSE;
    v_has_profile_id BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

    -- Récupération / Création du profil
    v_full_name := COALESCE(v_user_meta->>'full_name', v_user_meta->>'name', '');
    v_first_name := COALESCE(
        v_user_meta->>'first_name',
        NULLIF(SPLIT_PART(v_full_name, ' ', 1), ''),
        'Client'
    );
    v_last_name := COALESCE(
        v_user_meta->>'last_name',
        NULLIF(SUBSTRING(v_full_name FROM POSITION(' ' IN v_full_name) + 1), ''),
        ''
    );

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        INSERT INTO public.profiles (id, first_name, last_name, role, created_at, updated_at)
        VALUES (v_user_id, v_first_name, v_last_name, 'client', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
    END IF;

    -- Détection dynamique des colonnes de `client_projects`
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_projects' AND column_name = 'user_id'
    ) INTO v_has_user_id;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_projects' AND column_name = 'profile_id'
    ) INTO v_has_profile_id;

    -- Recherche dynamique du projet existant
    IF v_has_user_id THEN
        EXECUTE 'SELECT id, title FROM public.client_projects WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1'
        INTO v_project_id, v_project_title USING v_user_id;
    ELSIF v_has_profile_id THEN
        EXECUTE 'SELECT id, title FROM public.client_projects WHERE profile_id = $1 ORDER BY created_at ASC LIMIT 1'
        INTO v_project_id, v_project_title USING v_user_id;
    END IF;

    -- Création d'un projet si aucun n'existe
    IF v_project_id IS NULL THEN
        IF v_has_user_id THEN
            EXECUTE 'INSERT INTO public.client_projects (id, user_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, title'
            INTO v_project_id, v_project_title USING uuid_generate_v4(), v_user_id, 'Mon mariage', 'in_preparation';
        ELSIF v_has_profile_id THEN
            EXECUTE 'INSERT INTO public.client_projects (id, user_id, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, title'
            INTO v_project_id, v_project_title USING uuid_generate_v4(), v_user_id, 'Mon mariage', 'in_preparation';
        END IF;
    END IF;

    -- Rattachement des commandes invitées
    IF v_user_email IS NOT NULL AND v_user_email != '' THEN
        UPDATE public.orders
        SET user_id = v_user_id
        WHERE user_id IS NULL
          AND LOWER(guest_email) = LOWER(v_user_email);
    END IF;

    RETURN jsonb_build_object(
        'user_id', v_user_id,
        'project_id', v_project_id,
        'project_title', v_project_title
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Définition des permissions de la fonction RPC
GRANT EXECUTE ON FUNCTION public.ensure_client_profile_and_project() TO authenticated;
