import {cp, mkdir, rm} from 'node:fs/promises';
await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});
await cp('public', 'dist', {recursive: true});
await mkdir('dist/admin', {recursive: true});
await cp('public/admin.html', 'dist/admin/index.html');
console.log('Static website built in dist/');
