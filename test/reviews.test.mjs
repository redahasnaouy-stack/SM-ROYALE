import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {createApp} from '../server.mjs';import {createAdmin} from '../lib/store.mjs';
test('reviews stay private until authenticated moderation; hiding updates the public count and average',async t=>{
 const app=await createApp({databasePath:':memory:',secureCookies:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});const base='http://127.0.0.1:'+app.server.address().port,password=randomBytes(24).toString('hex');await createAdmin(app.db,'review-admin@example.test',password);
 const call=async(path,method='GET',body,headers={})=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,data:await r.json()};};
 assert.deepEqual((await call('/api/reviews')).data,{reviews:[],count:0,average:null});
 assert.equal((await call('/api/reviews','POST',{name:'عميل تجريبي',rating:4,message:'تجربة اختبار وليست شهادة عميل حقيقية.',consent:true})).status,201);
 assert.equal((await call('/api/reviews')).data.count,0);assert.equal((await call('/api/admin/reviews')).status,401);
 const login=await call('/api/admin/login','POST',{email:'review-admin@example.test',password}),headers={Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':login.data.csrf};
 let review=(await call('/api/admin/reviews','GET',null,headers)).data.reviews[0];assert.equal(review.status,'pending');
 const path='/api/admin/reviews/'+review.id;
 assert.equal((await call(path,'PATCH',{status:'approved',version:review.version},{Cookie:headers.Cookie})).status,403);
 assert.equal((await call(path,'PATCH',{status:'approved',version:review.version},headers)).status,200);
 const published=(await call('/api/reviews')).data;assert.equal(published.count,1);assert.equal(published.average,4);assert.equal(published.reviews[0].message,review.message);assert(!('version' in published.reviews[0]));assert(!('status' in published.reviews[0]));
 assert.equal((await call(path,'PATCH',{status:'rejected',version:review.version},headers)).status,409);
 review=(await call('/api/admin/reviews','GET',null,headers)).data.reviews[0];assert.equal((await call(path,'PATCH',{status:'rejected',version:review.version},headers)).status,200);assert.equal((await call('/api/reviews')).data.count,0);
});
test('review submission validates consent, length, rating, origin and rate limits',async t=>{
 const app=await createApp({databasePath:':memory:',secureCookies:false});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});const base='http://127.0.0.1:'+app.server.address().port,data={name:'Test client',rating:5,message:'A test review for validation.',consent:true};
 const post=(body,origin=base)=>fetch(base+'/api/reviews',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 assert.equal((await post(data,'https://other.example')).status,403);
 for(const invalid of [{...data,rating:6},{...data,rating:1.5},{...data,consent:false},{...data,message:'short'},{...data,name:'a'}])assert.equal((await post(invalid)).status,400);
 assert.equal((await post(data)).status,429);assert.equal((await app.db.list('reviews')).length,0);
});
