import {createHash} from 'node:crypto';
import {storePages,renderStorePage} from './lib/pages.mjs';
import {cp, mkdir, rm,readFile,writeFile} from 'node:fs/promises';
await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});
await cp('public', 'dist', {recursive: true});
await mkdir('dist/admin', {recursive: true});
let adminHtml=await readFile('public/admin.html','utf8');
for(const asset of ['admin.js','admin.css','style.css','velora.css']){const hash=createHash('sha256').update(await readFile('public/'+asset)).digest('hex').slice(0,12);adminHtml=adminHtml.replaceAll('/'+asset+'"','/'+asset+'?v='+hash+'"');}
await writeFile('dist/admin/index.html',adminHtml);
await writeFile('dist/admin.html',adminHtml);
const template=await readFile('public/index.html','utf8');
for(const [key,page] of Object.entries(storePages)){const directory='dist'+page.path;await mkdir(directory,{recursive:true});await writeFile(directory+'index.html',renderStorePage(template,key));}
console.log('Static website built in dist/');
