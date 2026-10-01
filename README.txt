MARIAGE MADAGASCAR — BLOG FINAL
==================================

Fichiers :
- blog-inspirations.html : design Stitch conservé, ID de l'image featured corrigé.
- assets/js/blog-inspirations.js : charge les articles publiés depuis Supabase,
  sans colonne inexistante "category", sans liens vers l'ancien domaine,
  dédoublonnage défensif des slugs et galerie d'images.
- blog-article.html : article dynamique par slug, images locales/Supabase,
  liens internes et SEO dynamique.
- vercel.json : URL propre /<slug> -> blog-article.html?slug=<slug>

Important :
1. Ne pas modifier le design Stitch.
2. Les images locales sont attendues sous :
   /assets/img/blog/<slug>/01.jpg, 02.jpg, 03.jpg, etc.
3. Les données viennent de public.blog_posts et public.blog_post_images.
4. Aucun lien de carte ne renvoie volontairement vers mariage-madagascar.com.
