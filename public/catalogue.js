(() => {
  const $ = id => document.getElementById(id);
  if(!$('product-grid'))return;
  const categories = {
    all: {en:'All products', ar:'جميع المنتجات'}, bottles:{en:'Bottles & pumps',ar:'قوارير ومضخات'},
    jars:{en:'Jars & containers',ar:'علب ومرطبانات'}, perfume:{en:'Perfume & roll-ons',ar:'عبوات عطر ذات كرة دوارة'},
    pouches:{en:'Pouches',ar:'أكياس التغليف'}, accessories:{en:'Caps & accessories',ar:'أغطية وإكسسوارات'},wellness:{en:'Hijama & massage',ar:'الحجامة والتدليك'}
  };
  const wellness = [
    ['Cupping cups','كؤوس حجامة','4 / 5 / 6 / 7',1.50],['Hopi candles','شمع الهوبي','—',8.05],
    ['Bulb cupping cup','كأس حجامة بمضخة مطاطية','—',16.10],['4D cupping tool','أداة حجامة 4D','4D',40.25],
    ['Cupping suction pump','شفاط حجامة','—',5.75],['Glass cupping cup','كأس حجامة زجاجي','No2–c44',5.18],
    ['Glass cupping cup','كأس حجامة زجاجي','No3–c57',5.18],['Glass cupping cup','كأس حجامة زجاجي','No4–c67',5.18],
    ['Glass cupping cup','كأس حجامة زجاجي','No5–c70',5.18],['Cupping flame tool','شعلة','—',11.50],
    ['Oil dispenser','موزّع زيت','250 ml',4.60],['Oil bottle','قارورة زيت','500 ml',6.33],['Oil bottle','قارورة زيت','1 L',11.50]
  ];
  const lang = () => document.documentElement.lang === 'ar' ? 'ar':'en';
  const tr = (en,ar) => lang()==='ar'?ar:en;
  const money = value => Number(value).toFixed(2) + tr(' DH',' درهم');
  const sizeLabel = size => lang()==='en'?size:String(size).replace(/\bml\b/gi,'مل').replace(/\bkg\b/gi,'كغ').replace(/\bg\b/g,'غ').replace(/\bcm\b/gi,'سم').replace(/\bmm\b/gi,'مم').replace(/\bcarton A\b/gi,'الكرتون أ').replace(/\bcarton B\b/gi,'الكرتون ب').replace(/\bcarton\b/gi,'كرتون').replace(/\bpalette\b/gi,'منصة');
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let products=[],active=new URLSearchParams(location.search).get('category')||'all',limit=12,selected=null,previousFocus=null;
  const priceOf = p => p.variants.length ? Math.min(...p.variants.map(v=>v.price)) : null;
  function priceCatalogue(p){return p.variants.length?`<div class="product-prices-scroll"><table class="product-prices-table"><thead><tr><th scope="col">${tr('Size / option','المقاس / الخيار')}</th><th scope="col">${tr('Unit price','ثمن القطعة')}</th></tr></thead><tbody>${p.variants.map(v=>`<tr><th scope="row">${escape(sizeLabel(v.size))}</th><td><bdi>${money(v.price)}</bdi></td></tr>`).join('')}</tbody></table></div>`:`<p class="price-catalogue-pending">${tr('No confirmed price list is available for this model. Our team will confirm the price before shipping.','لا تتوفر قائمة أثمنة مؤكدة لهذا الطراز. يؤكد فريقنا الثمن قبل الشحن.')}</p>`;}
  function priceText(p){const min=priceOf(p);return min===null?tr('Ask for a price','استفسر عن السعر'): (p.variants.length>1?tr('From ','ابتداءً من '):'')+money(min);}
  function filterProducts(){
    const query=$('product-search').value.trim().toLocaleLowerCase().normalize('NFKC');
    const result=products.filter(p=>(active==='all'||p.category===active)&&[p.name.ar,p.name.en,p.id,...p.variants.map(v=>v.size)].join(' ').toLocaleLowerCase().normalize('NFKC').includes(query));
    const sort=$('product-sort').value;
    if(sort==='name')result.sort((a,b)=>a.name[lang()].localeCompare(b.name[lang()],lang()));
    if(sort==='price-asc'||sort==='price-desc')result.sort((a,b)=>{const ap=priceOf(a),bp=priceOf(b);if(ap===null)return bp===null?0:1;if(bp===null)return -1;return sort==='price-asc'?ap-bp:bp-ap;});
    return result;
  }
  function renderCategories(){
    const wrap=document.querySelector('.catalogue-filters');wrap.innerHTML='';
    Object.entries(categories).forEach(([key,name])=>{const button=document.createElement('button');button.type='button';button.textContent=name[lang()];button.className=active===key?'active':'';button.setAttribute('aria-pressed',String(active===key));button.addEventListener('click',()=>{active=key;limit=12;renderCategories();render();});wrap.append(button);});
    wrap.setAttribute('aria-label',tr('Product categories','فئات المنتجات'));
  }
  function render(){
    const filtered=filterProducts(),visible=filtered.slice(0,limit);
    $('product-grid').innerHTML=visible.map(p=>`<article class="product-card"><div class="product-card-top"><span class="product-category">${escape(categories[p.category][lang()])}</span><span class="product-ref" dir="ltr">${p.id}</span></div><button type="button" class="product-image-button" data-product="${p.id}" aria-label="${escape(tr('View ','عرض ')+p.name[lang()])}"><span class="product-photo-shell ${p.photoPlaceholder?'photo-placeholder':''}"><img src="${p.image}" alt="${escape(p.name[lang()])}" loading="lazy" decoding="async" width="800" height="800"></span>${p.photoPlaceholder?`<span class="photo-placeholder-label">${tr('Photo coming soon','الصورة غير متاحة حاليًا')}</span>`:''}<span class="product-image-action">${tr('Discover the details','اكتشف التفاصيل')}</span><span class="product-zoom" aria-hidden="true">+</span></button><div class="product-info"><span class="product-signature" aria-hidden="true"><i></i> VELORA <i></i></span><h3><button type="button" data-product="${p.id}">${escape(p.name[lang()])}</button></h3><details class="card-price-list"><summary>${tr('Price catalogue','قائمة الأثمنة')}</summary>${priceCatalogue(p)}</details><div class="product-size-preview">${p.variants.length?escape(p.variants.map(v=>v.size).join(' · ')):tr('Ask us about available models','استفسر عن الطرازات المتاحة')}</div><div class="product-bottom"><div class="product-price-wrap"><span class="product-price-label">${p.variants.length?tr('LISTED PRICE','السعر المدرج'):tr('PERSONALISED ENQUIRY','استفسار عن المنتج')}</span><span class="product-price ${p.variants.length?'has-price':''}">${priceText(p)}</span></div><button type="button" class="product-arrow" data-product="${p.id}" aria-label="${escape(tr('Enquire about ','استفسر عن ')+p.name[lang()])}"><span class="sr-only">${tr('View product','تفاصيل المنتج')}</span></button></div></div></article>`).join('');
    $('product-count').textContent=tr(`${filtered.length} products · showing ${visible.length}`,`${filtered.length} منتجًا · المعروض: ${visible.length}`);
    $('load-more').hidden=visible.length>=filtered.length;$('catalogue-empty').hidden=filtered.length!==0;
    $('product-search').placeholder=tr('Search products, sizes, references…','ابحث بالاسم أو المقاس أو الرقم المرجعي…');
    $('product-grid').setAttribute('aria-busy','false');
  }
  function renderWellness(){
    $('wellness-price-rows').innerHTML=wellness.map(row=>`<tr><th scope="row">${escape(row[lang()==='ar'?1:0])}</th><td dir="ltr">${escape(row[2])}</td><td>${money(row[3])}</td></tr>`).join('');
  }
  function updateDetailPrice(){
    if(!selected)return;
    const v=selected.variants[Number($('detail-variant').value)];
    $('detail-price').textContent=v?tr('Unit price: ','ثمن القطعة: ')+money(v.price):tr('Price on request','السعر عند الطلب');
    const packaging=document.getElementById('detail-packaging');if(packaging)packaging.textContent=[v?.cartonQuantity?tr('Pieces per carton: ','عدد القطع في الكرتون: ')+v.cartonQuantity:'',v?.supplierReference?tr('Supplier reference: ','مرجع المورّد: ')+v.supplierReference:''].filter(Boolean).join(' · ');

  }
  function populateDetails(){
    const p=selected;if(!p)return;
    $('detail-gallery').innerHTML=(p.images?.length?p.images:[p.image]).map((image,i)=>`<button type="button" data-gallery-index="${i}" aria-label="${tr('View image ','عرض الصورة ')+(i+1)}" aria-pressed="${i===0}"><img src="${escape(image)}" alt="" loading="lazy"></button>`).join('');
    $('detail-image').src=p.image;$('detail-image').alt=p.photoPlaceholder?tr('VELORA — product photo unavailable','VELORA — صورة المنتج غير متاحة'):p.name[lang()];$('detail-name').textContent=p.name[lang()];
    $('detail-category').textContent=categories[p.category][lang()];$('detail-reference').textContent=tr('Reference: ','المرجع: ')+p.id;
    $('detail-description').textContent=p.description?.[lang()]||(p.photoPlaceholder?tr('Product specifications and prices are taken from our price list. A product photograph is not available yet.','مواصفات المنتج وأسعاره من قائمة الأسعار المعتمدة. صورة المنتج غير متاحة حاليًا.'):tr('Product visual supplied by VELORA. Tell us which model, colour and quantity you need.','صورة المنتج مقدمة من VELORA. يُرجى تحديد الطراز واللون والكمية المطلوبة.'));
    const selectedIndex=$('detail-variant').value;
    $('detail-variant').innerHTML=p.variants.map((v,i)=>`<option value="${i}">${escape(sizeLabel(v.size))}</option>`).join('');
    if(selectedIndex&&p.variants[Number(selectedIndex)])$('detail-variant').value=selectedIndex;
    $('variant-label').hidden=$('detail-variant').hidden=!p.variants.length;
    $('detail-price-catalogue').innerHTML=`<h3>${tr('Price catalogue','قائمة الأثمنة')}</h3>${priceCatalogue(p)}`;
    $('detail-add-to-cart').disabled=p.available===false;$('detail-full-image').href=p.image;$('close-product').setAttribute('aria-label',tr('Close product','إغلاق تفاصيل المنتج'));updateDetailPrice();
  }
  function openProduct(id){
    selected=products.find(p=>p.id===id);if(!selected)return;
    previousFocus=document.activeElement;$('detail-quantity').value='1';$('detail-specification').value='';$('detail-added').textContent='';$('detail-variant').value='0';populateDetails();$('product-dialog').showModal();document.body.classList.add('dialog-open');
  }
  $('product-dialog').addEventListener('close',()=>{document.body.classList.remove('dialog-open');previousFocus?.focus();});
  $('close-product').addEventListener('click',()=>$('product-dialog').close());
  $('product-dialog').addEventListener('click',event=>{if(event.target===$('product-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  $('product-grid').addEventListener('click',event=>{const button=event.target.closest('[data-product]');if(button)openProduct(button.dataset.product);});
  $('detail-view-basket').addEventListener('click',()=>{$('product-dialog').close();window.SMShop?.open();});
  $('detail-gallery').addEventListener('click',event=>{const button=event.target.closest('[data-gallery-index]');if(!button||!selected)return;const images=selected.images?.length?selected.images:[selected.image];$('detail-image').src=images[Number(button.dataset.galleryIndex)];$('detail-full-image').href=$('detail-image').src;for(const b of $('detail-gallery').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b===button));});
  $('detail-variant').addEventListener('change',updateDetailPrice);
  $('detail-add-to-cart').addEventListener('click',()=>{
    const quantity=Number($('detail-quantity').value);if(!Number.isInteger(quantity)||quantity<1||quantity>10000){$('detail-quantity').reportValidity();return;}
    const success=window.SMShop?.add(selected,selected.variants.length?Number($('detail-variant').value):null,quantity,$('detail-specification').value.trim());
    $('detail-added').textContent=success?tr('Added to your basket. You can continue shopping or view your basket.','أُضيف المنتج إلى السلة. يمكنك متابعة التسوق أو عرض سلة التسوق.'):tr('Unable to add this quantity.','تعذّرت إضافة هذه الكمية.');
  });
  $('product-search').addEventListener('input',()=>{limit=12;render();});$('product-sort').addEventListener('change',()=>{limit=12;render();});
  $('load-more').addEventListener('click',()=>{const previous=limit;limit+=12;render();const next=$('product-grid').querySelectorAll('.product-image-button')[previous];next?.focus({preventScroll:true});});
  $('reset-products').addEventListener('click',()=>{active='all';limit=12;$('product-search').value='';$('product-sort').value='featured';renderCategories();render();$('product-search').focus();});
  document.querySelectorAll('[data-open-category]').forEach(el=>el.addEventListener('click',()=>{active=el.dataset.openCategory;limit=12;$('product-search').value='';renderCategories();render();}));
  document.addEventListener('sm-language-change',()=>{renderCategories();render();renderWellness();populateDetails();});
  async function load(){
    $('catalogue-error').hidden=true;$('product-grid').setAttribute('aria-busy','true');
    try{const online=true,response=await fetch('/api/products');if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('catalogue');products=await response.json();products=products.map(p=>({...p,image:new URL(p.image,location.origin+'/').pathname,images:p.images?.map(image=>new URL(image,location.origin+'/').pathname)}));window.SMShop?.setProducts(products,online);renderCategories();render();}
    catch{window.SMShop?.setProducts([],false);$('product-grid').replaceChildren();$('catalogue-error').hidden=false;$('product-grid').setAttribute('aria-busy','false');$('product-count').textContent='';$('catalogue-empty').hidden=true;$('load-more').hidden=true;}
  }
  $('retry-products').addEventListener('click',load);renderCategories();renderWellness();load();
})();
