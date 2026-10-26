import {storePages,renderStorePage} from './lib/pages.mjs';
import {cp, mkdir, rm,readFile,writeFile} from 'node:fs/promises';
await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});
await cp('public', 'dist', {recursive: true});
await mkdir('dist/admin', {recursive: true});
await cp('public/admin.html', 'dist/admin/index.html');
const template=await readFile('public/index.html','utf8');
for(const [key,page] of Object.entries(storePages)){const directory='dist'+page.path;await mkdir(directory,{recursive:true});await writeFile(directory+'index.html',renderStorePage(template,key));}
console.log('Static website built in dist/');
