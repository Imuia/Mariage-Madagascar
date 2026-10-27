-- ============================================================================
-- MIGRATION SÉCURITÉ ET STOCKAGE CONTENU : PRODUITS, BLOG & STORAGE
-- ============================================================================

-- 1. Fonction Helper de vérification Admin Contenu
CREATE OR REPLACE FUNCTION public.mm_is_content_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (
        auth.role() = 'authenticated' AND (
            lower(coalesce(auth.jwt() ->> 'email', '')) = 'info@mariage-madagascar.com' OR
            coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('super_admin', 'admin')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Bucket Supabase Storage public "mm-content-images"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mm-content-images',
    'mm-content-images',
    true,
    10485760, -- 10 Mo
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

-- 3. Politiques RLS pour storage.objects sur le bucket "mm-content-images"
DROP POLICY IF EXISTS "Public Select mm-content-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Insert mm-content-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Update mm-content-images" ON storage.objects;
DROP POLICY IF EXISTS "Admin Delete mm-content-images" ON storage.objects;

CREATE POLICY "Public Select mm-content-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'mm-content-images');

CREATE POLICY "Admin Insert mm-content-images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'mm-content-images' AND public.mm_is_content_admin());

CREATE POLICY "Admin Update mm-content-images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'mm-content-images' AND public.mm_is_content_admin());

CREATE POLICY "Admin Delete mm-content-images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'mm-content-images' AND public.mm_is_content_admin());

-- 4. Politiques RLS pour public.mm_products
ALTER TABLE public.mm_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read mm_products" ON public.mm_products;
DROP POLICY IF EXISTS "Admin Insert mm_products" ON public.mm_products;
DROP POLICY IF EXISTS "Admin Update mm_products" ON public.mm_products;
DROP POLICY IF EXISTS "Admin Delete mm_products" ON public.mm_products;

CREATE POLICY "Public Read mm_products"
    ON public.mm_products FOR SELECT
    USING (published = true OR public.mm_is_content_admin());

CREATE POLICY "Admin Insert mm_products"
    ON public.mm_products FOR INSERT
    WITH CHECK (public.mm_is_content_admin());

CREATE POLICY "Admin Update mm_products"
    ON public.mm_products FOR UPDATE
    USING (public.mm_is_content_admin());

CREATE POLICY "Admin Delete mm_products"
    ON public.mm_products FOR DELETE
    USING (public.mm_is_content_admin());

-- 5. Politiques RLS pour public.mm_product_variations
ALTER TABLE public.mm_product_variations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read mm_product_variations" ON public.mm_product_variations;
DROP POLICY IF EXISTS "Admin Insert mm_product_variations" ON public.mm_product_variations;
DROP POLICY IF EXISTS "Admin Update mm_product_variations" ON public.mm_product_variations;
DROP POLICY IF EXISTS "Admin Delete mm_product_variations" ON public.mm_product_variations;

CREATE POLICY "Public Read mm_product_variations"
    ON public.mm_product_variations FOR SELECT
    USING (published = true OR public.mm_is_content_admin());

CREATE POLICY "Admin Insert mm_product_variations"
    ON public.mm_product_variations FOR INSERT
    WITH CHECK (public.mm_is_content_admin());

CREATE POLICY "Admin Update mm_product_variations"
    ON public.mm_product_variations FOR UPDATE
    USING (public.mm_is_content_admin());

CREATE POLICY "Admin Delete mm_product_variations"
    ON public.mm_product_variations FOR DELETE
    USING (public.mm_is_content_admin());

-- 6. Politiques RLS pour public.mm_product_images
ALTER TABLE public.mm_product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read mm_product_images" ON public.mm_product_images;
DROP POLICY IF EXISTS "Admin Insert mm_product_images" ON public.mm_product_images;
DROP POLICY IF EXISTS "Admin Update mm_product_images" ON public.mm_product_images;
DROP POLICY IF EXISTS "Admin Delete mm_product_images" ON public.mm_product_images;

CREATE POLICY "Public Read mm_product_images"
    ON public.mm_product_images FOR SELECT
    USING (true);

CREATE POLICY "Admin Insert mm_product_images"
    ON public.mm_product_images FOR INSERT
    WITH CHECK (public.mm_is_content_admin());

CREATE POLICY "Admin Update mm_product_images"
    ON public.mm_product_images FOR UPDATE
    USING (public.mm_is_content_admin());

CREATE POLICY "Admin Delete mm_product_images"
    ON public.mm_product_images FOR DELETE
    USING (public.mm_is_content_admin());

-- 7. Politiques RLS pour public.blog_posts
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admin Insert blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admin Update blog_posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admin Delete blog_posts" ON public.blog_posts;

CREATE POLICY "Public Read blog_posts"
    ON public.blog_posts FOR SELECT
    USING (is_published = true OR public.mm_is_content_admin());

CREATE POLICY "Admin Insert blog_posts"
    ON public.blog_posts FOR INSERT
    WITH CHECK (public.mm_is_content_admin());

CREATE POLICY "Admin Update blog_posts"
    ON public.blog_posts FOR UPDATE
    USING (public.mm_is_content_admin());

CREATE POLICY "Admin Delete blog_posts"
    ON public.blog_posts FOR DELETE
    USING (public.mm_is_content_admin());

-- 8. Politiques RLS pour public.blog_post_images
ALTER TABLE public.blog_post_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read blog_post_images" ON public.blog_post_images;
DROP POLICY IF EXISTS "Admin Insert blog_post_images" ON public.blog_post_images;
DROP POLICY IF EXISTS "Admin Update blog_post_images" ON public.blog_post_images;
DROP POLICY IF EXISTS "Admin Delete blog_post_images" ON public.blog_post_images;

CREATE POLICY "Public Read blog_post_images"
    ON public.blog_post_images FOR SELECT
    USING (true);

CREATE POLICY "Admin Insert blog_post_images"
    ON public.blog_post_images FOR INSERT
    WITH CHECK (public.mm_is_content_admin());

CREATE POLICY "Admin Update blog_post_images"
    ON public.blog_post_images FOR UPDATE
    USING (public.mm_is_content_admin());

CREATE POLICY "Admin Delete blog_post_images"
    ON public.blog_post_images FOR DELETE
    USING (public.mm_is_content_admin());
