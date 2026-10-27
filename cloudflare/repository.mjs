import {Buffer} from 'node:buffer';
const decode=row=>{if(!row)return null;const value=JSON.parse(row.data);Object.defineProperty(value,'_version',{value:String(row.version)});return value;};
export function cloudflareRepository(database,media){
 if(!database)throw new Error('Missing DB binding');
 const db=typeof database.withSession==='function'?database.withSession('first-primary'):database;
 return {
  async get(collection,key){
   if(collection==='product-images'&&media){const object=await media.get(collection+'/'+key);if(object){const value={type:object.httpMetadata?.contentType||'image/webp',base64:Buffer.from(await object.arrayBuffer()).toString('base64')};Object.defineProperty(value,'_version',{value:object.etag});return value;}}
   return decode(await db.prepare('SELECT data, version FROM records WHERE collection=? AND key=?').bind(collection,key).first());
  },
  async list(collection){
   if(collection==='product-images'&&media){const found=[];let cursor;do{const page=await media.list({prefix:collection+'/',cursor});for(const object of page.objects){const value=await this.get(collection,object.key.slice(collection.length+1));if(value)found.push(value);}cursor=page.truncated?page.cursor:undefined;}while(cursor);return found;}
   const {results}=await db.prepare('SELECT data, version FROM records WHERE collection=? ORDER BY key').bind(collection).all();return results.map(decode);
  },
  async put(collection,key,data,{ifNew=false,version}={}){
   if(collection==='product-images'&&media){const object=await media.put(collection+'/'+key,Buffer.from(data.base64,'base64'),{httpMetadata:{contentType:data.type},...(ifNew?{onlyIf:{etagDoesNotMatch:'*'}}:version!==undefined?{onlyIf:{etagMatches:version}}:{})});return object!==null;}
   const encoded=JSON.stringify(data);let statement;
   if(ifNew)statement=db.prepare('INSERT OR IGNORE INTO records(collection,key,data) VALUES (?,?,?)').bind(collection,key,encoded);
   else if(version!==undefined)statement=db.prepare('UPDATE records SET data=?, version=version+1 WHERE collection=? AND key=? AND version=?').bind(encoded,collection,key,Number(version));
   else statement=db.prepare('INSERT INTO records(collection,key,data) VALUES (?,?,?) ON CONFLICT(collection,key) DO UPDATE SET data=excluded.data, version=records.version+1').bind(collection,key,encoded);
   const result=await statement.run();return result.meta.changes===1;
  },
  async delete(collection,key){if(collection==='product-images'&&media)await media.delete(collection+'/'+key);await db.prepare('DELETE FROM records WHERE collection=? AND key=?').bind(collection,key).run();},close(){}
 };
}
