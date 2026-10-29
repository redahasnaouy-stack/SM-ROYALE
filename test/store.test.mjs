import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {BlobsServer} from '@netlify/blobs/server';
import {createApp} from '../server.mjs';
import {createAdmin,openStore,saveOrder} from '../lib/store.mjs';
import {blobRepository} from '../lib/repository.mjs';
const customer={name:'عميل الاختبار',phone:'0600000000',city:'الدار البيضاء',address:'عنوان تجريبي لا يخص أي عميل حقيقي',email:'',note:''};
const baseProducts=JSON.parse(await readFile(new URL('./fixtures/previous-prices.json',import.meta.url),'utf8'));
const payload=(items=[{productId:'SMR-151',variantIndex:0,variantKey:baseProducts.find(p=>p.id==='SMR-151').variants[0].key,quantity:2,specification:''}])=>({customer:{...customer},items,consent:true});
async function fixture(t,repo=null){
  const app=await createApp({databasePath:':memory:',repository:repo,secureCookies:false,products:structuredClone(baseProducts)});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+app.server.address().port,password=randomBytes(24).toString('hex');
  await createAdmin(app.db,'owner@example.test',password);
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  const call=async(route,options={})=>{const r=await fetch(base+route,options);return {status:r.status,headers:r.headers,data:await r.json()};};
  const post=(route,data,headers={})=>call(route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(data)});
  const login=await post('/api/admin/login',{email:'owner@example.test',password});assert.equal(login.status,200);
  const auth={Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':login.data.csrf,'Content-Type':'application/json',Origin:base};
  return {...app,base,call,post,auth};
}
test('orders persist authoritative prices, reject tampering and duplicate retries',async t=>{
  const f=await fixture(t),key=randomUUID(),data=payload();data.items[0].unitPriceCents=1;
  const a=await f.post('/api/orders',data,{'Idempotency-Key':key});assert.equal(a.status,201);assert.equal(a.data.order.subtotalCents,860);assert.equal(a.data.order.totalCents,860);assert.equal(a.data.order.shippingCents,0);assert.equal(a.data.order.status,'new');assert(!('customer' in a.data.order));
  const b=await f.post('/api/orders',data,{'Idempotency-Key':key});assert.equal(b.status,200);assert.equal(b.data.order.reference,a.data.order.reference);
  data.customer.name='عميل مختلف';assert.equal((await f.post('/api/orders',data,{'Idempotency-Key':key})).status,409);
  const list=await f.call('/api/admin/orders',{headers:f.auth});assert.equal(list.data.orders.length,1);assert.equal(list.data.orders[0].items[0].unitPriceCents,430);
});
test('quotes are pending pricing; item prices are required before confirmation with free delivery',async t=>{
  const f=await fixture(t);f.db.products.find(p=>p.id==='SMR-063').variants=[];assert.equal((await f.post('/api/orders',payload([{productId:'SMR-063',variantIndex:null,quantity:3,specification:'اللون البنفسجي'}]),{'Idempotency-Key':randomUUID()})).data.order.status,'pricing_pending');
  let order=(await f.call('/api/admin/orders',{headers:f.auth})).data.orders[0];
  const patch=data=>f.call('/api/admin/orders/'+order.id,{method:'PATCH',headers:f.auth,body:JSON.stringify({version:order.version,...data})});
  assert.equal((await patch({status:'confirmed'})).status,400);assert.equal((await patch({status:'confirmed',unitPrices:[500],shippingCents:3000})).status,200);
  const stale=await patch({status:'cancelled'});assert.equal(stale.status,409);
  order=(await f.call('/api/admin/orders',{headers:f.auth})).data.orders[0];assert.equal(order.totalCents,1500);assert.equal(order.status,'confirmed');
});
test('admin data requires authentication; writes enforce CSRF and origin; logout revokes session',async t=>{
  const f=await fixture(t);assert.equal((await f.call('/api/admin/orders')).status,401);assert.equal((await f.call('/api/admin/products')).status,401);
  assert.equal((await f.post('/api/admin/logout',{}, {Cookie:f.auth.Cookie})).status,403);
  assert.equal((await f.post('/api/admin/logout',{}, {...f.auth,Origin:'https://other.example'})).status,403);
  assert.equal((await f.post('/api/admin/logout',{},f.auth)).status,200);assert.equal((await f.call('/api/admin/session',{headers:f.auth})).status,401);
});
test('validation rejects bad customer data, invalid variants, quantities and missing consent',async t=>{
  const f=await fixture(t);
  for(const modify of [p=>p.consent=false,p=>p.customer.phone='abc',p=>p.customer.name='',p=>p.items[0].quantity=0,p=>p.items[0].quantity=1.5,p=>p.items[0].productId='unknown',p=>p.items[0].variantIndex=999]){const data=payload();modify(data);assert.equal((await f.post('/api/orders',data,{'Idempotency-Key':randomUUID()})).status,400);}
  assert.equal((await f.call('/api/orders',{method:'POST',headers:{'Content-Type':'text/plain','Idempotency-Key':randomUUID()},body:'x'})).status,415);
  assert.equal((await f.post('/api/orders',payload())).status,400);
  assert.equal((await f.post('/api/orders',null,{'Idempotency-Key':randomUUID()})).status,400);
});
test('admin price and availability changes affect new orders but preserve old snapshots',async t=>{
  const f=await fixture(t);await f.post('/api/orders',payload(),{'Idempotency-Key':randomUUID()});
  const product=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(p=>p.id==='SMR-151');
  const update=await f.call('/api/admin/products/SMR-151',{method:'PATCH',headers:f.auth,body:JSON.stringify({version:product.version,available:true,variants:[{size:'30 ml',price:12}]})});assert.equal(update.status,200);
  const next=await f.post('/api/orders',payload(),{'Idempotency-Key':randomUUID()});assert.equal(next.data.order.subtotalCents,2400);
  const orders=(await f.call('/api/admin/orders',{headers:f.auth})).data.orders;assert(orders.some(o=>o.subtotalCents===860));
  const product2=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(p=>p.id==='SMR-151');
  await f.call('/api/admin/products/SMR-151',{method:'PATCH',headers:f.auth,body:JSON.stringify({version:product2.version,available:false,variants:product2.variants})});
  assert.equal((await f.post('/api/orders',payload(),{'Idempotency-Key':randomUUID()})).status,409);
});
test('SQLite survives closing and reopening; parallel duplicate submissions create one order',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'sm-store-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const products=JSON.parse(await readFile(new URL('./fixtures/previous-prices.json',import.meta.url),'utf8')),file=path.join(directory,'store.sqlite');let repo=await openStore(file,products);const key=randomUUID();
  const results=await Promise.all(Array.from({length:8},()=>saveOrder(repo,payload(),key)));assert.equal(new Set(results.map(r=>r.row.reference)).size,1);assert.equal((await repo.list('orders')).length,1);repo.close();repo=await openStore(file,products);assert.equal((await repo.list('orders')).length,1);repo.close();
});
test('Netlify Blobs adapter persists orders, sessions and conditional admin updates against official emulator',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'sm-blobs-test-')),token=randomBytes(24).toString('hex');
  const emulator=new BlobsServer({directory,token,logger(){}});const address=await emulator.start();t.after(async()=>{await emulator.stop();await rm(directory,{recursive:true,force:true});});
  // The official local emulator omits ETag on GET/HEAD. Restore the ETag it
  // supplies on LIST, so the SDK exercises its real conditional PUT behaviour.
  const emulatorFetch=async(url,options)=>{
    const response=await fetch(url,options),parsed=new URL(url),parts=parsed.pathname.split('/').filter(Boolean),offset=parts[0]?.startsWith('region:')?3:2,key=parts.slice(offset).join('/');
    if((options?.method||'GET').toUpperCase()==='GET'&&response.ok&&key&&!response.headers.has('etag')){
      const listURL=new URL(url);listURL.pathname='/'+parts.slice(0,offset).join('/');listURL.search='';
      const listing=await(await fetch(listURL,{headers:options?.headers})).json();const entry=listing.blobs?.find(b=>b.key===key);if(entry){const headers=new Headers(response.headers);headers.set('etag',entry.etag);return new Response(response.body,{status:response.status,headers});}
    }
    return response;
  };
  const options={name:'test-store',siteID:'test-site',token,edgeURL:address.address,uncachedEdgeURL:address.address,consistency:'strong',fetch:emulatorFetch};
  const store=getStore(options),repo=blobRepository(store);const f=await fixture(t,repo);
  const response=await f.post('/api/orders',payload(),{'Idempotency-Key':randomUUID()});assert.equal(response.status,201);
  const rows=(await f.call('/api/admin/orders',{headers:f.auth})).data.orders;assert.equal(rows.length,1);
  const updated=await f.call('/api/admin/orders/'+rows[0].id,{method:'PATCH',headers:f.auth,body:JSON.stringify({version:rows[0].version,status:'confirmed',shippingCents:2000})});assert.equal(updated.status,200);assert.equal(updated.data.order.totalCents,860);
  const stale=await f.call('/api/admin/orders/'+rows[0].id,{method:'PATCH',headers:f.auth,body:JSON.stringify({version:rows[0].version,status:'cancelled'})});assert.equal(stale.status,409);
  const fresh=blobRepository(getStore(options));assert.equal((await fresh.list('orders'))[0].status,'confirmed');
});
test('Netlify request adapter accepts checkout and protects administration across independent invocations',async t=>{
  const {createNetlifyHandler}=await import('../netlify/functions/api.mjs');
  const source=JSON.parse(await readFile(new URL('./fixtures/previous-prices.json',import.meta.url),'utf8'));const repo=await openStore(':memory:',source);t.after(()=>repo.close());
  const password=randomBytes(24).toString('hex');await createAdmin(repo,'owner@example.test',password);
  const handler=createNetlifyHandler(()=>repo),context={ip:'192.0.2.10'};
  let response=await handler(new Request('https://store.example/api/orders',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),Origin:'https://store.example'},body:JSON.stringify(payload())}),context);assert.equal(response.status,201);
  response=await handler(new Request('https://store.example/api/admin/orders'),context);assert.equal(response.status,401);
  response=await handler(new Request('https://store.example/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password})}),context);assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly.*SameSite=Strict.*Secure/);
  const csrf=(await response.json()).csrf;
  const cookie=response.headers.get('set-cookie').split(';')[0];const anotherInvocation=createNetlifyHandler(()=>repo);
  const imageBytes=await readFile(new URL('../public/images/products/007.webp',import.meta.url));assert(imageBytes.length>65536);
  const upload=await anotherInvocation(new Request('https://store.example/api/admin/product-images',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf,Origin:'https://store.example'},body:JSON.stringify({base64:imageBytes.toString('base64')})}),context);assert.equal(upload.status,201);
  const uploadedPath=(await upload.json()).image;const imageResponse=await createNetlifyHandler(()=>repo)(new Request('https://store.example'+uploadedPath),context);assert.equal(imageResponse.headers.get('content-type'),'image/webp');assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),imageBytes);

  response=await anotherInvocation(new Request('https://store.example/api/admin/orders',{headers:{Cookie:cookie}}),context);assert.equal(response.status,200);assert.equal((await response.json()).orders.length,1);
});
test('Netlify owner signs in with a private environment password; password rotation invalidates previous sessions',async t=>{
  const previous={email:process.env.SM_ADMIN_EMAIL,password:process.env.SM_ADMIN_PASSWORD,hash:process.env.SM_ADMIN_PASSWORD_HASH};
  t.after(()=>{for(const [key,value]of [['SM_ADMIN_EMAIL',previous.email],['SM_ADMIN_PASSWORD',previous.password],['SM_ADMIN_PASSWORD_HASH',previous.hash]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  process.env.SM_ADMIN_EMAIL='netlify-owner@example.test';process.env.SM_ADMIN_PASSWORD=randomBytes(24).toString('hex');delete process.env.SM_ADMIN_PASSWORD_HASH;
  const app=await createApp({databasePath:':memory:',secureCookies:true});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});
  const base='http://127.0.0.1:'+app.server.address().port;
  const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.SM_ADMIN_EMAIL,password:process.env.SM_ADMIN_PASSWORD})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(base+'/api/admin/session',{headers:{Cookie:cookie}})).status,200);
  process.env.SM_ADMIN_PASSWORD=randomBytes(24).toString('hex');assert.equal((await fetch(base+'/api/admin/session',{headers:{Cookie:cookie}})).status,401);
});
test('missing or short Netlify owner credentials report configuration failure without disclosing values',async t=>{
  const previous={email:process.env.SM_ADMIN_EMAIL,password:process.env.SM_ADMIN_PASSWORD,hash:process.env.SM_ADMIN_PASSWORD_HASH};
  t.after(()=>{for(const [key,value]of [['SM_ADMIN_EMAIL',previous.email],['SM_ADMIN_PASSWORD',previous.password],['SM_ADMIN_PASSWORD_HASH',previous.hash]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  process.env.SM_ADMIN_EMAIL='owner@example.test';process.env.SM_ADMIN_PASSWORD='short-test';delete process.env.SM_ADMIN_PASSWORD_HASH;
  const app=await createApp({databasePath:':memory:',secureCookies:false,products:structuredClone(baseProducts)});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});
  const response=await fetch('http://127.0.0.1:'+app.server.address().port+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'not-the-owner-password'})});
  assert.equal(response.status,503);const text=await response.text();assert.match(text,/إعداد حساب الإدارة غير مكتمل/);assert(!text.includes(process.env.SM_ADMIN_PASSWORD));assert(!text.includes(process.env.SM_ADMIN_EMAIL));
});

test('full product edits and uploaded images persist; source price revisions preserve edited content and prior orders',async t=>{
 const f=await fixture(t);await f.post('/api/orders',payload(),{'Idempotency-Key':randomUUID()});
 const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9WQAAAAASUVORK5CYII=','base64');
 assert.equal((await f.post('/api/admin/product-images',{base64:imageBytes.toString('base64')})).status,401);
 const uploaded=await f.post('/api/admin/product-images',{base64:imageBytes.toString('base64')},f.auth);assert.equal(uploaded.status,201);
 const image=await fetch(f.base+uploaded.data.image);assert.equal(image.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),imageBytes);
 assert.equal((await f.post('/api/admin/product-images',{base64:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')},f.auth)).status,400);
 const p=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(p=>p.id==='SMR-151');
 const data={version:p.version,available:true,name:{ar:'منتج معدّل',en:'Edited product'},description:{ar:'وصف عربي جديد',en:'New English description'},category:'perfume',image:uploaded.data.image,photoPlaceholder:false,variants:[{size:'30 ml',price:8.5,cartonQuantity:'180 / 160',supplierReference:'NEW-REF'}]};
 const patch=(value,headers=f.auth)=>f.call('/api/admin/products/'+p.id,{method:'PATCH',headers,body:JSON.stringify(value)});
 assert.equal((await patch(data,{Cookie:f.auth.Cookie})).status,403);assert.equal((await patch(data)).status,200);
 const updated=(await f.call('/api/products')).data.find(item=>item.id===p.id);assert.equal(updated.name.ar,data.name.ar);assert.equal(updated.description.en,data.description.en);assert.equal(updated.category,'perfume');assert.equal(updated.image,uploaded.data.image);assert.equal(updated.variants[0].cartonQuantity,'180 / 160');assert.equal(updated.variants[0].supplierReference,'NEW-REF');assert.equal(updated.variants[0].key,p.variants[0].key);
 assert.equal((await patch(data)).status,409);
 const before=f.db.products.find(item=>item.id===p.id);before.pricingRevision='new-source-revision';before.variants[0].price=10;
 const refreshed=(await f.call('/api/products')).data.find(item=>item.id===p.id);assert.equal(refreshed.name.en,'Edited product');assert.equal(refreshed.image,uploaded.data.image);assert.equal(refreshed.variants[0].price,8.5);
 const old=(await f.call('/api/admin/orders',{headers:f.auth})).data.orders[0];assert.notEqual(old.items[0].name.ar,data.name.ar);assert.equal(old.items[0].unitPriceCents,430);
 const current=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(item=>item.id===p.id);
 for(const value of [{...data,name:{ar:'',en:'valid'}},{...data,category:'bad'},{...data,image:'https://example.com/a.png'},{...data,image:'./images/../secret.png'},{...data,variants:[{size:'30 ml',price:1},{size:'30 ml',price:2}]}])assert.equal((await patch({...value,version:current.version})).status,400);
});

test('custom products support galleries, ordering, deletion and restore without losing historical orders',async t=>{
 const f=await fixture(t),data={name:{ar:'منتج جديد للاختبار',en:'Custom test product'},description:{ar:'وصف الاختبار',en:'Test description'},category:'jars',available:true,images:['/images/products/007.webp','/images/products/139.webp'],variants:[{size:'50 ml',price:12.5}]};
 assert.equal((await f.post('/api/admin/products',data)).status,401);
 const created=await f.post('/api/admin/products',data,f.auth);assert.equal(created.status,201);const p=created.data.product;assert.match(p.id,/^VEL-[a-f0-9]{12}$/);assert.equal(p.image,data.images[0]);assert.deepEqual((await f.call('/api/products')).data.find(x=>x.id===p.id).images,data.images);
 const order=await f.post('/api/orders',payload([{productId:p.id,variantIndex:0,variantKey:p.variants[0].key,quantity:2,specification:''}]),{'Idempotency-Key':randomUUID()});assert.equal(order.status,201);assert.equal(order.data.order.subtotalCents,2500);
 const patch=(body,method='PATCH')=>f.call('/api/admin/products/'+p.id,{method,headers:f.auth,body:JSON.stringify(body)});
 assert.equal((await patch({version:p.version,available:true,variants:p.variants,images:[data.images[1]]})).status,200);let current=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(x=>x.id===p.id);assert.equal(current.image,data.images[1]);assert.equal(current.images.length,1);
 assert.equal((await patch({version:p.version},'DELETE')).status,409);assert.equal((await patch({version:current.version},'DELETE')).status,200);assert(!(await f.call('/api/products')).data.some(x=>x.id===p.id));
 const retry=await f.post('/api/orders',payload([{productId:p.id,variantIndex:0,variantKey:p.variants[0].key,quantity:1,specification:''}]),{'Idempotency-Key':randomUUID()});assert.equal(retry.status,409);
 current=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(x=>x.id===p.id);assert(current.deleted);assert.equal((await patch({version:current.version,available:true,deleted:false,variants:current.variants})).status,200);assert((await f.call('/api/products')).data.some(x=>x.id===p.id));
 const historic=(await f.call('/api/admin/orders',{headers:f.auth})).data.orders.find(x=>x.reference===order.data.order.reference);assert.equal(historic.items[0].image,data.images[0]);assert.equal(historic.items[0].unitPriceCents,1250);
 current=(await f.call('/api/admin/products',{headers:f.auth})).data.products.find(x=>x.id===p.id);assert.equal((await patch({version:current.version,available:true,variants:current.variants,images:['https://bad.example/test.png']})).status,400);
});
