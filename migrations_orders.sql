-- ============================================================================
-- MIGRATION SQL FINAL : ORDERS, ORDER_ITEMS, PAYMENTS & PROMO_CODES
-- Plateforme : Mariage Madagascar Luxe
-- ============================================================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Function / Trigger : Mise à jour automatique de updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Table: promo_codes & Fonction atomique sécurisée
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    start_date DATE,
    expiry_date DATE,
    max_uses INTEGER,
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_max_uses CHECK (max_uses IS NULL OR usage_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);

-- Fonction atomique pour incrémenter l'utilisation d'un code promo (exécutée post-paiement par le webhook)
CREATE OR REPLACE FUNCTION public.increment_promo_code_usage(p_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_promo public.promo_codes%ROWTYPE;
BEGIN
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE LOWER(code) = LOWER(p_code)
      AND is_active = true
      AND (start_date IS NULL OR start_date <= CURRENT_DATE)
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Code promotionnel invalide ou expiré';
    END IF;

    IF v_promo.max_uses IS NOT NULL AND v_promo.usage_count >= v_promo.max_uses THEN
        RAISE EXCEPTION 'Ce code promotionnel a atteint son nombre maximum d''utilisations';
    END IF;

    UPDATE public.promo_codes
    SET usage_count = usage_count + 1
    WHERE id = v_promo.id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Sécurisation des privilèges de la fonction
REVOKE ALL ON FUNCTION public.increment_promo_code_usage(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_promo_code_usage(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.increment_promo_code_usage(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_promo_code_usage(TEXT) TO service_role;


-- ----------------------------------------------------------------------------
-- 3. Table: orders (Commandes / Réservations)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID, -- NULL pour les paiements en mode Invité (guest)
    guest_first_name VARCHAR(255) NOT NULL,
    guest_last_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50),
    guest_country VARCHAR(100) DEFAULT 'France',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'confirmed', 'cancelled', 'failed')),
    payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    currency VARCHAR(10) DEFAULT 'EUR',
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2) DEFAULT 0.00,
    tax_amount DECIMAL(12,2) DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE SET NULL,
    stripe_checkout_session_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    notes TEXT,
    booking_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_orders_user' AND table_name = 'orders'
        ) THEN
            ALTER TABLE public.orders ADD CONSTRAINT fk_orders_user
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON public.orders(stripe_checkout_session_id);


-- ----------------------------------------------------------------------------
-- 4. Table: order_items (Lignes de commande & SNAPSHOT des produits)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.mm_products(id) ON DELETE SET NULL,
    variation_id UUID REFERENCES public.mm_product_variations(id) ON DELETE SET NULL,
    item_type VARCHAR(50) DEFAULT 'product' CHECK (item_type IN ('product', 'option', 'custom')),
    product_name VARCHAR(255) NOT NULL,
    product_slug VARCHAR(255),
    variation_name VARCHAR(255),
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_price DECIMAL(12,2) NOT NULL,
    pax INTEGER,
    booking_date DATE,
    options_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);


-- ----------------------------------------------------------------------------
-- 5. Table: payments (Historique des transactions de paiement)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    stripe_charge_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_checkout_session_id VARCHAR(255) UNIQUE,
    payment_method VARCHAR(100) DEFAULT 'stripe',
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'EUR',
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);


-- ============================================================================
-- SÉCURITÉ ET ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 1. promo_codes : Aucune politique SELECT/INSERT/UPDATE publique.
-- Seul le serveur avec la Service Role Key y accède.

-- 2. orders : Lecture restreinte à l'utilisateur authentifié pour ses propres commandes.
DROP POLICY IF EXISTS select_own_orders ON public.orders;
CREATE POLICY select_own_orders ON public.orders
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND auth.uid() = user_id
    );

-- 3. order_items : Lecture restreinte à l'utilisateur authentifié pour ses propres commandes.
DROP POLICY IF EXISTS select_order_items ON public.order_items;
CREATE POLICY select_order_items ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND auth.uid() IS NOT NULL AND o.user_id = auth.uid()
        )
    );

-- 4. payments : Lecture restreinte à l'utilisateur authentifié pour ses propres commandes.
DROP POLICY IF EXISTS select_payments ON public.payments;
CREATE POLICY select_payments ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payments.order_id
            AND auth.uid() IS NOT NULL AND o.user_id = auth.uid()
        )
    );
