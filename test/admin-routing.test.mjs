import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
test('canonical admin directory loads directly; its resources and API resolve outside the admin directory',async t=>{
  const app=await createApp({databasePath:':memory:',secureCookies:false});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();});
  const origin='http://127.0.0.1:'+app.server.address().port;
  const redirect=await fetch(origin+'/admin',{redirect:'manual'});assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'/admin/');
  const page=await fetch(origin+'/admin/');assert.equal(page.status,200);assert.equal(page.url,origin+'/admin/');const html=await page.text();
  const resources=Array.from(html.matchAll(/(?:src|href)="([^"#]+\.(?:css|js|png))"/g),m=>m[1]);assert(resources.length>=4);
  for(const resource of resources){const url=new URL(resource,page.url);assert(!url.pathname.startsWith('/admin/'));assert.equal((await fetch(url)).status,200);}
  const script=await(await fetch(origin+'/admin.js')).text();assert.match(script,/fetch\('\/api\/admin\//);assert.equal((await fetch(origin+'/api/admin/session')).status,401);
});
