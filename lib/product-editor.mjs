import {createHash} from 'node:crypto';
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))invalid('يُرجى مراجعة النصوص المدخلة وطولها.');return value.trim();};
const bilingual=(value,max,required)=>{if(!value||typeof value!=='object')invalid('يُرجى إدخال النص بالعربية والإنجليزية.');return {ar:text(value.ar,max,required),en:text(value.en,max,required)};};
export function editProduct(record,data){
 if(typeof data.available!=='boolean'||!Array.isArray(data.variants)||data.variants.length>30)invalid('بيانات المنتج غير صالحة.');
 const product={...record,available:data.available,contentOverrides:{...record.contentOverrides}};
 if(data.name!==undefined)product.contentOverrides.name=bilingual(data.name,160,true);
 if(data.description!==undefined)product.contentOverrides.description=bilingual(data.description,2000,false);
 if(data.category!==undefined){if(!['bottles','jars','perfume','pouches','accessories','wellness'].includes(data.category))invalid('الفئة غير صالحة.');product.contentOverrides.category=data.category;}
 if(data.photoPlaceholder!==undefined){if(typeof data.photoPlaceholder!=='boolean')invalid('حالة الصورة غير صالحة.');product.contentOverrides.photoPlaceholder=data.photoPlaceholder;}
 const validImage=image=>typeof image==='string'&&!image.includes('..')&&(/^(?:\.\/|\/)?images\/[\w/.-]+\.(?:png|jpe?g|webp)$/.test(image)||/^\/api\/product-images\/[a-f0-9]{32}$/.test(image));
 if(data.deleted!==undefined){if(typeof data.deleted!=='boolean')invalid('حالة المنتج غير صالحة.');product.deleted=data.deleted;}
 if(data.image!==undefined){if(!validImage(data.image))invalid('اختر صورة من الموقع أو ارفع صورة جديدة.');product.contentOverrides.image=data.image;}
 if(data.images!==undefined){if(!Array.isArray(data.images)||data.images.length>20||data.images.some(image=>!validImage(image)))invalid('يمكنك إضافة حتى 20 صورة صالحة لكل منتج.');product.contentOverrides.images=[...new Set(data.images)];product.contentOverrides.image=data.images[0]||'/images/velora-logo.png';product.contentOverrides.photoPlaceholder=!data.images.length;}
 Object.assign(product,product.contentOverrides);
 const sizes=new Set();product.variants=data.variants.map(v=>{
  if(!v||typeof v!=='object'||Array.isArray(v))invalid('بيانات المقاس غير صالحة.');
  const size=text(v.size,60,true);if(sizes.has(size))invalid('لا يمكن تكرار المقاس نفسه.');sizes.add(size);
  if(typeof v.price!=='number'||!Number.isFinite(v.price)||v.price<0||v.price>1000000||Math.abs(v.price*100-Math.round(v.price*100))>0.00001)invalid('المقاس أو السعر غير صالح.');
  const existing=record.variants.find(item=>item.size===size),variant={...existing,size,price:v.price,key:existing?.key||createHash('sha256').update(record.id+':'+size).digest('hex').slice(0,24)};
  if(v.cartonQuantity!==undefined){if(v.cartonQuantity!==null&&!(Number.isInteger(v.cartonQuantity)&&v.cartonQuantity>0&&v.cartonQuantity<=10000000)&&!(typeof v.cartonQuantity==='string'&&v.cartonQuantity.length<=40&&/^\d[\d /,.-]*$/.test(v.cartonQuantity)))invalid('عدد القطع في الكرتون غير صالح.');variant.cartonQuantity=v.cartonQuantity;}
  if(v.supplierReference!==undefined)variant.supplierReference=text(v.supplierReference,60);
  return variant;
 });return product;
}
export function decodeProductImage(data){
 if(typeof data.base64!=='string'||data.base64.length>2000000||data.base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64))invalid('الصورة غير صالحة أو أكبر من 1.5 ميغابايت.');
 const bytes=Buffer.from(data.base64,'base64');if(bytes.length<12||bytes.length>1500000)invalid('حجم الصورة غير صالح.');
 const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':null;
 if(!type)invalid('تُقبل صور JPEG وPNG وWebP فقط.');return {bytes,type};
}
