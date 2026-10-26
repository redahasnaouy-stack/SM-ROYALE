(() => {
  const $=id=>document.getElementById(id),lang=()=>document.documentElement.lang==='ar'?'ar':'en',tr=(en,ar)=>lang()==='ar'?ar:en;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=c=>(c/100).toFixed(2)+tr(' DH',' درهم');
  let basket=[],products=[],online=false,step='basket',submitting=false,attempt=null,previousFocus=null;
  try{const stored=JSON.parse(localStorage.getItem('sm-basket')||'[]');if(Array.isArray(stored))basket=stored.filter(i=>i&&typeof i.productId==='string'&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=10000&&(i.variantIndex===null||Number.isInteger(i.variantIndex))&&typeof i.specification==='string').slice(0,50);}catch{}
  const save=()=>{try{localStorage.setItem('sm-basket',JSON.stringify(basket));}catch{}attempt=null;};
  function lines(){return basket.map((item,index)=>{const p=products.find(p=>p.id===item.productId),v=p?.variants[item.variantIndex],validVariant=!p?.variants.length?item.variantIndex===null:!!v&&(!v.key||v.key===item.variantKey);return {...item,index,product:p,variant:v,validVariant,price:validVariant&&v?Math.round(v.price*100):null};});}
  function summary(){const all=lines(),unknown=all.some(i=>i.price===null),subtotal=all.reduce((s,i)=>s+(i.price||0)*i.quantity,0);return `<div class="summary-row"><span>${tr('Products subtotal','المجموع الفرعي للمنتجات')}</span><strong>${unknown?tr('To be confirmed','يُحدَّد بعد المراجعة'):money(subtotal)}</strong></div>${unknown&&subtotal?`<div class="summary-row"><span>${tr('Priced items only','المنتجات المسعّرة فقط')}</span><span>${money(subtotal)}</span></div>`:''}<div class="summary-row"><span>${tr('Delivery','التوصيل')}</span><span>${tr('Confirmed before dispatch','يُؤكَّد قبل الشحن')}</span></div><p class="summary-note">${tr('Cash on delivery. Your final total, including delivery and any unpriced items, will be confirmed by phone before dispatch.','الدفع عند الاستلام. يُؤكَّد المبلغ النهائي، بما فيه التوصيل والمنتجات غير المسعّرة، هاتفيًا قبل الشحن.')}</p>`;}
  function setStep(value){step=value;render();$('cart-dialog').scrollTop=0;}
  function render(){
    $('cart-count').textContent=basket.reduce((sum,i)=>sum+i.quantity,0);document.querySelector('.cart-toggle')?.setAttribute('aria-label',tr('View basket','عرض سلة التسوق'));
    $('close-cart').setAttribute('aria-label',tr('Close basket','إغلاق سلة التسوق'));
    $('store-unavailable').hidden=online;
    for(const name of ['basket','checkout','confirmation']){$(name==='basket'?'basket-step':name+'-step').hidden=step!==name;$('step-'+name).classList.toggle('active',step===name);}
    const all=lines();$('basket-empty').hidden=basket.length!==0;$('proceed-checkout').hidden=basket.length===0;
    $('basket-lines').innerHTML=all.map(item=>`<article class="basket-line"><img src="${esc(item.product?.image||'/images/velora-logo.png')}" alt="${esc(item.product?.name[lang()]||item.productId)}"><div><span class="product-ref">${esc(item.productId)}</span><h3>${esc(item.product?.name[lang()]||item.productId)}</h3><p>${esc(item.variant?.size||item.specification||tr('Model to be confirmed','يُؤكَّد الطراز بعد المراجعة'))}</p>${item.variant&&item.specification?`<p>${esc(item.specification)}</p>`:''}<strong>${item.price===null?tr('Price to be confirmed','السعر بعد المراجعة'):money(item.price*item.quantity)}</strong>${!item.product||item.product.available===false||!item.validVariant?`<p class="field-error">${tr('This item or size has changed. Remove it and select the size again.','تغيّر هذا المنتج أو مقاسه. يُرجى حذفه واختيار المقاس مجددًا.')}</p>`:''}</div><div class="basket-controls"><label>${tr('Quantity','الكمية')}<input type="number" min="1" max="10000" value="${item.quantity}" data-quantity="${item.index}"></label><button type="button" class="remove-item" data-remove="${item.index}">${tr('Remove','حذف')}</button></div></article>`).join('');
    $('basket-summary').innerHTML=basket.length?summary():'';$('checkout-summary').innerHTML=summary();$('proceed-checkout').disabled=all.some(i=>!i.product||i.product.available===false||!i.validVariant);
    $('close-cart').disabled=submitting;document.querySelector('.back-to-basket').disabled=submitting;document.querySelectorAll('#checkout-step input,#checkout-step textarea').forEach(input=>input.disabled=submitting);
    $('submit-order').disabled=!online||submitting;if(submitting)$('submit-order').textContent=tr('Sending your order…','جارٍ إرسال الطلب…');
  }
  function open(){previousFocus=document.activeElement;if(!$('cart-dialog').open){setStep('basket');$('cart-dialog').showModal();}document.body.classList.add('dialog-open');}
  const toast=text=>{const el=$('shop-toast');el.textContent=text;el.classList.add('visible');clearTimeout(window.smToastTimer);window.smToastTimer=setTimeout(()=>el.classList.remove('visible'),3000);};
  window.SMShop={
    setProducts(value,isOnline){products=value.map(p=>({...p,image:new URL(p.image,location.origin+'/').pathname}));online=isOnline;render();},
    add(product,variantIndex,quantity,specification){
      if(product.available===false)return false;
      const match=basket.find(i=>i.productId===product.id&&i.variantIndex===variantIndex&&i.specification===specification&&i.variantKey===(product.variants[variantIndex]?.key||null));
      if(match){if(match.quantity+quantity>10000)return false;match.quantity+=quantity;}
      else {if(basket.length>=50)return false;basket.push({productId:product.id,variantIndex,variantKey:product.variants[variantIndex]?.key||null,quantity,specification});}
      save();render();toast(tr('Added to your basket','أُضيف المنتج إلى سلة التسوق'));return true;
    },open
  };
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-cart]')){event.preventDefault();open();}});
  $('close-cart').addEventListener('click',()=>$('cart-dialog').close());
  $('cart-dialog').addEventListener('cancel',event=>{if(submitting)event.preventDefault();});
  $('cart-dialog').addEventListener('close',()=>{document.body.classList.remove('dialog-open');previousFocus?.focus();});
  $('continue-shopping').addEventListener('click',()=>$('cart-dialog').close());$('finish-shopping').addEventListener('click',()=>$('cart-dialog').close());
  $('proceed-checkout').addEventListener('click',()=>{setStep('checkout');$('checkout-step').querySelector('input')?.focus();});
  document.querySelector('.back-to-basket').addEventListener('click',()=>setStep('basket'));
  $('basket-lines').addEventListener('click',event=>{const target=event.target.closest('[data-remove]');if(target){basket.splice(Number(target.dataset.remove),1);save();render();}});
  $('basket-lines').addEventListener('change',event=>{if(!event.target.matches('[data-quantity]'))return;const q=Number(event.target.value),index=Number(event.target.dataset.quantity);if(Number.isInteger(q)&&q>=1&&q<=10000){basket[index].quantity=q;save();}render();});
  $('checkout-step').addEventListener('input',()=>attempt=null);
  $('checkout-step').addEventListener('submit',async event=>{
    event.preventDefault();if(submitting||!online||!basket.length||!$('checkout-step').reportValidity())return;
    const form=new FormData(event.target),customer=Object.fromEntries(['name','phone','city','email','address','note'].map(k=>[k,String(form.get(k)||'').trim()]));
    const payload={customer,items:basket,consent:form.get('consent')==='on'};attempt ||= crypto.randomUUID();submitting=true;$('checkout-error').textContent='';render();
    try{
      const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attempt},body:JSON.stringify(payload)});
      const result=await response.json();if(!response.ok)throw new Error(result.error||tr('Unable to submit the order.','تعذّر إرسال الطلب.'));
      const summaryLines=lines().map(i=>`${i.product?.name[lang()]||i.productId} · ${i.variant?.size||i.specification||tr('Model to confirm','الطراز بعد المراجعة')} × ${i.quantity}`);
      const text=[tr('Hello VELORA, I would like to confirm my website order.','مرحبًا VELORA، أود تأكيد طلبي المسجّل عبر الموقع.'),result.order.reference,...summaryLines,tr('Products subtotal: ','المجموع الفرعي للمنتجات: ')+(result.order.subtotalCents===null?tr('To be confirmed','بعد المراجعة'):money(result.order.subtotalCents)),tr('Delivery and final total to be confirmed by your team.','يُرجى تأكيد رسوم التوصيل والمبلغ النهائي.')].join('\n');
      const whatsappUrl='https://wa.me/212600326082?text='+encodeURIComponent(text);
      $('confirm-whatsapp').href=whatsappUrl;$('confirmed-reference').textContent=result.order.reference;basket=[];save();event.target.reset();setStep('confirmation');
      window.location.assign(whatsappUrl);
    }catch(error){$('checkout-error').textContent=error.message||tr('Connection error. Please retry.','تعذّر الاتصال. يُرجى إعادة المحاولة.');}
    finally{submitting=false;render();$('submit-order').textContent=tr('Save order & continue on WhatsApp','تسجيل الطلب والمتابعة عبر واتساب');}
  });
  document.addEventListener('sm-language-change',render);render();
})();
