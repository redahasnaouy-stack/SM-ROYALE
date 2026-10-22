(() => {
 const $=id=>document.getElementById(id),tr=(en,ar)=>document.documentElement.lang==='ar'?ar:en,esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let data=null,failed=false,sent=false,sending=false;
 function render(){
  if(failed){$('reviews-summary').textContent=tr('Reviews are temporarily unavailable.','التقييمات غير متاحة مؤقتًا.');return;}
  if(!data)return;
  $('reviews-summary').textContent=data.count?tr(`${data.average.toFixed(1)} / 5 · ${data.count} published reviews`,`${data.average.toFixed(1)} / 5 · ${data.count} تقييمات منشورة`):tr('Be the first to share your experience.','كن أول من يشارك تجربته.');
  $('reviews-list').innerHTML=data.reviews.length?data.reviews.map(r=>`<article class="review-card"><div class="review-stars" role="img" aria-label="${r.rating} / 5">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div><h3>${esc(r.name)}</h3><p>${esc(r.message)}</p><time datetime="${esc(r.createdAt)}">${new Intl.DateTimeFormat(document.documentElement.lang==='ar'?'ar-MA':'en-GB',{dateStyle:'medium',timeZone:'Africa/Casablanca'}).format(new Date(r.createdAt))}</time></article>`).join(''):`<div class="reviews-empty">${tr('Your experience can help others choose. No reviews have been published yet.','تجربتك تساعد الآخرين على الاختيار. لم تُنشر أي تقييمات بعد.')}</div>`;
 }
 function feedback(){if(sent)$('review-feedback').textContent=tr('Thank you! Your review was received and will appear after moderation.','شكرًا لك! استُلم تقييمك وسيظهر بعد مراجعته.');}
 $('review-form').addEventListener('submit',async event=>{event.preventDefault();if(sending)return;const form=event.target,button=form.querySelector('button[type=submit]');sending=true;sent=false;button.disabled=true;$('review-feedback').textContent='';try{const response=await fetch('/api/reviews',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.elements.name.value,rating:Number(form.elements.rating.value),message:form.elements.message.value,consent:form.elements.consent.checked})});if(!response.ok)throw new Error();form.reset();sent=true;feedback();}catch{$('review-feedback').textContent=tr('Your review could not be sent. Please check your details and try again later.','تعذّر إرسال التقييم. يُرجى مراجعة البيانات والمحاولة لاحقًا.');}finally{button.disabled=false;sending=false;}});
 document.addEventListener('sm-language-change',()=>{render();feedback();});
 fetch('/api/reviews').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(value=>{data=value;render();}).catch(()=>{failed=true;render();});
})();
