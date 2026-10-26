(() => {
 const page=document.body.dataset.page||'home';
 for(const link of document.querySelectorAll('header nav a'))if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');
 if(page!=='catalogue')fetch('/api/products').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(products=>window.SMShop?.setProducts(products,true)).catch(()=>window.SMShop?.setProducts([],false));
})();
