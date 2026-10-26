-- ============================================================================
-- AUTOMATISATION DU PORTAIL ESPACE CLIENT - MARIAGE MADAGASCAR
-- Fichier : migrations_espace_client_auto.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- 0. Table documents (créée si absente, avec références conditionnelles aux profils)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'documents') THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
            CREATE TABLE public.documents (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
                client_profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
                user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                file_url TEXT NOT NULL,
                document_type VARCHAR(100) DEFAULT 'other',
                is_validated BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ELSE
            CREATE TABLE public.documents (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
                client_profile_id UUID,
                user_id UUID,
                title VARCHAR(255) NOT NULL,
                file_url TEXT NOT NULL,
                document_type VARCHAR(100) DEFAULT 'other',
                is_validated BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        END IF;
    END IF;
END $$;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_documents ON public.documents;
CREATE POLICY select_own_documents ON public.documents
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND (client_profile_id = auth.uid() OR user_id = auth.uid())
    );

-- 1. Table client_projects
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'client_projects') THEN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
            CREATE TABLE public.client_projects (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
                owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL DEFAULT 'Mon mariage',
                event_date DATE,
                location VARCHAR(255) DEFAULT 'Nosy Be, Madagascar',
                status VARCHAR(50) DEFAULT 'in_preparation',
                budget_limit DECIMAL(12,2),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ELSE
            CREATE TABLE public.client_projects (
                id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
                owner_id UUID,
                title VARCHAR(255) NOT NULL DEFAULT 'Mon mariage',
                event_date DATE,
                location VARCHAR(255) DEFAULT 'Nosy Be, Madagascar',
                status VARCHAR(50) DEFAULT 'in_preparation',
                budget_limit DECIMAL(12,2),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        END IF;
    END IF;
END $$;

ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_projects' AND column_name = 'owner_id') THEN
        CREATE INDEX IF NOT EXISTS idx_client_projects_owner_id ON public.client_projects(owner_id);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_projects' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_client_projects_user_id ON public.client_projects(user_id);
    END IF;
END $$;

-- Politique RLS conditionnelle
DO $$
DECLARE
    v_col TEXT;
    v_has_role BOOLEAN := FALSE;
BEGIN
    DROP POLICY IF EXISTS select_own_client_project ON public.client_projects;

    SELECT column_name INTO v_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_projects'
      AND column_name IN ('owner_id', 'user_id', 'profile_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'user_id' THEN 2 ELSE 3 END
    LIMIT 1;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
    ) INTO v_has_role;

    IF v_col IS NOT NULL THEN
        IF v_has_role THEN
            EXECUTE format('
                CREATE POLICY select_own_client_project ON public.client_projects
                FOR SELECT USING (
                    auth.uid() IS NOT NULL AND (
                        %I = auth.uid() OR
                        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN (''super_admin'', ''admin'')
                    )
                );
            ', v_col);
        ELSE
            EXECUTE format('
                CREATE POLICY select_own_client_project ON public.client_projects
                FOR SELECT USING (
                    auth.uid() IS NOT NULL AND %I = auth.uid()
                );
            ', v_col);
        END IF;
    END IF;
END $$;

-- 2. Déclencheur d'inscription sur auth.users (avec qualification public.uuid_generate_v4)
CREATE OR REPLACE FUNCTION public.handle_new_client_signup()
RETURNS TRIGGER AS $$
DECLARE
    v_first_name TEXT;
    v_last_name TEXT;
    v_full_name TEXT;
    v_owner_col TEXT;
    v_has_fn BOOLEAN := FALSE;
    v_has_ln BOOLEAN := FALSE;
    v_has_phone BOOLEAN := FALSE;
    v_has_role BOOLEAN := FALSE;
    v_has_orders BOOLEAN := FALSE;
    v_has_order_user_id BOOLEAN := FALSE;
    v_has_order_guest_email BOOLEAN := FALSE;
    v_project_exists BOOLEAN := FALSE;
BEGIN
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

        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='first_name') INTO v_has_fn;
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='last_name') INTO v_has_ln;
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='phone') INTO v_has_phone;
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') INTO v_has_role;

            IF v_has_fn AND v_has_ln AND v_has_phone AND v_has_role THEN
                INSERT INTO public.profiles (id, first_name, last_name, phone, role, created_at, updated_at)
                VALUES (NEW.id, v_first_name, v_last_name, NEW.raw_user_meta_data->>'phone', 'client', NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
            ELSIF v_has_fn AND v_has_ln THEN
                INSERT INTO public.profiles (id, first_name, last_name, created_at, updated_at)
                VALUES (NEW.id, v_first_name, v_last_name, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
            ELSE
                INSERT INTO public.profiles (id) VALUES (NEW.id)
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'clients') THEN
            INSERT INTO public.clients (profile_id, created_at)
            VALUES (NEW.id, NOW())
            ON CONFLICT (profile_id) DO NOTHING;
        END IF;

        SELECT column_name INTO v_owner_col
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'client_projects'
          AND column_name IN ('owner_id', 'user_id', 'profile_id')
        ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'user_id' THEN 2 ELSE 3 END
        LIMIT 1;

        IF v_owner_col IS NOT NULL THEN
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.client_projects WHERE %I = $1)', v_owner_col)
            INTO v_project_exists
            USING NEW.id;

            IF NOT v_project_exists THEN
                EXECUTE format('
                    INSERT INTO public.client_projects (id, %I, title, status, created_at, updated_at)
                    VALUES ($1, $2, ''Mon mariage'', ''in_preparation'', NOW(), NOW())
                ', v_owner_col)
                USING public.uuid_generate_v4(), NEW.id;
            END IF;
        END IF;

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

-- 3. Fonction RPC d'initialisation Espace Client (avec qualification public.uuid_generate_v4)
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
    v_owner_col TEXT;
    v_has_fn BOOLEAN := FALSE;
    v_has_ln BOOLEAN := FALSE;
    v_has_role BOOLEAN := FALSE;
    v_has_orders BOOLEAN := FALSE;
    v_has_order_user_id BOOLEAN := FALSE;
    v_has_order_guest_email BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

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
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='first_name') INTO v_has_fn;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='last_name') INTO v_has_ln;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role') INTO v_has_role;

        IF v_has_fn AND v_has_ln AND v_has_role THEN
            INSERT INTO public.profiles (id, first_name, last_name, role, created_at, updated_at)
            VALUES (v_user_id, v_first_name, v_last_name, 'client', NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        ELSE
            INSERT INTO public.profiles (id) VALUES (v_user_id)
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;

    SELECT column_name INTO v_owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_projects'
      AND column_name IN ('owner_id', 'user_id', 'profile_id')
    ORDER BY CASE column_name WHEN 'owner_id' THEN 1 WHEN 'user_id' THEN 2 ELSE 3 END
    LIMIT 1;

    IF v_owner_col IS NOT NULL THEN
        EXECUTE format('SELECT id, title FROM public.client_projects WHERE %I = $1 ORDER BY created_at ASC LIMIT 1', v_owner_col)
        INTO v_project_id, v_project_title
        USING v_user_id;

        IF v_project_id IS NULL THEN
            EXECUTE format('INSERT INTO public.client_projects (id, %I, title, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id, title', v_owner_col)
            INTO v_project_id, v_project_title
            USING public.uuid_generate_v4(), v_user_id, 'Mon mariage', 'in_preparation';
        END IF;
    END IF;

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
