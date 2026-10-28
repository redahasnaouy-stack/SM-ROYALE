import {randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
export const digest = value => createHash('sha256').update(value).digest('hex');
export async function openStore(filename, products) {
  const {sqliteRepository}=await import('./repository.mjs');const repo=await sqliteRepository(filename);repo.products=products;return repo;
}
export async function createAdmin(db,email,password){
  email=String(email).trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('A valid administrator email is required.');
  if(typeof password!=='string'||password.length<14||password.length>200)throw new Error('Use a password between 14 and 200 characters.');
  const salt=randomBytes(24).toString('hex'),password_hash=scryptSync(password,salt,64).toString('hex');
  const existing=await db.get('admins',digest(email));const admin={id:existing?.id||randomUUID(),email,salt,password_hash};
  await db.put('admins',digest(email),admin);
  for(const session of await db.list('sessions'))if(session.admin_id===admin.id)await db.delete('sessions',session.token_hash);
}
let ownerCache=null;
export function environmentOwner(){
  const email=process.env.SM_ADMIN_EMAIL?.trim().toLowerCase();if(!email)return null;
  const signature=digest(email+'|'+(process.env.SM_ADMIN_PASSWORD_HASH||'')+'|'+(process.env.SM_ADMIN_PASSWORD||''));
  if(ownerCache?.signature===signature)return ownerCache.admin;
  let admin=null;const encoded=process.env.SM_ADMIN_PASSWORD_HASH;
  if(encoded){const [scheme,salt,password_hash]=encoded.split('$');if(scheme==='scrypt'&&/^[a-f0-9]{48}$/.test(salt||'')&&/^[a-f0-9]{128}$/.test(password_hash||''))admin={id:'owner',email,salt,password_hash};}
  else if(process.env.SM_ADMIN_PASSWORD?.length>=14&&process.env.SM_ADMIN_PASSWORD.length<=200){const salt=digest(email+':SM-ROYALE-ADMIN').slice(0,48);admin={id:'owner',email,salt,password_hash:scryptSync(process.env.SM_ADMIN_PASSWORD,salt,64).toString('hex')};}
  ownerCache={signature,admin};return admin;
}
export async function verifyAdmin(db,email,password){
  const normal=email.toLowerCase();let admin=await db.get('admins',digest(normal));
  const owner=environmentOwner();if(!admin&&owner?.email===normal)admin=owner;
  const actual=scryptSync(password,admin?.salt||'invalid-account-fixed-salt',64),expected=admin?Buffer.from(admin.password_hash,'hex'):Buffer.alloc(64);
  return timingSafeEqual(actual,expected)&&admin?admin:null;
}
function effectiveProduct(base,override){
  if(!base)return override?.custom?override:undefined;if(!override)return {...base,available:true};
  const changed=base.pricingRevision&&override.pricingRevision!==base.pricingRevision;
  const result=changed?{...override,...base,...override.contentOverrides,available:override.available!==false}:{...base,...override};
  if(override._version!==undefined)Object.defineProperty(result,'_version',{value:override._version});
  return result;
}
export async function publicProducts(db,{includeDeleted=false}={}){const overrides=new Map((await db.list('products')).map(p=>[p.id,p])),ids=new Set(db.products.map(p=>p.id));return [...db.products.map(p=>effectiveProduct(p,overrides.get(p.id))),...Array.from(overrides.values()).filter(p=>p.custom&&!ids.has(p.id))].filter(p=>p&&(includeDeleted||!p.deleted));}
export async function getProduct(db,id){if(typeof id!=='string'||! /^(?:SMR-\d{3}|SUP-S\d{2}-G\d{2}|VEL-[a-f0-9]{12})$/.test(id))return undefined;const base=db.products.find(p=>p.id===id);return effectiveProduct(base,await db.get('products',id));}
export function totals(items, shipping){
  const subtotal=items.some(i=>i.unitPriceCents===null)?null:items.reduce((sum,i)=>sum+i.unitPriceCents*i.quantity,0);
  return {subtotal,total:subtotal===null||shipping===null?null:subtotal+shipping};
}
export function receipt(row){return {reference:row.reference,createdAt:row.created_at,status:row.status,subtotalCents:row.subtotal_cents,shippingCents:row.shipping_cents,totalCents:row.total_cents,hasEstimatedPrices:JSON.parse(row.items).some(i=>i.estimated===true)};}
export function orderView(row){return {...receipt(row),id:row.id,version:row._version,paymentStatus:row.payment_status,customer:JSON.parse(row.customer),items:JSON.parse(row.items),notes:row.notes};}
export async function saveOrder(db,payload,key){
  const {customer,items}=payload;
  if(!customer||typeof customer!=='object'||Array.isArray(customer))throw Object.assign(new Error('بيانات العميل غير مكتملة.'),{status:400});
  const clean={};
  for(const [field,min,max] of [['name',3,100],['phone',9,25],['city',2,80],['address',8,350]]){
    if(typeof customer[field]!=='string'||customer[field].trim().length<min||customer[field].trim().length>max)throw Object.assign(new Error('يُرجى التحقق من الاسم ورقم الهاتف والمدينة والعنوان.'),{status:400});
    clean[field]=customer[field].trim();
  }
  if(!/^\+?[\d\s()-]{9,25}$/.test(clean.phone)||clean.phone.replace(/\D/g,'').length<9)throw Object.assign(new Error('رقم الهاتف غير صالح.'),{status:400});
  clean.email=typeof customer.email==='string'?customer.email.trim():'';
  if(clean.email.length>150||(clean.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)))throw Object.assign(new Error('البريد الإلكتروني غير صالح.'),{status:400});
  clean.note=typeof customer.note==='string'?customer.note.trim():'';
  if(clean.note.length>1000)throw Object.assign(new Error('الملاحظات طويلة جدًا.'),{status:400});
  if(payload.consent!==true)throw Object.assign(new Error('يُرجى الموافقة على استخدام بياناتك لمعالجة الطلب.'),{status:400});
  if(!Array.isArray(items)||items.length<1||items.length>50)throw Object.assign(new Error('يجب أن تحتوي السلة على منتج واحد إلى خمسين منتجًا.'),{status:400});
  const hash=digest(JSON.stringify({customer:clean,items}));
  const orderId=digest(key);const previous=await db.get('orders',orderId);
  if(previous){if(previous.request_hash!==hash)throw Object.assign(new Error('تغيرت بيانات الطلب. يُرجى إعادة المحاولة.'),{status:409});return {row:previous,replayed:true};}
  const lines=await Promise.all(items.map(async item=>{
    if(!item||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>10000)throw Object.assign(new Error('الكمية غير صالحة.'),{status:400});
    const record=await getProduct(db,item.productId);
    if(!record)throw Object.assign(new Error('المنتج غير موجود.'),{status:400});
    const product=record;if(product.deleted||product.available===false)throw Object.assign(new Error('أحد المنتجات غير متاح للطلب.'),{status:409});
    let variant=null;
    if(product.variants.length){if(!Number.isInteger(item.variantIndex)||!product.variants[item.variantIndex])throw Object.assign(new Error('يُرجى اختيار المقاس الصحيح.'),{status:400});variant=product.variants[item.variantIndex];if(variant.key&&item.variantKey!==variant.key)throw Object.assign(new Error('تغيّرت خيارات المنتج. يُرجى تحديث السلة واختيار المقاس مجددًا.'),{status:409});}
    else if(item.variantIndex!==null)throw Object.assign(new Error('المقاس المحدد غير صالح.'),{status:400});
    const specification=typeof item.specification==='string'?item.specification.trim():'';
    if(specification.length>240)throw Object.assign(new Error('وصف المقاس أو اللون طويل جدًا.'),{status:400});
    return {productId:product.id,name:product.name,image:product.image,size:variant?.size||'',variantKey:variant?.key||null,supplierReference:variant?.supplierReference||null,estimated:product.priceEstimate===true,quantity:item.quantity,specification,unitPriceCents:variant?Math.round(variant.price*100):null};
  }));
  const {subtotal,total}=totals(lines,0), now=new Date().toISOString();
  const row={id:orderId,payment_status:'unpaid',notes:'',reference:'SM-'+now.slice(0,10).replaceAll('-','')+'-'+randomBytes(4).toString('hex').toUpperCase(),created_at:now,status:subtotal===null?'pricing_pending':'new',customer:JSON.stringify(clean),items:JSON.stringify(lines),subtotal_cents:subtotal,shipping_cents:0,total_cents:total,idempotency_key:key,request_hash:hash};
  if(!await db.put('orders',orderId,row,{ifNew:true})){
    const winner=await db.get('orders',orderId);
    if(winner?.request_hash!==hash)throw Object.assign(new Error('تغيرت بيانات الطلب. يُرجى إعادة المحاولة.'),{status:409});
    return {row:winner,replayed:true};
  }
  return {row,replayed:false};
}
