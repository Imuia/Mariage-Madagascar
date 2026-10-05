/* Mariage Madagascar — composants globaux */
(function(){
  'use strict';

  async function mount(selector, url){
    const target=document.querySelector(selector);
    if(!target) return;

    try{
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok) throw new Error('HTTP '+response.status+' — '+url);
      target.innerHTML=await response.text();

      // Ré-exécute les scripts éventuels contenus dans le fragment.
      target.querySelectorAll('script').forEach(oldScript=>{
        const s=document.createElement('script');
        for(const attr of oldScript.attributes) s.setAttribute(attr.name,attr.value);
        s.textContent=oldScript.textContent;
        oldScript.replaceWith(s);
      });
    }catch(error){
      console.error('Composant global impossible à charger:',url,error);
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    mount('[data-global-header]','/components/header.html');
    mount('[data-global-footer]','/components/footer.html');
  });
})();
