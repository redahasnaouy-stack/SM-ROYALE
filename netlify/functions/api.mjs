import {getStore} from '@netlify/blobs';
import {Readable} from 'node:stream';
import {createApp} from '../../server.mjs';
import {blobRepository} from '../../lib/repository.mjs';
import products from '../../public/products.json' with {type:'json'};
export const config={path:'/api/*'};
export function createNetlifyHandler(repositoryFactory=()=>blobRepository(getStore({name:'sm-royale-store-v1',consistency:'strong'}))){
let app;
return async function handler(request,context){
  try{
    const body=request.method==='GET'||request.method==='HEAD'?null:Buffer.from(await request.arrayBuffer());
    if(body?.length>65536)return Response.json({error:'حجم البيانات أكبر من المسموح.'},{status:413});
    app ||= createApp({repository:repositoryFactory(),secureCookies:true,products});
    const {server}=await app;
    const url=new URL(request.url),req=Readable.from(body?[body]:[]);req.url=url.pathname+url.search;req.method=request.method;req.headers=Object.fromEntries(request.headers);req.headers.host=url.host;req.socket={remoteAddress:context.ip||'unknown'};
    return await new Promise(resolve=>{
      const headers=new Headers();let status=200;
      const res={setHeader(name,value){headers.set(name,value);},writeHead(code,values={}){status=code;for(const [key,value]of Object.entries(values))headers.set(key,value);},end(value){resolve(new Response(value??null,{status,headers}));}};
      server.emit('request',req,res);
    });
  }catch{
    app=null;return Response.json({error:'الخدمة غير متاحة مؤقتًا. يُرجى المحاولة لاحقًا.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
};
}
export default createNetlifyHandler();
