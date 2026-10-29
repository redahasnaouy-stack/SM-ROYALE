import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const bundle=path.resolve('.wrangler/test-bundle');
async function fixture(t,withMedia=false){
 const password=randomBytes(24).toString('hex'),mf=new Miniflare(convertV4MiniflareOptions({modules:true,modulesRoot:bundle,scriptPath:path.join(bundle,'worker.js'),compatibilityDate:'2026-10-27',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],...(withMedia?{r2Buckets:['MEDIA']}:{}),bindings:{SM_ADMIN_EMAIL:'cf-owner@example.test',SM_ADMIN_PASSWORD:password},serviceBindings:{ASSETS:request=>new Response('Static asset: '+new URL(request.url).pathname)}}));t.after(()=>mf.dispose());
 const call=async(route,method='GET',data,headers={})=>{const response=await mf.dispatchFetch('https://velora.example'+route,{method,headers:{'Content-Type':'application/json',Origin:'https://velora.example',...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});return {response,status:response.status,data:await response.json()};};
 const login=await call('/api/admin/login','POST',{email:'cf-owner@example.test',password});assert.equal(login.status,200);const auth={Cookie:login.response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':login.data.csrf};return {mf,call,auth};
}
test('real Cloudflare runtime runs the entire dashboard API with D1, image storage, checkout and optimistic edits',async t=>{
 const {mf,call,auth}=await fixture(t);assert.match(await(await mf.dispatchFetch('https://velora.example/')).text(),/Static asset/);
 const products=(await call('/api/products')).data;assert.equal(products.length,250);assert(products.every(p=>p.variants.length&&p.variants.every(v=>v.price===null)));assert.equal((await call('/api/admin/products')).status,401);
 const imageBytes=await readFile(new URL('../public/images/products/007.webp',import.meta.url));assert(imageBytes.length>65536);const image=await call('/api/admin/product-images','POST',{base64:imageBytes.toString('base64')},auth);assert.equal(image.status,201);const imageResponse=await mf.dispatchFetch('https://velora.example'+image.data.image);assert.equal(imageResponse.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),imageBytes);
 const created=await call('/api/admin/products','POST',{available:true,name:{ar:'منتج اختبار Cloudflare',en:'Cloudflare test product'},description:{ar:'وصف تجريبي',en:'Test description'},category:'bottles',images:[image.data.image,'/images/products/139.webp'],variants:[{size:'50 ml',price:12.5}]},auth);assert.equal(created.status,201);const product=created.data.product;
 const payload={customer:{name:'عميل اختبار',phone:'0600000000',city:'الدار البيضاء',address:'عنوان اختبار غير حقيقي',email:'',note:''},items:[{productId:product.id,variantIndex:0,variantKey:product.variants[0].key,quantity:2,specification:''}],consent:true},key=randomUUID();
 const orders=await Promise.all([call('/api/orders','POST',payload,{'Idempotency-Key':key}),call('/api/orders','POST',payload,{'Idempotency-Key':key})]);assert(orders.every(r=>r.status===200||r.status===201));assert.equal(orders[0].data.order.reference,orders[1].data.order.reference);assert.equal(orders[0].data.order.subtotalCents,2500);
 const storedOrders=(await call('/api/admin/orders','GET',undefined,auth)).data.orders;assert.equal(storedOrders.length,1);
 const changed=await call('/api/admin/products/'+product.id,'PATCH',{version:product.version,available:true,name:{ar:'اسم معدّل',en:'Edited name'},images:[image.data.image],variants:[{size:'50 ml',price:15}]},auth);assert.equal(changed.status,200);
 assert.equal((await call('/api/admin/products/'+product.id,'PATCH',{version:product.version,available:false,variants:product.variants},auth)).status,409);
 assert.equal((await call('/api/admin/orders','GET',undefined,auth)).data.orders[0].items[0].unitPriceCents,1250);
 assert.equal((await call('/api/reviews','POST',{name:'عميل اختبار',rating:4,message:'رأي تجريبي لا يخص عميلًا حقيقيًا.',consent:true})).status,201);assert.equal((await call('/api/reviews')).data.count,0);const review=(await call('/api/admin/reviews','GET',undefined,auth)).data.reviews[0];assert.equal((await call('/api/admin/reviews/'+review.id,'PATCH',{status:'approved',version:review.version},auth)).status,200);assert.equal((await call('/api/reviews')).data.average,4);
 const current=(await call('/api/admin/products','GET',undefined,auth)).data.products.find(p=>p.id===product.id);assert.equal((await call('/api/admin/products/'+product.id,'DELETE',{version:current.version},auth)).status,200);assert(!(await call('/api/products')).data.some(p=>p.id===product.id));
 assert.equal((await call('/api/admin/products','POST',{}, {...auth,Origin:'https://other.example'})).status,403);assert.equal((await call('/api/admin/logout','POST',{},auth)).status,200);assert.equal((await call('/api/admin/orders','GET',undefined,auth)).status,401);
});
test('optional R2 binding stores immutable images and retrieves them through the same API',async t=>{
 const {mf,call,auth}=await fixture(t,true),imageBytes=await readFile(new URL('../public/images/products/019.webp',import.meta.url));
 const db=await mf.getD1Database('DB'),legacyKey='a'.repeat(32);await db.prepare('INSERT INTO records(collection,key,data) VALUES (?,?,?)').bind('product-images',legacyKey,JSON.stringify({type:'image/webp',base64:imageBytes.toString('base64')})).run();const legacy=await mf.dispatchFetch('https://velora.example/api/product-images/'+legacyKey);assert.deepEqual(Buffer.from(await legacy.arrayBuffer()),imageBytes);
 const first=await call('/api/admin/product-images','POST',{base64:imageBytes.toString('base64')},auth);assert.equal(first.status,201);assert.equal((await call('/api/admin/product-images','POST',{base64:imageBytes.toString('base64')},auth)).status,201);const result=await mf.dispatchFetch('https://velora.example'+first.data.image);assert.deepEqual(Buffer.from(await result.arrayBuffer()),imageBytes);
});
