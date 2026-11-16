/* Mariage Madagascar — Blog Inspirations
   Source : Supabase public.blog_posts + public.blog_post_images
   Destination : same-site article URLs only
*/
(function () {
  'use strict';

  const SUPABASE_URL = 'https://qrkinjuhtyfptldlvdyg.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_MT2uo1JdbfVSZAjwXqW7gg_NITLziCF';

  const grid = document.getElementById('blog-article-grid');
  const featuredLink = document.getElementById('blog-featured-link');
  const featuredImage = document.getElementById('blog-featured-image');
  const featuredCategory = document.getElementById('blog-featured-category');
  const featuredTitle = document.getElementById('blog-featured-title');
  const featuredSummary = document.getElementById('blog-featured-summary');
  const status = document.getElementById('blog-load-status');
  const filters = Array.from(document.querySelectorAll('[data-blog-filter]'));

  if (!grid) return;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stripHtml(value) {
    const el = document.createElement('div');
    el.innerHTML = value || '';
    return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function canonicalSlug(slug) {
    return String(slug || '').trim().replace(/-2$/, '');
  }

  function internalUrl(post) {
    const slug = canonicalSlug(post.slug);
    return slug ? '/' + encodeURIComponent(slug) : '/blog-wedding-planner-nosy-be.html';
  }

  function categoryForPost(post) {
    const s = (
      (post.title || '') + ' ' +
      (post.slug || '') + ' ' +
      (post.content || '')
    ).toLowerCase();

    if (/10-bonnes|10-villas|travel-planner|pourquoi/.test(s)) {
      return "Conseils d'Experts";
    }
    if (/nosy-komba|nosy-sakatia|lokobe|paddle|excursion|nosy-iranja/.test(s)) {
      return 'Destinations';
    }
    if (/mariage|jour j|plage de rêve|plage-de-reve/.test(s)) {
      return 'Récits de Mariage';
    }
    return 'Art de Vivre';
  }

  // Inventaire des fichiers réels fournis dans blog.zip.
  // Déploiement sous /assets/img/blog/ pour correspondre à l'arborescence publique du site.
  const LOCAL_BLOG_IMAGES = {"10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel":["01.jpg","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar":["01.webp","02.webp","03.webp","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"5-anniversaires-de-mariage-uniques-dans-la-jungle-naturel-a-madagascar":["01-472615329_563896026483851_3604915692189205418_n-ALp7ODLZORU6Kgq8.jpg","02-472615329_563896026483851_3604915692189205418_n-ALp7ODLZORU6Kgq8.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"5-idees-danniversaires-de-mariage-dans-locean-indien":["01-481084438_1048100987360746_3443481555109418900_n-YbNqjbjoeec7bN6r.jpg","02-481084438_1048100987360746_3443481555109418900_n-YbNqjbjoeec7bN6r.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"5-idees-de-mariages-originaux-a-madagascar-avec-budget-et-details":["01-whatsapp-image-2024-11-22-at-11.40.43-AwvM2E0GolS1KjG1.jpeg","02-whatsapp-image-2024-11-22-at-11.40.43-AwvM2E0GolS1KjG1.jpeg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"excursion-a-nosy-komba-et-nosy-tanikely":["01.jpg","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"exploration-de-la-barriere-de-corail-dambatomilo":["01-194179722_2995867823993277_7196897932394013985_n-YBgrNoeN1rTQkNzv.jpg","02-194179722_2995867823993277_7196897932394013985_n-YBgrNoeN1rTQkNzv.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"le-snorkeling-a-nosy-be-une-experience-unique":["01-458987376_924532853050894_4568301607038638592_n-YbNvzw6DLbTZVQ2q.jpg","02-458987376_924532853050894_4568301607038638592_n-YbNvzw6DLbTZVQ2q.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"les-5-lagons-a-explorer-en-amoureux-a-nosy-be":["01-34306326104_6059a399b5_k-e1504189952293-m2WqOEN5WGiWND1M.jpg","02-34306326104_6059a399b5_k-e1504189952293-m2WqOEN5WGiWND1M.jpg","03-whatsapp-image-2025-04-05-at-07.45.40-2-m7V3Mo8V86t4254g.jpeg","04-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-qrcode-home-2-Y4LVykXQ5giGobqO.png","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-logo-cb-YKb6R3ejMLfvOMXL.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-images-1-AMqDDpkpnkCR9Oye.jpg","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","16-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"les-joyaux-de-nosy-komba-pour-votre-lune-de-miel":["01.jpg","02.jpg","03.jpg","04.jpg","05.jpg","06.png","07.png","08.jpg","09.jpg","10.jpg","11.jpg","12.png","13.png","14.png","15.png"],"mariage-de-reve-a-nosy-iranja":["01.jpg","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details":["01.gif","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"nosy-be-tulear-le-paradis-des-maries":["01-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","02-qrcode-home-2-Y4LVykXQ5giGobqO.png","03-qrcode-home-2-Y4LVykXQ5giGobqO.png","04-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","05-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","06-logo-cb-YKb6R3ejMLfvOMXL.jpg","07-logo-cb-YKb6R3ejMLfvOMXL.jpg","08-images-1-AMqDDpkpnkCR9Oye.jpg","09-images-1-AMqDDpkpnkCR9Oye.jpg","10-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","11-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","12-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","13-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"nosy-saba-une-ile-paradisiaque-pour-un-mariage-inoubliable":["03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"nouveau-service-traiteur-and-chef-a-domicile-a-nosy-be-mariage-madagascar":["01-whatsapp-image-2025-04-05-at-07.45.40-2-m7V3Mo8V86t4254g.jpeg","02-whatsapp-image-2025-04-05-at-07.45.40-2-m7V3Mo8V86t4254g.jpeg","03-whatsapp-image-2025-04-05-at-07.45.40-2-m7V3Mo8V86t4254g.jpeg","04-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-qrcode-home-2-Y4LVykXQ5giGobqO.png","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-logo-cb-YKb6R3ejMLfvOMXL.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-images-1-AMqDDpkpnkCR9Oye.jpg","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","16-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"paddle-et-diner-romantique-a-tulear":["01-467867118_977736004397245_1204853036071249645_n-YbNvEEMp8kc7N2pQ.jpg","02-467867118_977736004397245_1204853036071249645_n-YbNvEEMp8kc7N2pQ.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"payer-votre-mariage-de-reve-a-nosy-be-en-bitcoin-ou-cryptomonnaies":["01.jpg","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"pourquoi-choisir-madagascar-plutot-que-lile-maurice-ou-les-seychelles-pour-votre-voyage-de-noces":["01-83915593_1051615948510434_7578249685308014592_n-YanyR2q5VguJM2Vx.jpg","02-83915593_1051615948510434_7578249685308014592_n-YanyR2q5VguJM2Vx.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar":["01.jpg","02.jpg","03.jpg","04.jpg","05.jpg","06.png","07.png","08.jpg","09.jpg","10.jpg","11.jpg","12.png","13.png","14.png","15.png"],"pourquoi-se-marier-a-madagascar":["01-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","02-qrcode-home-2-Y4LVykXQ5giGobqO.png","03-qrcode-home-2-Y4LVykXQ5giGobqO.png","04-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","05-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","06-logo-cb-YKb6R3ejMLfvOMXL.jpg","07-logo-cb-YKb6R3ejMLfvOMXL.jpg","08-images-1-AMqDDpkpnkCR9Oye.jpg","09-images-1-AMqDDpkpnkCR9Oye.jpg","10-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","11-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","12-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","13-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"pourquoi-se-marier-a-morondava-entre-authenticite-chic-et-nature-sauvage":["01-licensed-image-1-AoPJp7J1vZCgq9Xq.jpg","02-licensed-image-1-AoPJp7J1vZCgq9Xq.jpg","03-whatsapp-image-2025-04-05-at-07.45.40-2-m7V3Mo8V86t4254g.jpeg","04-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-qrcode-home-2-Y4LVykXQ5giGobqO.png","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-logo-cb-YKb6R3ejMLfvOMXL.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-images-1-AMqDDpkpnkCR9Oye.jpg","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","16-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants":["01.gif","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"snorkeling-a-nosy-sakatia":["01.jpg","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"tour-de-lile-de-nosy-be-une-aventure-tropicale-inoubliable":["01-465951738_969470121890500_7274719057656408828_n-AzGeZ43a13Io2opD.jpg","02-465951738_969470121890500_7274719057656408828_n-AzGeZ43a13Io2opD.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"],"un-mariage-unique-sur-une-plage-de-reve":["01.jpg","02.jpg","03.jpg","04.jpg","05.jpg","06.jpg","07.jpg","08.jpg","09.png","10.png","11.jpg","12.jpg","13.jpg","14.jpg","15.png","16.png","17.png","18.png"],"visite-de-la-reserve-naturelle-de-lokobe":["01.jpg","02.jpg","03.jpg","04.jpg","05.png","06.png","07.jpg","08.jpg","09.jpg","10.jpg","11.png","12.png","13.png","14.png"],"voyage-de-noce-sur-mesure-dans-locean-indien-5-destinations-de-reve":["01-482280658_662854659421637_5871547691872452185_n-AwvD6VWgV7S6pwnm.jpg","02-482280658_662854659421637_5871547691872452185_n-AwvD6VWgV7S6pwnm.jpg","03-324840700_1753621835019613_1867557360440170701_n-AzGEwj6BVGiWwJk5.jpg","04-qrcode-home-2-Y4LVykXQ5giGobqO.png","05-qrcode-home-2-Y4LVykXQ5giGobqO.png","06-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","07-istockphoto-1035399110-612x612-YbNvEBk5aBIZ1kR2.jpg","08-logo-cb-YKb6R3ejMLfvOMXL.jpg","09-logo-cb-YKb6R3ejMLfvOMXL.jpg","10-images-1-AMqDDpkpnkCR9Oye.jpg","11-images-1-AMqDDpkpnkCR9Oye.jpg","12-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","13-ta-c-la-c-chargement-2-ALp763GQVrS5E94z.png","14-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png","15-ta-c-la-c-chargement-ALp76k20Zjf3jMj4.png"]};

  function localImageCandidates(slug) {
    const safeSlug = canonicalSlug(slug);
    const files = LOCAL_BLOG_IMAGES[safeSlug] || [];
    return files.map(function (file) {
      return '/assets/img/blog/' + encodeURIComponent(safeSlug) + '/' +
        file.split('/').map(encodeURIComponent).join('/');
    });
  }

  function attachLocalFallback(img, slug) {
    const candidates = localImageCandidates(slug);
    let index = 0;

    function next() {
      if (index >= candidates.length) {
        img.style.display = 'none';
        return;
      }
      img.src = candidates[index++];
    }

    img.onerror = next;
    next();
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(d);
  }

  function normalize(post, imageMap) {
    const slug = canonicalSlug(post.slug || '');
    const images = imageMap.get(String(post.id)) || [];
    const featuredFromGallery =
      images.find(function (x) { return x.is_featured; }) ||
      images[0] ||
      null;

    const summaryText = stripHtml(post.summary || post.content || '');
    return {
      id: post.id || post.legacy_wp_id || slug,
      title: stripHtml(post.title || ''),
      slug: slug,
      summary: summaryText.slice(0, 260),
      image: post.featured_image_url || (featuredFromGallery && featuredFromGallery.image_url) || '',
      published_at: post.published_at || post.created_at || '',
      category: categoryForPost(post),
      gallery: images
    };
  }

  function dedupeCanonicalPosts(posts) {
    const seen = new Set();
    return posts.filter(function (post) {
      const key = canonicalSlug(post.slug);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function renderFeatured(post) {
    if (!post) return;

    featuredLink.href = internalUrl(post);
    featuredLink.removeAttribute('target');
    featuredLink.removeAttribute('rel');

    featuredCategory.textContent = post.category;
    featuredTitle.textContent = post.title;
    featuredSummary.textContent =
      post.summary || 'Découvrez cet article dans les Inspirations Mariage Madagascar.';

    if (featuredImage) {
      featuredImage.alt = post.title;
      featuredImage.style.display = '';
      featuredImage.src = post.image || '';
      if (!post.image) attachLocalFallback(featuredImage, post.slug);
      else {
        featuredImage.onerror = function () {
          attachLocalFallback(featuredImage, post.slug);
        };
      }
    }
  }

  function renderGrid(postsToRender) {
    if (!postsToRender.length) {
      grid.innerHTML =
        '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Aucun article dans cette catégorie.</div>';
      return;
    }

    grid.innerHTML = postsToRender.map(function (post) {
      const localCandidates = localImageCandidates(post.slug);\n      const image = escapeHtml(post.image || localCandidates[0] || '');
      const title = escapeHtml(post.title);
      const summary = escapeHtml(
        post.summary || 'Découvrez cet article dans les Inspirations Mariage Madagascar.'
      );
      const category = escapeHtml(post.category);
      const date = escapeHtml(formatDate(post.published_at));
      const href = escapeHtml(internalUrl(post));

      return `
        <a href="${href}"
           class="glass-panel rounded-xl overflow-hidden group cursor-pointer hover-glow transition-all duration-300 flex flex-col h-full no-underline">
          <div class="h-48 relative overflow-hidden bg-surface-container-high">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90"
                 data-blog-src="${image}"
                 alt="${title}">
            <div class="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent"></div>
          </div>
          <div class="p-6 flex flex-col flex-grow">
            <span class="text-primary text-xs font-semibold tracking-wider uppercase mb-2">${category}</span>
            <h3 class="font-headline text-xl font-medium text-on-surface mb-3 group-hover:text-primary transition-colors">${title}</h3>
            <p class="text-on-surface-variant text-sm flex-grow line-clamp-3">${summary}</p>
            <div class="mt-4 text-xs text-on-surface-variant/70 flex items-center justify-between">
              <span>${date || 'Article'}</span>
              <span class="material-symbols-outlined text-[16px] text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </div>
          </div>
        </a>`;
    }).join('');

    grid.querySelectorAll('img[data-blog-src]').forEach(function (img, index) {
      const post = postsToRender[index];
      img.addEventListener('error', function () {
        if (post) attachLocalFallback(img, post.slug);
      }, { once: true });

      // Démarrer le chargement seulement après l'installation du gestionnaire d'erreur.
      img.src = img.getAttribute('data-blog-src');
      img.removeAttribute('data-blog-src');
    });
  }

  function setActiveFilter(activeButton) {
    filters.forEach(function (button) {
      const active = button === activeButton;
      button.classList.toggle('text-primary', active);
      button.classList.toggle('border-primary/40', active);
      button.classList.toggle('text-on-surface-variant', !active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  const PAGE_SIZE = 18;
  let allPosts = [];
  let currentFilteredPosts = [];
  let visibleCount = PAGE_SIZE;

  // Création dynamique du bouton "Charger plus d'articles" s'il n'existe pas encore
  let loadMoreContainer = document.getElementById('blog-load-more-container');
  let loadMoreBtn = document.getElementById('blog-load-more-btn');

  function ensureLoadMoreControls() {
    if (!loadMoreContainer) {
      loadMoreContainer = document.createElement('div');
      loadMoreContainer.id = 'blog-load-more-container';
      loadMoreContainer.className = 'max-w-7xl mx-auto px-6 mt-12 flex justify-center items-center';

      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'blog-load-more-btn';
      loadMoreBtn.type = 'button';
      loadMoreBtn.className = 'glass-panel-elevated px-8 py-3.5 rounded-full text-primary border border-primary/40 hover:bg-primary/10 hover:border-primary/60 transition-all font-semibold text-sm flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(125,211,252,0.1)] hover:shadow-[0_0_30px_rgba(125,211,252,0.2)]';
      loadMoreBtn.innerHTML = '<span>Charger plus d’articles</span><span class="material-symbols-outlined text-[18px]">expand_more</span>';

      loadMoreBtn.addEventListener('click', function (e) {
        e.preventDefault();
        visibleCount += PAGE_SIZE;
        updateDisplay();
      });

      loadMoreContainer.appendChild(loadMoreBtn);

      const gridSection = grid.closest('section');
      if (gridSection && gridSection.parentNode) {
        gridSection.parentNode.insertBefore(loadMoreContainer, gridSection.nextSibling);
      }
    }
  }

  function updateDisplay() {
    ensureLoadMoreControls();
    const postsToShow = currentFilteredPosts.slice(0, visibleCount);
    renderGrid(postsToShow);

    if (loadMoreContainer) {
      if (visibleCount >= currentFilteredPosts.length) {
        loadMoreContainer.style.display = 'none';
      } else {
        loadMoreContainer.style.display = 'flex';
      }
    }

    if (status) {
      status.textContent = `${postsToShow.length} sur ${currentFilteredPosts.length} article(s) affiché(s)`;
    }
  }

  function applyFilter(filter) {
    if (filter === 'all') {
      currentFilteredPosts = allPosts;
    } else {
      currentFilteredPosts = allPosts.filter(function (post) {
        return post.category === filter;
      });
    }
    visibleCount = PAGE_SIZE;
    updateDisplay();
  }

  /* Les boutons de filtres sont de vrais boutons : aucun clic ne doit
     déclencher une navigation ou suivre un lien du Header. */
  filters.forEach(function (button) {
    button.setAttribute('type', 'button');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();

      const filter = button.getAttribute('data-blog-filter') || 'all';
      setActiveFilter(button);
      applyFilter(filter);

      // Reste sur la page du blog : aucun changement d'URL.
      try {
        window.history.replaceState(null, '', window.location.pathname);
      } catch (e) {}
    });
  });

  async function getJson(url) {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY
      }
    });
    if (!response.ok) {
      throw new Error('Supabase HTTP ' + response.status);
    }
    return response.json();
  }

  async function loadFromSupabase() {
    // Exact columns confirmed in the current public.blog_posts schema.
    const postsEndpoint =
      SUPABASE_URL +
      '/rest/v1/blog_posts' +
      '?select=id,legacy_wp_id,title,slug,summary,content,featured_image_url,published_at,created_at,is_published' +
      '&is_published=eq.true' +
      '&order=published_at.desc,created_at.desc';

    const posts = await getJson(postsEndpoint);
    if (!Array.isArray(posts)) return [];

    let galleryRows = [];
    try {
      const imagesEndpoint =
        SUPABASE_URL +
        '/rest/v1/blog_post_images' +
        '?select=blog_post_id,image_url,alt_text,sort_order,is_featured' +
        '&order=sort_order.asc';

      const images = await getJson(imagesEndpoint);
      galleryRows = Array.isArray(images) ? images : [];
    } catch (error) {
      console.warn('blog_post_images indisponible, fallback vers featured_image_url/local.', error);
    }

    const imageMap = new Map();
    galleryRows.forEach(function (row) {
      const key = String(row.blog_post_id);
      if (!imageMap.has(key)) imageMap.set(key, []);
      imageMap.get(key).push(row);
    });

    return dedupeCanonicalPosts(posts.map(function (post) {
      return normalize(post, imageMap);
    }));
  }

  async function init() {
    grid.innerHTML =
      '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Chargement des articles...</div>';

    try {
      allPosts = await loadFromSupabase();

      if (!allPosts.length) {
        grid.innerHTML =
          '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Aucun article publié.</div>';
        if (status) status.textContent = '0 article chargé';
        return;
      }

      // Keep the most recent published article with an image for the featured block.
      const featured = allPosts.find(function (post) {
        return !!post.image;
      }) || allPosts[0];

      renderFeatured(featured);
      currentFilteredPosts = allPosts;
      visibleCount = PAGE_SIZE;
      updateDisplay();
    } catch (error) {
      console.error('Impossible de charger le blog depuis Supabase.', error);
      grid.innerHTML =
        '<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Impossible de charger les articles pour le moment.</div>';
      if (status) status.textContent = 'Erreur de chargement : ' + (error && error.message ? error.message : 'erreur inconnue');
    }
  }

  init();
})();
