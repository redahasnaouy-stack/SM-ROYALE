import {Buffer} from 'node:buffer';
import {Readable} from 'node:stream';
import {createApp} from '../server.mjs';
import {cloudflareRepository} from './repository.mjs';
import products from '../public/products.json' with {type:'json'};
const initialized=new WeakMap();
async function prepareDatabase(db){if(!db)throw new Error('Missing DB binding');let ready=initialized.get(db);if(!ready){ready=db.prepare('CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL,key TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(collection,key))').run().catch(error=>{initialized.delete(db);throw error;});initialized.set(db,ready);}await ready;}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  try{
   const maxBytes=['/api/admin/product-images','/api/admin/migration/import'].includes(url.pathname)?2100000:65536;
   if(Number(request.headers.get('content-length')||0)>maxBytes)return Response.json({error:'حجم البيانات أكبر من المسموح.'},{status:413});
   let size=0;const chunks=[];
   if(request.body){const reader=request.body.getReader();while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();return Response.json({error:'حجم البيانات أكبر من المسموح.'},{status:413});}chunks.push(value);}}
   await prepareDatabase(env.DB);
   const {server}=await createApp({repository:cloudflareRepository(env.DB,env.MEDIA),secureCookies:true,products});
   const req=Readable.from(chunks.map(chunk=>Buffer.from(chunk)));req.url=url.pathname+url.search;req.method=request.method;req.headers=Object.fromEntries(request.headers);req.headers.host=url.host;req.socket={remoteAddress:request.headers.get('CF-Connecting-IP')||'unknown'};
   return await new Promise(resolve=>{
    const headers=new Headers();let status=200;
    const res={setHeader(name,value){headers.set(name,value);},writeHead(code,values={}){status=code;for(const [name,value]of Object.entries(values))headers.set(name,value);},end(value){resolve(new Response(request.method==='HEAD'?null:value??null,{status,headers}));}};
    server.emit('request',req,res);
   });
  }catch(error){console.error('VELORA API:',error.message);return Response.json({error:'الخدمة غير متاحة مؤقتًا. يُرجى المحاولة لاحقًا.'},{status:503,headers:{'Cache-Control':'no-store'}});}
 }
};
