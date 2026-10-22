import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
export async function sqliteRepository(filename){
  const {DatabaseSync}=await import('node:sqlite');
  if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  const db=new DatabaseSync(filename);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records(collection TEXT,key TEXT,data TEXT,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(collection,key));');
  if(filename!==':memory:')chmodSync(filename,0o600);
  const decode=r=>{if(!r)return null;const value=JSON.parse(r.data);Object.defineProperty(value,'_version',{value:String(r.version)});return value;};
  return {
    async get(collection,key){return decode(db.prepare('SELECT data,version FROM records WHERE collection=? AND key=?').get(collection,key));},
    async list(collection){return db.prepare('SELECT data,version FROM records WHERE collection=?').all(collection).map(decode);},
    async put(collection,key,data,{ifNew=false,version}={}){
      if(ifNew)return db.prepare('INSERT OR IGNORE INTO records(collection,key,data) VALUES (?,?,?)').run(collection,key,JSON.stringify(data)).changes===1;
      if(version!==undefined)return db.prepare('UPDATE records SET data=?,version=version+1 WHERE collection=? AND key=? AND version=?').run(JSON.stringify(data),collection,key,Number(version)).changes===1;
      db.prepare('INSERT INTO records(collection,key,data) VALUES (?,?,?) ON CONFLICT(collection,key) DO UPDATE SET data=excluded.data,version=records.version+1').run(collection,key,JSON.stringify(data));return true;
    },
    async delete(collection,key){db.prepare('DELETE FROM records WHERE collection=? AND key=?').run(collection,key);},close(){db.close();}
  };
}
export function blobRepository(store){
  const decorate=result=>{if(!result)return null;if(!result.etag)throw new Error('The storage service did not provide a version for conditional updates.');Object.defineProperty(result.data,'_version',{value:result.etag});return result.data;};
  return {
    async get(collection,key){return decorate(await store.getWithMetadata(collection+'/'+key,{type:'json',consistency:'strong'}));},
    async list(collection){const found=[];for await(const page of store.list({prefix:collection+'/',paginate:true})){for(let i=0;i<page.blobs.length;i+=20){const batch=await Promise.all(page.blobs.slice(i,i+20).map(blob=>store.getWithMetadata(blob.key,{type:'json',consistency:'strong'})));found.push(...batch.filter(Boolean).map(decorate));}}return found;},
    async put(collection,key,data,{ifNew=false,version}={}){const result=await store.setJSON(collection+'/'+key,data,ifNew?{onlyIfNew:true}:version!==undefined?{onlyIfMatch:version}:{});return result.modified;},
    async delete(collection,key){await store.delete(collection+'/'+key);},close(){}
  };
}
