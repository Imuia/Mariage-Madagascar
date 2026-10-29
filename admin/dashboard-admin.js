/* Tableau de bord — données réelles de orders/payments; tâches personnelles locales */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c='EUR')=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:c||'EUR',maximumFractionDigits:2}).format(Number(v)||0);
const dateText=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeStyle:'short'}).format(d)};
function client(){
 const x=[window.supabaseClient,window.mmSupabase,window.sb,window._supabase,window.supabaseInstance].find(v=>v&&typeof v.from==='function');if(x)return x;
 const c=window.MARIAGE_SUPABASE,s=window.supabase,u=c&&(c.url||c.supabaseUrl||c.SUPABASE_URL),k=c&&(c.anonKey||c.publishableKey||c.supabaseKey||c.supabaseAnonKey||c.SUPABASE_ANON_KEY||c.key);
 if(u&&k&&s&&typeof s.createClient==='function'){const x=s.createClient(u,k);window.supabaseClient=x;window.mmSupabase=window.mmSupabase||x;return x}return null;
}
let orders=[],payments=[];
const isPaid=o=>['paid','confirmed','succeeded','complete','completed'].includes(String(o.payment_status||o.status||'').toLowerCase());
const isPending=o=>['pending','processing','awaiting_payment','unpaid'].includes(String(o.payment_status||o.status||'').toLowerCase());
function renderKpis(){
 const ok=payments.filter(p=>['succeeded','paid','confirmed'].includes(String(p.status||'').toLowerCase()));
 const total=ok.reduce((s,p)=>s+(Number(p.amount)||0),0),confirmed=orders.filter(isPaid).length,pending=orders.filter(isPending).length;
 $('#dashboard-revenue').textContent=money(total,ok[0]?.currency||'EUR');
 $('#dashboard-revenue-note').textContent=`${ok.length} paiement(s) confirmé(s)`;
 $('#dashboard-confirmed-orders').textContent=String(confirmed);
 $('#dashboard-pending-orders').textContent=String(pending);
 $('#dashboard-orders-note').textContent=`sur ${orders.length} commande(s)`;
 $('#dashboard-payment-rate').textContent=`${(orders.length?confirmed/orders.length*100:0).toLocaleString('fr-FR',{maximumFractionDigits:1})}%`;
 $('#dashboard-payment-rate-note').textContent=`${confirmed} confirmée(s) / ${orders.length} commande(s)`;
}
function renderChart(){
 const root=$('#dashboard-chart');if(!root)return;
 const year=Number($('#dashboard-year')?.value)||new Date().getFullYear(),vals=Array(12).fill(0);
 payments.filter(p=>['succeeded','paid','confirmed'].includes(String(p.status||'').toLowerCase())).forEach(p=>{const d=new Date(p.created_at);if(!Number.isNaN(d.getTime())&&d.getFullYear()===year)vals[d.getMonth()]+=Number(p.amount)||0});
 const max=Math.max(...vals,1),w=720,h=250,l=48,r=12,t=14,b=30,pw=w-l-r,ph=h-t-b,months=['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
 const pts=vals.map((v,i)=>({x:l+i*pw/11,y:t+ph-v/max*ph,v})),path=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),area=`${path} L${pts[11].x},${t+ph} L${pts[0].x},${t+ph} Z`;
 const grid=[0,.25,.5,.75,1].map(q=>{const y=t+ph-q*ph;return`<line x1="${l}" y1="${y}" x2="${w-r}" y2="${y}" stroke="#7dd3fc" stroke-opacity=".12"/><text x="${l-8}" y="${y+4}" fill="#a0b4c4" font-size="10" text-anchor="end">${Math.round(max*q).toLocaleString('fr-FR')}</text>`}).join('');
 const labels=months.map((m,i)=>`<text x="${pts[i].x}" y="${h-8}" fill="#a0b4c4" font-size="10" text-anchor="middle">${m}</text>`).join('');
 root.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Recettes encaissées en ${year}" preserveAspectRatio="none">${grid}<path d="${area}" fill="#7dd3fc" fill-opacity=".12"/><path d="${path}" fill="none" stroke="#7dd3fc" stroke-width="2.5"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#0f1524" stroke="#7dd3fc"><title>${money(p.v)}</title></circle>`).join('')}${labels}</svg>`;
 $('#dashboard-chart-note').textContent=`Recettes encaissées par mois · ${money(vals.reduce((a,b)=>a+b,0))} sur ${year}`;
}
function renderActivity(){
 const root=$('#dashboard-activity');if(!root)return;root.replaceChildren();
 const events=[];
 payments.forEach(p=>events.push({date:p.created_at,icon:'payments',title:`Paiement ${['succeeded','paid','confirmed'].includes(String(p.status||'').toLowerCase())?'confirmé':'mis à jour'}`,detail:`${p.payment_method||'Paiement'} · ${money(p.amount,p.currency)} · ${p.status||'statut inconnu'}`}));
 orders.forEach(o=>events.push({date:o.updated_at||o.created_at,icon:'receipt_long',title:`Commande ${o.order_number||''}`.trim(),detail:`${[o.guest_first_name,o.guest_last_name].filter(Boolean).join(' ')||o.guest_email||'Client non renseigné'} · ${money(o.total_amount,o.currency)} · ${o.status||o.payment_status||'statut non précisé'}`}));
 events.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
 if(!events.length){const d=document.createElement('div');d.className='p-6 text-sm text-on-surface-variant';d.textContent='Aucune activité disponible dans les commandes et paiements accessibles.';root.append(d);return}
 events.slice(0,8).forEach(e=>{const row=document.createElement('div');row.className='p-4 sm:p-6 flex items-center gap-4 hover:bg-primary/[0.02] transition-colors';
 const icon=document.createElement('div');icon.className='w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0';const g=document.createElement('span');g.className='material-symbols-outlined text-primary text-lg';g.textContent=e.icon;icon.append(g);
 const body=document.createElement('div');body.className='flex-1 min-w-0';const title=document.createElement('p');title.className='text-sm font-medium text-on-surface';title.textContent=e.title;const detail=document.createElement('p');detail.className='text-xs text-on-surface-variant mt-0.5';detail.textContent=e.detail;body.append(title,detail);
 const time=document.createElement('div');time.className='text-right flex-shrink-0 text-xs text-on-surface-variant';time.textContent=dateText(e.date);row.append(icon,body,time);root.append(row)});
}
function tasks(){const key='mm_admin_dashboard_tasks_v1';const root=$('#dashboard-tasks');if(!root)return;let list=[];try{list=JSON.parse(localStorage.getItem(key)||'[]')}catch(_){}
 root.replaceChildren();const note=document.createElement('p');note.className='text-xs text-on-surface-variant mb-2';note.textContent='Tâches personnelles enregistrées dans ce navigateur (pas synchronisées avec Supabase).';root.append(note);
 if(!list.length){const empty=document.createElement('p');empty.className='text-sm text-on-surface-variant p-3';empty.textContent='Aucune tâche. Utilise + pour en ajouter.';root.append(empty);return}
 list.forEach(task=>{const row=document.createElement('div');row.className='flex items-start gap-3 p-3 rounded-xl border border-outline-variant/30';const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!task.done;cb.className='mt-1 accent-sky-300';cb.addEventListener('change',()=>{const a=JSON.parse(localStorage.getItem(key)||'[]');const t=a.find(x=>x.id===task.id);if(t)t.done=cb.checked;localStorage.setItem(key,JSON.stringify(a));tasks()});const title=document.createElement('span');title.className=task.done?'text-sm line-through text-on-surface-variant':'text-sm';title.textContent=task.title;const del=document.createElement('button');del.type='button';del.className='ml-auto text-xs text-red-300';del.textContent='Supprimer';del.addEventListener('click',()=>{localStorage.setItem(key,JSON.stringify(JSON.parse(localStorage.getItem(key)||'[]').filter(x=>x.id!==task.id)));tasks()});row.append(cb,title,del);root.append(row)});
}
function addTask(){const title=prompt('Intitulé de la tâche à ajouter :');if(!title||!title.trim())return;const key='mm_admin_dashboard_tasks_v1';let a=[];try{a=JSON.parse(localStorage.getItem(key)||'[]')}catch(_){}a.unshift({id:Date.now().toString(36),title:title.trim(),done:false});localStorage.setItem(key,JSON.stringify(a));tasks()}
async function load(){
 const status=$('#dashboard-sync-status'),btn=$('#dashboard-refresh');if(status)status.textContent='Chargement depuis Supabase…';if(btn){btn.disabled=true;btn.textContent='Chargement…'}
 const c=client();if(!c){if(status)status.textContent='Client Supabase introuvable. Vérifie supabase-config.js et admin-auth.js.';if(btn){btn.disabled=false;btn.textContent='Actualiser les données'}return}
 try{
 const [o,p]=await Promise.all([c.from('orders').select('id,order_number,guest_first_name,guest_last_name,guest_email,total_amount,currency,status,payment_status,created_at,updated_at').order('created_at',{ascending:false}).limit(500),c.from('payments').select('id,order_id,amount,currency,status,payment_method,created_at').order('created_at',{ascending:false}).limit(1000)]);
 if(o.error)throw new Error('Commandes : '+o.error.message);orders=o.data||[];
 if(p.error){payments=[];console.warn('[Dashboard] Paiements indisponibles',p.error.message)}else payments=p.data||[];
 const sel=$('#dashboard-year'),years=new Set([new Date().getFullYear()]);payments.forEach(x=>{const d=new Date(x.created_at);if(!Number.isNaN(d.getTime()))years.add(d.getFullYear())});const old=Number(sel.value);sel.replaceChildren(...[...years].sort((a,b)=>b-a).map(y=>{const op=document.createElement('option');op.value=y;op.textContent=y;return op}));sel.value=String(years.has(old)?old:Math.max(...years));
 renderKpis();renderChart();renderActivity();if(status)status.textContent=`Données réelles chargées : ${orders.length} commande(s), ${payments.length} paiement(s).${p.error?' La table des paiements est inaccessible : '+p.error.message:''}`;
 }catch(e){console.error('[Dashboard]',e);if(status)status.textContent='Erreur Supabase : '+(e.message||'inconnue');$('#dashboard-activity').innerHTML=`<div class="p-6 text-sm text-red-300">${esc(e.message||'Erreur Supabase')}</div>`}
 finally{if(btn){btn.disabled=false;btn.textContent='Actualiser les données'}}
}
$('#dashboard-refresh')?.addEventListener('click',load);$('#dashboard-year')?.addEventListener('change',renderChart);$('#dashboard-add-task')?.addEventListener('click',addTask);tasks();load();
})();