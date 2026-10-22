(() => {
  const $ = id => document.getElementById(id);
  const categories = {
    all: {en:'All products', ar:'جميع المنتجات'}, bottles:{en:'Bottles & pumps',ar:'قنينات ومضخات'},
    jars:{en:'Jars & containers',ar:'علب وبرطمانات'}, perfume:{en:'Perfume & roll-ons',ar:'عطر ورول أون'},
    pouches:{en:'Pouches',ar:'أكياس التغليف'}, accessories:{en:'Caps & accessories',ar:'أغطية وإكسسوارات'},wellness:{en:'Hijama & massage',ar:'حجامة ومساج'}
  };
  const wellness = [
    ['Cupping cups','كؤوس حجامة','4 / 5 / 6 / 7',1.50],['Hopi candles','شمع الهوبي','—',8.05],
    ['Bulb cupping cup','حجامة بواطة','—',16.10],['4D cupping tool','أداة حجامة 4D','4D',40.25],
    ['Cupping suction pump','شفاط حجامة','—',5.75],['Glass cupping cup','كأس حجامة زجاجي','No2–c44',5.18],
    ['Glass cupping cup','كأس حجامة زجاجي','No3–c57',5.18],['Glass cupping cup','كأس حجامة زجاجي','No4–c67',5.18],
    ['Glass cupping cup','كأس حجامة زجاجي','No5–c70',5.18],['Cupping flame tool','شعلة','—',11.50],
    ['Oil dispenser','كأس باميو','250 ml',4.60],['Oil bottle','زيتة','500 ml',6.33],['Oil bottle','قنينة زيت','1 L',11.50]
  ];
  const lang = () => document.documentElement.lang === 'ar' ? 'ar':'en';
  const tr = (en,ar) => lang()==='ar'?ar:en;
  const money = value => Number(value).toFixed(2) + tr(' DH',' درهم');
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let products=[],active='all',limit=12,selected=null,previousFocus=null;
  const priceOf = p => p.variants.length ? Math.min(...p.variants.map(v=>v.price)) : null;
  function priceText(p){const min=priceOf(p);return min===null?tr('Ask for a price','طلب الثمن'): (p.variants.length>1?tr('From ','ابتداءً من '):'')+money(min);}
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
    $('product-grid').innerHTML=visible.map(p=>`<article class="product-card"><div class="product-card-top"><span class="product-category">${escape(categories[p.category][lang()])}</span><span class="product-ref" dir="ltr">${p.id}</span></div><button type="button" class="product-image-button" data-product="${p.id}" aria-label="${escape(tr('View ','شوف ')+p.name[lang()])}"><span class="product-photo-shell"><img src="${p.image}" alt="${escape(p.name[lang()])}" loading="lazy" decoding="async" width="800" height="800"></span><span class="product-image-action">${tr('Discover the details','اكتشف التفاصيل')}</span><span class="product-zoom" aria-hidden="true">+</span></button><div class="product-info"><span class="product-signature" aria-hidden="true"><i></i> SM ROYALE <i></i></span><h3><button type="button" data-product="${p.id}">${escape(p.name[lang()])}</button></h3><div class="product-size-preview">${p.variants.length?escape(p.variants.map(v=>v.size).join(' · ')):tr('Ask us about available models','اسألنا عن الموديلات المتوفرة')}</div><div class="product-bottom"><div class="product-price-wrap"><span class="product-price-label">${p.variants.length?tr('LISTED PRICE','الثمن فاللائحة'):tr('PERSONALISED ENQUIRY','استفسار على المنتوج')}</span><span class="product-price ${p.variants.length?'has-price':''}">${priceText(p)}</span></div><button type="button" class="product-arrow" data-product="${p.id}" aria-label="${escape(tr('Enquire about ','سولنا على ')+p.name[lang()])}"><span class="sr-only">${tr('View product','تفاصيل المنتوج')}</span></button></div></div></article>`).join('');
    $('product-count').textContent=tr(`${filtered.length} products · showing ${visible.length}`,`${filtered.length} منتوج · عرض ${visible.length}`);
    $('load-more').hidden=visible.length>=filtered.length;$('catalogue-empty').hidden=filtered.length!==0;
    $('product-search').placeholder=tr('Search products, sizes, references…','قلب بالاسم، المقاس أو المرجع…');
    $('product-grid').setAttribute('aria-busy','false');
  }
  function renderWellness(){
    $('wellness-price-rows').innerHTML=wellness.map(row=>`<tr><th scope="row">${escape(row[lang()==='ar'?1:0])}</th><td dir="ltr">${escape(row[2])}</td><td>${money(row[3])}</td></tr>`).join('');
  }
  function updateDetailPrice(){
    if(!selected)return;
    const v=selected.variants[Number($('detail-variant').value)];
    $('detail-price').textContent=v?money(v.price):tr('Price on request','الثمن عند الطلب');
    const message=lang()==='ar'?`السلام عليكم، بغيت معلومات على ${selected.name.ar}، المرجع ${selected.id}${v?'، المقاس '+v.size+'، الثمن فالكاتالوغ '+money(v.price):''}. واش متوفر وشنو شروط الطلب؟`:`Hello, I would like information about ${selected.name.en}, reference ${selected.id}${v?', size '+v.size+', listed price '+money(v.price):''}. Please confirm availability and order conditions.`;
    $('detail-whatsapp').href='https://wa.me/212600326082?text='+encodeURIComponent(message);
  }
  function populateDetails(){
    const p=selected;if(!p)return;
    $('detail-image').src=p.image;$('detail-image').alt=p.name[lang()];$('detail-name').textContent=p.name[lang()];
    $('detail-category').textContent=categories[p.category][lang()];$('detail-reference').textContent=tr('Reference: ','المرجع: ')+p.id;
    $('detail-description').textContent=tr('Product visual supplied by SM Royale. Tell us which model, colour and quantity you need.','صورة المنتوج من SM Royale. قول لينا شنو الموديل واللون والكمية اللي بغيتي.');
    const selectedIndex=$('detail-variant').value;
    $('detail-variant').innerHTML=p.variants.map((v,i)=>`<option value="${i}">${escape(v.size)} — ${money(v.price)}</option>`).join('');
    if(selectedIndex&&p.variants[Number(selectedIndex)])$('detail-variant').value=selectedIndex;
    $('variant-label').hidden=$('detail-variant').hidden=!p.variants.length;
    $('detail-full-image').href=p.image;$('close-product').setAttribute('aria-label',tr('Close product','سد تفاصيل المنتوج'));updateDetailPrice();
  }
  function openProduct(id){
    selected=products.find(p=>p.id===id);if(!selected)return;
    previousFocus=document.activeElement;$('detail-variant').value='0';populateDetails();$('product-dialog').showModal();document.body.classList.add('dialog-open');
  }
  $('product-dialog').addEventListener('close',()=>{document.body.classList.remove('dialog-open');previousFocus?.focus();});
  $('close-product').addEventListener('click',()=>$('product-dialog').close());
  $('product-dialog').addEventListener('click',event=>{if(event.target===$('product-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
  $('product-grid').addEventListener('click',event=>{const button=event.target.closest('[data-product]');if(button)openProduct(button.dataset.product);});
  $('detail-variant').addEventListener('change',updateDetailPrice);
  $('product-search').addEventListener('input',()=>{limit=12;render();});$('product-sort').addEventListener('change',()=>{limit=12;render();});
  $('load-more').addEventListener('click',()=>{const previous=limit;limit+=12;render();const next=$('product-grid').querySelectorAll('.product-image-button')[previous];next?.focus({preventScroll:true});});
  $('reset-products').addEventListener('click',()=>{active='all';limit=12;$('product-search').value='';$('product-sort').value='featured';renderCategories();render();$('product-search').focus();});
  document.querySelectorAll('[data-open-category]').forEach(el=>el.addEventListener('click',()=>{active=el.dataset.openCategory;limit=12;$('product-search').value='';renderCategories();render();}));
  document.addEventListener('sm-language-change',()=>{renderCategories();render();renderWellness();populateDetails();});
  async function load(){
    $('catalogue-error').hidden=true;$('product-grid').setAttribute('aria-busy','true');
    try{const response=await fetch('./products.json');if(!response.ok)throw new Error('HTTP '+response.status);products=await response.json();renderCategories();render();}
    catch{$('catalogue-error').hidden=false;$('product-grid').setAttribute('aria-busy','false');$('product-count').textContent='';$('catalogue-empty').hidden=true;$('load-more').hidden=true;}
  }
  $('retry-products').addEventListener('click',load);renderCategories();renderWellness();load();
})();
