import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpeg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end('Page introuvable');}}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('SM Royale running on port '+(process.env.PORT||3000)));
