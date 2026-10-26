import http from 'node:http';
import {editProduct,decodeProductImage} from './lib/product-editor.mjs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {openStore,publicProducts,verifyAdmin,digest,saveOrder,receipt,orderView,totals,getProduct,environmentOwner} from './lib/store.mjs';
const moduleRoot=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpeg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const statuses=['new','pricing_pending','confirmed','processing','shipped','delivered','cancelled'];
export async function createApp({databasePath=process.env.DATABASE_PATH||path.join(moduleRoot,'data/store.sqlite'),secureCookies=process.env.NODE_ENV==='production',repository=null,products=null}={}){
  const source=products||JSON.parse(await readFile(path.join(moduleRoot,'public/products.json'),'utf8'));
  const db=repository||await openStore(databasePath,source);db.products=source;
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  async function throttle(key,max,windowMs){
    const id=digest(key),now=Date.now();
    for(let retry=0;retry<6;retry++){
      const current=await db.get('limits',id),fresh=!current||current.until<now;
      const next={count:fresh?1:current.count+1,until:fresh?now+windowMs:current.until};
      if(next.count>max)throw Object.assign(new Error('طلبات كثيرة. يُرجى المحاولة لاحقًا.'),{status:429});
      if(await db.put('limits',id,next,current?{version:current._version}:{ifNew:true}))return;
    }
    throw Object.assign(new Error('يُرجى إعادة المحاولة بعد قليل.'),{status:429});
  }
  async function body(req,maxBytes=65536){if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('يلزم إرسال بيانات بصيغة JSON.'),{status:415});let content='',length=0;for await(const chunk of req){length+=chunk.length;if(length>maxBytes)throw Object.assign(new Error('حجم البيانات أكبر من المسموح.'),{status:413});content+=chunk;}try{const value=JSON.parse(content);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value;}catch{throw Object.assign(new Error('البيانات غير صالحة.'),{status:400});}}
  async function session(req){const match=(req.headers.cookie||'').match(/(?:^|;\s*)sm_session=([a-f0-9]{64})(?:;|$)/);if(!match)return null;const value=await db.get('sessions',digest(match[1]));if(!value||value.expires_at<=Date.now())return null;if(value.admin_id==='owner'&&value.credential!==digest(environmentOwner()?.password_hash||''))return null;return value;}
  async function authenticated(req,mutation=false){const user=await session(req);if(!user)throw Object.assign(new Error('يُرجى تسجيل الدخول.'),{status:401});if(mutation&&req.headers['x-csrf-token']!==user.csrf)throw Object.assign(new Error('انتهت صلاحية الطلب. حدّث الصفحة.'),{status:403});return user;}
  async function audit(user,action,target){await db.put('audit',randomBytes(16).toString('hex'),{created_at:new Date().toISOString(),admin_id:user.admin_id,action,target});}
  const cookie=(token,age)=>`sm_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${age}${secureCookies?'; Secure':''}`;
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      const url=new URL(req.url,'http://localhost'),route=decodeURIComponent(url.pathname),method=req.method;
      if(['POST','PATCH','DELETE','PUT'].includes(method)&&req.headers.origin){const expected=process.env.PUBLIC_URL?new URL(process.env.PUBLIC_URL).host:req.headers.host;if(new URL(req.headers.origin).host!==expected)throw Object.assign(new Error('مصدر الطلب غير مسموح.'),{status:403});}
      if(route==='/api/health'&&method==='GET')return json(res,200,{ok:true});
      if(route==='/api/products'&&method==='GET')return json(res,200,await publicProducts(db));
      if(route==='/api/orders'&&method==='POST'){
        await throttle('order:'+req.socket.remoteAddress,20,15*60*1000);
        const key=req.headers['idempotency-key'];if(typeof key!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(key))throw Object.assign(new Error('معرّف الطلب غير صالح.'),{status:400});
        const result=await saveOrder(db,await body(req),key);return json(res,result.replayed?200:201,{order:receipt(result.row)});
      }
      if(route==='/api/reviews'&&method==='GET'){
        const reviews=(await db.list('reviews')).filter(r=>r.status==='approved').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
        return json(res,200,{reviews:reviews.slice(0,100).map(({id,name,rating,message,createdAt})=>({id,name,rating,message,createdAt})),count:reviews.length,average:reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:null});
      }
      if(route==='/api/reviews'&&method==='POST'){
        await throttle('review:'+req.socket.remoteAddress,5,60*60*1000);const data=await body(req);
        if(typeof data.name!=='string'||data.name.trim().length<2||data.name.trim().length>60||typeof data.message!=='string'||data.message.trim().length<10||data.message.trim().length>800||!Number.isInteger(data.rating)||data.rating<1||data.rating>5||data.consent!==true)throw Object.assign(new Error('يُرجى إدخال اسم وتقييم من 1 إلى 5 ورأي بين 10 و800 حرف، والموافقة على النشر.'),{status:400});
        const id=randomBytes(16).toString('hex');await db.put('reviews',id,{id,name:data.name.trim(),rating:data.rating,message:data.message.trim(),createdAt:new Date().toISOString(),status:'pending'},{ifNew:true});return json(res,201,{ok:true});
      }
      if(route==='/api/admin/reviews'&&method==='GET'){await authenticated(req);return json(res,200,{reviews:(await db.list('reviews')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>({...r,version:r._version}))});}
      if(/^\/api\/admin\/reviews\/[a-f0-9]{32}$/.test(route)&&method==='PATCH'){
        const user=await authenticated(req,true),id=route.split('/').at(-1),data=await body(req),row=await db.get('reviews',id);
        if(!row)throw Object.assign(new Error('التقييم غير موجود.'),{status:404});
        if(!['approved','rejected','pending'].includes(data.status))throw Object.assign(new Error('حالة التقييم غير صالحة.'),{status:400});
        if(data.version!==row._version||!await db.put('reviews',id,{...row,status:data.status},{version:row._version}))throw Object.assign(new Error('عُدّل التقييم. حدّث الصفحة.'),{status:409});
        await audit(user,'moderate_review',id);return json(res,200,{ok:true});
      }
      if(/^\/api\/product-images\/[a-f0-9]{32}$/.test(route)&&['GET','HEAD'].includes(method)){
        const image=await db.get('product-images',route.split('/').at(-1));if(!image)return json(res,404,{error:'الصورة غير موجودة.'});res.writeHead(200,{'Content-Type':image.type,'Cache-Control':'public, max-age=31536000, immutable'});return res.end(method==='HEAD'?undefined:Buffer.from(image.base64,'base64'));
      }
      if(route==='/api/admin/product-images'&&method==='POST'){
        const user=await authenticated(req,true);await throttle('image:'+user.admin_id,50,60*60*1000);const image=decodeProductImage(await body(req,2100000)),id=digest(image.bytes).slice(0,32);
        await db.put('product-images',id,{type:image.type,base64:image.bytes.toString('base64')},{ifNew:true});await audit(user,'upload_product_image',id);return json(res,201,{image:'/api/product-images/'+id});
      }
      if(route==='/api/admin/login'&&method==='POST'){
        await throttle('login:'+req.socket.remoteAddress,10,15*60*1000);const data=await body(req);
        if(typeof data.email!=='string'||data.email.length>150||typeof data.password!=='string'||data.password.length>200)throw Object.assign(new Error('بيانات الدخول غير صحيحة.'),{status:400});
        if(!environmentOwner()&&!(await db.list('admins')).length)throw Object.assign(new Error('إعداد حساب الإدارة غير مكتمل. يُرجى مراجعة إعدادات الموقع وإعادة النشر.'),{status:503});
        const admin=await verifyAdmin(db,data.email.trim(),data.password);if(!admin)throw Object.assign(new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.'),{status:401});
        const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');await db.put('sessions',digest(token),{token_hash:digest(token),admin_id:admin.id,email:admin.email,credential:digest(admin.password_hash),csrf,expires_at:Date.now()+8*60*60*1000});res.setHeader('Set-Cookie',cookie(token,8*60*60));return json(res,200,{email:admin.email,csrf});
      }
      if(route==='/api/admin/session'&&method==='GET'){const user=await authenticated(req);return json(res,200,{email:user.email,csrf:user.csrf});}
      if(route==='/api/admin/logout'&&method==='POST'){const user=await authenticated(req,true);await db.delete('sessions',user.token_hash);res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true});}
      if(route==='/api/admin/orders'&&method==='GET'){await authenticated(req);return json(res,200,{orders:(await db.list('orders')).sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(orderView)});}
      if(route==='/api/admin/products'&&method==='GET'){await authenticated(req);return json(res,200,{products:(await publicProducts(db)).map(p=>({...p,version:p._version||null}))});}
      if(route.startsWith('/api/admin/orders/')&&method==='PATCH'){
        const user=await authenticated(req,true),id=route.split('/').at(-1),data=await body(req),row=await db.get('orders',id);
        if(!row)throw Object.assign(new Error('الطلب غير موجود.'),{status:404});
        const status=data.status??row.status,payment=data.paymentStatus??row.payment_status,shipping=data.shippingCents===undefined?row.shipping_cents:data.shippingCents;
        if(!statuses.includes(status)||!['unpaid','paid','refunded'].includes(payment))throw Object.assign(new Error('حالة الطلب غير صالحة.'),{status:400});
        if(shipping!==null&&(!Number.isInteger(shipping)||shipping<0||shipping>10000000))throw Object.assign(new Error('رسوم التوصيل غير صالحة.'),{status:400});
        let items=JSON.parse(row.items);
        if(data.unitPrices!==undefined){if(!Array.isArray(data.unitPrices)||data.unitPrices.length!==items.length)throw Object.assign(new Error('أسعار المنتجات غير صالحة.'),{status:400});items=items.map((item,index)=>{const price=data.unitPrices[index];if(price!==null&&(!Number.isInteger(price)||price<0||price>100000000))throw Object.assign(new Error('سعر المنتج غير صالح.'),{status:400});return {...item,unitPriceCents:price};});}
        const result=totals(items,shipping);
        if(['confirmed','processing','shipped','delivered'].includes(status)&&result.total===null)throw Object.assign(new Error('حدّد أسعار المنتجات ورسوم التوصيل قبل تأكيد الطلب.'),{status:400});
        if(payment==='paid'&&result.total===null)throw Object.assign(new Error('حدّد المبلغ النهائي قبل تسجيل السداد.'),{status:400});
        const notes=data.notes===undefined?row.notes:data.notes;if(typeof notes!=='string'||notes.length>2000)throw Object.assign(new Error('الملاحظات غير صالحة.'),{status:400});
        if(data.version!==row._version)throw Object.assign(new Error('عُدّل الطلب من جلسة أخرى. حدّث الصفحة.'),{status:409});
        const updated={...row,status,payment_status:payment,items:JSON.stringify(items),subtotal_cents:result.subtotal,shipping_cents:shipping,total_cents:result.total,notes};
        if(!await db.put('orders',id,updated,{version:row._version}))throw Object.assign(new Error('عُدّل الطلب. حدّث الصفحة.'),{status:409});
        await audit(user,'update_order',id);return json(res,200,{order:orderView(await db.get('orders',id))});
      }
      if(route.startsWith('/api/admin/products/')&&method==='PATCH'){
        const user=await authenticated(req,true),id=route.split('/').at(-1),data=await body(req),record=await getProduct(db,id);if(!record)throw Object.assign(new Error('المنتج غير موجود.'),{status:404});
        const product=editProduct(record,data);
        if(product.image.startsWith('/api/product-images/')&&!await db.get('product-images',product.image.split('/').at(-1)))throw Object.assign(new Error('الصورة المرفوعة غير موجودة. أعد رفعها.'),{status:400});
        if(data.version!==(record._version||null))throw Object.assign(new Error('عُدّل المنتج. حدّث الصفحة.'),{status:409});
        if(!await db.put('products',id,product,record._version?{version:record._version}:{ifNew:true}))throw Object.assign(new Error('عُدّل المنتج. حدّث الصفحة.'),{status:409});
        await audit(user,'update_product',id);return json(res,200,{product});
      }
      if(route.startsWith('/api/'))return json(res,404,{error:'المسار غير موجود.'});
      if(!['GET','HEAD'].includes(method))return json(res,405,{error:'طريقة الطلب غير مسموح بها.'});
      if(route==='/admin'){res.writeHead(301,{Location:'/admin/'});return res.end();}
      const resource=route==='/'?'/index.html':route==='/admin'||route==='/admin/'?'/admin.html':route;
      const root=path.join(moduleRoot,'public'),file=path.resolve(root,'.'+resource);if(!file.startsWith(root+path.sep)||resource.includes('/.'))return json(res,403,{error:'غير مسموح.'});
      const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':resource.endsWith('.html')?'no-store':'public, max-age=300'});res.end(method==='HEAD'?undefined:data);
    }catch(error){const status=error.status||(error.code==='ENOENT'?404:500);json(res,status,{error:status===500?'تعذّرت معالجة الطلب. يُرجى المحاولة لاحقًا.':error.message});}
  });
  return {server,db};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {server}=await createApp();server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('SM Royale store listening on port '+(process.env.PORT||3000)));
}
