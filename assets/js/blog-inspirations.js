/* Mariage Madagascar — Blog Inspirations */
(function(){
'use strict';

const SUPABASE_URL='https://qrkinjuhtyfptldlvdyg.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya2luanVodHlmcHRsZGx2ZHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4MzY3NzUsImV4cCI6MjEwNjQxMjc3NX0.rKo326yy_QALlLVH5FfFfzyRp_J6Fd6B3EnZhbdIj9I';
const FALLBACK_POSTS=[{"id": "279", "title": "🌴 Les Joyaux de Nosy Komba pour votre Lune de Miel 💕", "slug": "les-joyaux-de-nosy-komba-pour-votre-lune-de-miel", "summary": "", "featured_image_url": "", "published_at": "2025-04-06 00:00:00", "category": "Destinations"}, {"id": "280", "title": "🌊 𝗙𝗢𝗖𝗨𝗦 𝗙𝗘𝗦𝗧𝗜𝗩𝗔𝗟 – Une Expérience Unique à Madagascar ✨ Copy", "slug": "focus-festival-une-experience-unique-a-madagascar", "summary": "", "featured_image_url": "", "published_at": "2025-09-06 00:00:00", "category": "Art de Vivre"}, {"id": "281", "title": "Snorkeling à Nosy Sakatia 🐋🐬🐢🌊", "slug": "snorkeling-a-nosy-sakatia", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations"}, {"id": "282", "title": "Visite de la Réserve Naturelle de Lokobe 🐒🦎🌿", "slug": "visite-de-la-reserve-naturelle-de-lokobe", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations"}, {"id": "283", "title": "Paddle et Dîner Romantique Exceptionnel🐬👩🏼‍❤️‍👩🏽🐢🌊", "slug": "paddle-et-diner-romantique-exceptionnel", "summary": "", "featured_image_url": "", "published_at": "2024-12-06 17:39:53", "category": "Destinations"}, {"id": "285", "title": "10 Villas, Hôtels et Lieux Insolites au Bord de l’Eau pour un Mariage de Rêve à Madagascar 🌊💍🏝", "slug": "10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar", "summary": "", "featured_image_url": "", "published_at": "2025-03-05 00:00:00", "category": "Conseils d'Experts"}, {"id": "288", "title": "10 Bonnes Raisons de Choisir Madagascar pour Votre Lune de Miel 🌴💕", "slug": "10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel", "summary": "", "featured_image_url": "", "published_at": "2024-06-01 00:00:00", "category": "Conseils d'Experts"}, {"id": "289", "title": "Un mariage unique sur une plage de rêve 👰🏼⛱️", "slug": "un-mariage-unique-sur-une-plage-de-reve", "summary": "", "featured_image_url": "", "published_at": "2023-01-30 20:08:02", "category": "Récits de Mariage"}, {"id": "291", "title": "Pourquoi faire appel à un travel planner spécialisé pour votre voyage de noces ou anniversaire de mariage à Madagascar ? 🌴💍🛶✨", "slug": "pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar", "summary": "", "featured_image_url": "", "published_at": "2025-07-28 00:00:00", "category": "Conseils d'Experts"}, {"id": "293", "title": "🌟 Pourquoi un Mariage Symbolique est une Expérience Extraordinaire pour Vos Enfants 🌟", "slug": "pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants", "summary": "", "featured_image_url": "", "published_at": "2025-09-20 00:00:00", "category": "Conseils d'Experts"}, {"id": "296", "title": "10 Villas, Hôtels et Lieux Insolites au Bord de l’Eau pour un Mariage de Rêve à Madagascar 🌊💍🏝", "slug": "10-villas-hotels-et-lieux-insolites-au-bord-de-leau-pour-un-mariage-de-reve-a-madagascar-2", "summary": "", "featured_image_url": "", "published_at": "2025-03-05 00:00:00", "category": "Conseils d'Experts"}, {"id": "298", "title": "🌊 𝗙𝗢𝗖𝗨𝗦 𝗙𝗘𝗦𝗧𝗜𝗩𝗔𝗟 – Une Expérience Unique à Madagascar ✨ Copy", "slug": "focus-festival-une-experience-unique-a-madagascar-2", "summary": "", "featured_image_url": "", "published_at": "2025-09-06 00:00:00", "category": "Art de Vivre"}, {"id": "299", "title": "Visite de la Réserve Naturelle de Lokobe 🐒🦎🌿", "slug": "visite-de-la-reserve-naturelle-de-lokobe-2", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations"}, {"id": "300", "title": "Un mariage unique sur une plage de rêve 👰🏼⛱️", "slug": "un-mariage-unique-sur-une-plage-de-reve-2", "summary": "", "featured_image_url": "", "published_at": "2023-01-30 20:08:02", "category": "Récits de Mariage"}, {"id": "302", "title": "Pourquoi faire appel à un travel planner spécialisé pour votre voyage de noces ou anniversaire de mariage à Madagascar ? 🌴💍🛶✨", "slug": "pourquoi-faire-appel-a-un-travel-planner-specialise-pour-votre-voyage-de-noces-ou-anniversaire-de-mariage-a-madagascar-2", "summary": "", "featured_image_url": "", "published_at": "2025-07-28 00:00:00", "category": "Conseils d'Experts"}, {"id": "303", "title": "10 Bonnes Raisons de Choisir Madagascar pour Votre Lune de Miel 🌴💕", "slug": "10-bonnes-raisons-de-choisir-madagascar-pour-votre-lune-de-miel-2", "summary": "", "featured_image_url": "", "published_at": "2024-06-01 00:00:00", "category": "Conseils d'Experts"}, {"id": "308", "title": "Excursion à Nosy Komba et Nosy Tanikely 🐢🐬🌴🌞🐒", "slug": "excursion-a-nosy-komba-et-nosy-tanikely", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations"}, {"id": "309", "title": "Mariage de Rêve à Nosy Iranja 💎💍", "slug": "mariage-de-reve-a-nosy-iranja", "summary": "", "featured_image_url": "", "published_at": "2024-11-21 16:27:04", "category": "Destinations"}, {"id": "312", "title": "Payer votre mariage de reve a nosy be en bitcoin ou cryptomonnaies 🤑", "slug": "payer-votre-mariage-de-reve-a-nosy-be-en-bitcoin-ou-cryptomonnaies", "summary": "", "featured_image_url": "", "published_at": "2024-12-06 17:39:53", "category": "Récits de Mariage"}, {"id": "314", "title": "💍✨ Mariage Madagascar – Votre Jour J, pensé dans les moindres détails ✨", "slug": "mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details", "summary": "", "featured_image_url": "", "published_at": "2025-03-07 00:00:00", "category": "Récits de Mariage"}, {"id": "1", "title": "Hello world!", "slug": "hello-world", "summary": "", "featured_image_url": "", "published_at": "2026-10-01 07:55:59", "category": "Art de Vivre"}, {"id": "304", "title": "Nosy Komba – Le paradis des lémuriens et des mariés 🌴💍 Copy", "slug": "nosy-komba-le-paradis-des-lemuriens-et-des-maries-copy", "summary": "", "featured_image_url": "", "published_at": "2025-11-02 00:00:00", "category": "Destinations"}, {"id": "310", "title": "🌟 Pourquoi un Mariage Symbolique est une Expérience Extraordinaire pour Vos Enfants 🌟", "slug": "pourquoi-un-mariage-symbolique-est-une-experience-extraordinaire-pour-vos-enfants-2", "summary": "", "featured_image_url": "", "published_at": "2025-09-20 00:00:00", "category": "Conseils d'Experts"}];

const grid=document.getElementById('blog-article-grid');
const featuredLink=document.getElementById('blog-featured-link');
const featuredImage=document.getElementById('blog-featured-image');
const featuredCategory=document.getElementById('blog-featured-category');
const featuredTitle=document.getElementById('blog-featured-title');
const featuredSummary=document.getElementById('blog-featured-summary');
const status=document.getElementById('blog-load-status');
const filters=Array.from(document.querySelectorAll('[data-blog-filter]'));
if(!grid)return;

function esc(v){
  return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function strip(v){
  const el=document.createElement('div'); el.innerHTML=v||'';
  return (el.textContent||'').replace(/\s+/g,' ').trim();
}
function canon(slug){ return String(slug||'').trim().replace(/^\/+|\/+$/g,'').replace(/-2$/,''); }
function internalUrl(post){ const s=canon(post.slug); return s?'/'+encodeURI(s):'#'; }
function firstImg(post){
  const m=String(post.content||'').match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?m[1]:'';
}
function imageCandidates(post){
  const folder=canon(post.slug), list=[];
  ['jpg','png','webp','gif','avif'].forEach(function(ext){
    const u='/assets/img/blog/'+encodeURI(folder)+'/01.'+ext;
    if(!list.includes(u))list.push(u);
  });
  if(post.image&&!list.includes(post.image))list.push(post.image);
  const c=post.contentImage||firstImg(post);
  if(c&&!list.includes(c))list.push(c);
  return list;
}
function setImage(img,post){
  const list=imageCandidates(post); let i=0;
  function next(){
    if(i>=list.length){img.removeAttribute('src'); return;}
    img.src=list[i++];
  }
  img.onerror=next; next();
}
function cat(post){
  if(post.category)return post.category;
  const s=((post.title||'')+' '+(post.slug||'')+' '+(post.content||'')).toLowerCase();
  if(/pourquoi|10-bonnes|10-villas|travel-planner/.test(s))return "Conseils d'Experts";
  if(/nosy-komba|nosy-sakatia|lokobe|paddle|excursion|nosy-iranja/.test(s))return "Destinations";
  if(/mariage|jour j|plage de rêve|plage-de-reve/.test(s))return "Récits de Mariage";
  return "Art de Vivre";
}
function normalize(post,imageMap){
  const id=post.id||post.legacy_wp_id||'';
  return {
    id:id, legacy_wp_id:post.legacy_wp_id||'', slug:post.slug||'',
    title:strip(post.title||''), summary:strip(post.summary||post.content||'').slice(0,260),
    image:(imageMap&&imageMap[String(id)])||post.featured_image_url||'',
    content:post.content||'', contentImage:firstImg(post),
    published_at:post.published_at||post.created_at||'',
    category:cat(post), internal_url:internalUrl(post)
  };
}
function fmt(v){
  if(!v)return ''; const d=new Date(v); if(Number.isNaN(d.getTime()))return '';
  return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric'}).format(d);
}
function chooseFeatured(arr){
  const wanted=['focus-festival-une-experience-unique-a-madagascar','les-joyaux-de-nosy-komba-pour-votre-lune-de-miel','paddle-et-diner-romantique-exceptionnel','mariage-madagascar-votre-jour-j-pense-dans-les-moindres-details','un-mariage-unique-sur-une-plage-de-reve'];
  for(const w of wanted){const f=arr.find(p=>canon(p.slug)===w);if(f)return f;}
  return arr.find(p=>canon(p.slug)!=='hello-world')||arr[0];
}
function renderFeatured(post){
  if(!post)return;
  featuredLink.href=post.internal_url;
  featuredLink.removeAttribute('target'); featuredLink.removeAttribute('rel');
  featuredCategory.textContent=post.category;
  featuredTitle.textContent=post.title;
  featuredSummary.textContent=post.summary||'Découvrez cet article sur Mariage Madagascar.';
  featuredImage.alt=post.title; setImage(featuredImage,post);
}
function renderGrid(arr){
  if(!arr.length){grid.innerHTML='<div class="col-span-full glass-panel rounded-xl p-8 text-center text-on-surface-variant">Aucun article dans cette catégorie.</div>';return;}
  grid.innerHTML=arr.map(function(post){
    const t=esc(post.title), s=esc(post.summary||'Découvrez cet article sur Mariage Madagascar.'), c=esc(post.category), d=esc(fmt(post.published_at)), h=esc(post.internal_url);
    return '<a href="'+h+'" class="glass-panel rounded-xl overflow-hidden group cursor-pointer hover-glow transition-all duration-300 flex flex-col h-full no-underline" aria-label="Lire '+t+'">'+
      '<div class="h-48 relative overflow-hidden bg-surface-container-high"><img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" alt="'+t+'"><div class="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent pointer-events-none"></div></div>'+
      '<div class="p-6 flex flex-col flex-grow"><span class="text-primary text-xs font-semibold tracking-wider uppercase mb-2">'+c+'</span>'+
      '<h3 class="font-headline text-xl font-medium text-on-surface mb-3 group-hover:text-primary transition-colors">'+t+'</h3>'+
      '<p class="text-on-surface-variant text-sm flex-grow line-clamp-3">'+s+'</p>'+
      '<div class="mt-4 text-xs text-on-surface-variant/70 flex items-center justify-between"><span>'+(d||'Article')+'</span><span class="material-symbols-outlined text-[16px] text-primary">arrow_outward</span></div></div></a>';
  }).join('');
  grid.querySelectorAll('img').forEach(function(img,i){setImage(img,arr[i]);});
}
let allPosts=[];
filters.forEach(function(btn){
  btn.addEventListener('click',function(){
    filters.forEach(function(b){const on=b===btn;b.classList.toggle('text-primary',on);b.classList.toggle('border-primary/40',on);b.classList.toggle('text-on-surface-variant',!on);});
    const f=btn.dataset.blogFilter;
    renderGrid(f==='all'?allPosts:allPosts.filter(function(p){return p.category===f;}));
  });
});
async function jsonFetch(url){
  const r=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:'Bearer '+SUPABASE_ANON_KEY}});
  if(!r.ok)throw new Error('Supabase HTTP '+r.status);
  return r.json();
}
async function loadSupabase(){
  const purl=SUPABASE_URL+'/rest/v1/blog_posts?select=id,legacy_wp_id,title,slug,summary,content,featured_image_url,published_at,created_at,is_published&is_published=eq.true&order=published_at.desc,created_at.desc';
  const iurl=SUPABASE_URL+'/rest/v1/blog_post_images?select=blog_post_id,image_url,sort_order,is_featured&order=sort_order.asc';
  const r=await Promise.all([jsonFetch(purl),jsonFetch(iurl)]), map={};
  (Array.isArray(r[1])?r[1]:[]).forEach(function(row){
    const id=String(row.blog_post_id||''); if(!id||!row.image_url)return;
    if(!map[id]||row.is_featured===true||Number(row.sort_order)===0)map[id]=row.image_url;
  });
  return (Array.isArray(r[0])?r[0]:[]).map(function(p){return normalize(p,map);});
}
async function init(){
  allPosts=FALLBACK_POSTS.map(function(p){return normalize(p,{});});
  allPosts.sort(function(a,b){return new Date(b.published_at||0)-new Date(a.published_at||0);});
  renderFeatured(chooseFeatured(allPosts)); renderGrid(allPosts);
  try{
    const remote=await loadSupabase();
    if(remote.length){
      allPosts=remote;
      allPosts.sort(function(a,b){return new Date(b.published_at||0)-new Date(a.published_at||0);});
      renderFeatured(chooseFeatured(allPosts)); renderGrid(allPosts);
      status.textContent=allPosts.length+' articles chargés depuis Supabase';
    }
  }catch(e){console.warn('Supabase indisponible, affichage local.',e);status.textContent=allPosts.length+' articles disponibles';}
}
init();
})();
