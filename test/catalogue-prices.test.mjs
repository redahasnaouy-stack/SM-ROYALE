import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {createAdmin,getProduct,publicProducts,saveOrder} from '../lib/store.mjs';
import {randomUUID,randomBytes} from 'node:crypto';
const source=JSON.parse(await readFile(new URL('../catalogue/supplier-prices-2026-10-22.json',import.meta.url),'utf8'));
const products=JSON.parse(await readFile(new URL('../public/products.json',import.meta.url),'utf8'));
const rowIndex=new Map(source.groups.flatMap(g=>g.variants.map(v=>[v.key,{...v,group:g}])));
test('all published prices match the supplied source exactly; every unambiguous priced source row is represented',()=>{
 const published=new Set();
 for(const p of products.filter(p=>!p.priceEstimate))for(const variant of p.variants){const original=rowIndex.get(variant.key);assert(original,variant.key);assert(!original.group.requiresReview,variant.key);assert.notEqual(original.priceCents,null);assert.equal(Math.round(variant.price*100),original.priceCents,variant.key);assert.equal(variant.size,original.size);published.add(variant.key);}
 for(const group of source.groups)for(const row of group.variants){if(!group.requiresReview&&row.priceCents!==null)assert(published.has(row.key),row.key);else assert(!published.has(row.key),row.key);}
});
test('representative prices from every source table retain exact decimals, capacities and finishes',()=>{
 const value=(id,size)=>products.find(p=>p.id===id)?.variants.find(v=>v.size===size)?.price;
 assert.equal(value('SMR-151','30 ml'),4.30);assert.equal(value('SMR-149','50 ml'),4.50);
 assert.equal(value('SMR-031','30 ml'),2.50);assert.equal(value('SMR-001','30 ml'),3.50);
 assert.equal(value('SUP-S05-G01','200 ml'),3.40);assert.equal(value('SMR-146','20 ml'),2.50);
 assert.equal(value('SMR-140','100 ml'),3.75);assert.equal(value('SMR-141','20 ml'),2.30);assert.equal(value('SMR-142','20 ml'),2.40);
 assert.equal(value('SMR-009','10 ml'),1.80);assert.equal(value('SMR-008','15 ml'),1.50);
 assert.equal(value('SUP-S11-G02','30 ml'),80.00);assert.equal(value('SUP-S11-G04','60 ml'),90.00);
 assert.equal(value('SUP-S10-G13','30 ml'),3.00);assert.equal(value('SMR-019','43 mm'),0.36);
 assert.equal(value('SMR-161','500 g · 17×24+4 cm'),0.68);assert.equal(value('SUP-S13-G01','250 g · 14×22+4 cm'),0.50);
 assert.equal(value('SMR-152','100 ml'),6.38);
 assert(products.find(p=>p.id==='SUP-S02-G10').variants.every(v=>v.supplierReference));
 assert(!products.flatMap(p=>p.variants).some(v=>v.key==='S06-G07-V03'));
 assert(products.find(p=>p.id==='SMR-150').priceEstimate===true); // photo cannot be assigned to either supplier reference safely
});
test('a new supplier revision replaces stale stored prices while preserving availability and prior order snapshots',async t=>{
 const app=await createApp({databasePath:':memory:'});t.after(()=>app.db.close());
 const base=products.find(p=>p.id==='SMR-151');
 await app.db.put('products',base.id,{...base,variants:[{size:'30 ml',price:999}],pricingRevision:'old-import',available:false});
 let effective=await getProduct(app.db,base.id);assert.equal(effective.variants[0].price,4.30);assert.equal(effective.available,false);assert(effective._version);
 const record=await app.db.get('products',base.id);await app.db.put('products',base.id,{...record,available:true},{version:record._version});
 const order=await saveOrder(app.db,{consent:true,customer:{name:'عميل الاختبار',phone:'0600000000',city:'الدار البيضاء',address:'عنوان تجريبي لا يخص عميلًا حقيقيًا'},items:[{productId:base.id,variantIndex:0,variantKey:base.variants[0].key,quantity:2,specification:''}]},randomUUID());
 assert.equal(order.row.subtotal_cents,860);
 effective=await getProduct(app.db,base.id);await app.db.put('products',base.id,{...effective,variants:[{...effective.variants[0],price:8}],pricingRevision:base.pricingRevision},{version:effective._version});
 assert.equal((await getProduct(app.db,base.id)).variants[0].price,8);assert.equal(JSON.parse((await app.db.get('orders',order.row.id)).items)[0].unitPriceCents,430);
 assert.equal((await publicProducts(app.db)).find(p=>p.id===base.id).variants[0].price,8);
});
test('checkout rejects a stale or mismatched variant key instead of silently switching capacities',async t=>{
 const app=await createApp({databasePath:':memory:'});t.after(()=>app.db.close());
 const data={consent:true,customer:{name:'عميل الاختبار',phone:'0600000000',city:'الدار البيضاء',address:'عنوان اختبار غير حقيقي'},items:[{productId:'SMR-151',variantIndex:0,variantKey:'obsolete-capacity',quantity:1,specification:''}]};
 await assert.rejects(()=>saveOrder(app.db,data,randomUUID()),{status:409});delete data.items[0].variantKey;await assert.rejects(()=>saveOrder(app.db,data,randomUUID()),{status:409});
});

test('all products have prices and owner-adopted prices retain provenance and create regular orders',async t=>{
 const estimates=JSON.parse(await readFile(new URL('../catalogue/estimated-prices-2026-10-24.json',import.meta.url),'utf8'));
 assert.equal(products.filter(p=>p.priceEstimate).length,76);assert(products.every(p=>p.variants.length));
 for(const entry of estimates.products){const p=products.find(p=>p.id===entry.productId);assert(p.priceEstimate);assert.deepEqual(p.variants.map(v=>({size:v.size,priceCents:Math.round(v.price*100)})),entry.variants.map(({size,priceCents})=>({size,priceCents})));assert(p.variants.every(v=>v.estimated&&v.key.startsWith('EST-')));assert(!p.priceSource);}
 const app=await createApp({databasePath:':memory:'});t.after(()=>app.db.close());const p=products.find(p=>p.id==='SMR-004');
 const result=await saveOrder(app.db,{customer:{name:'عميل الاختبار',phone:'0600000000',city:'الدار البيضاء',address:'عنوان اختبار غير حقيقي',email:'',note:''},items:[{productId:p.id,variantIndex:0,variantKey:p.variants[0].key,quantity:2,specification:''}],consent:true},randomUUID());
 assert.equal(result.row.status,'new');assert.equal(JSON.parse(result.row.items)[0].estimated,true);assert.equal(result.row.subtotal_cents,Math.round(p.variants[0].price*200));
});
