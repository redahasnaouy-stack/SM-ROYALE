import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openStore,createAdmin} from '../lib/store.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let hidden=false;const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try{
 const email=await rl.question('Administrator email: ');process.stdout.write('Password (14+ characters, hidden): ');hidden=true;const password=await rl.question('');hidden=false;process.stdout.write('\n');process.stdout.write('Confirm password: ');hidden=true;const confirmation=await rl.question('');hidden=false;process.stdout.write('\n');if(password!==confirmation)throw new Error('Passwords do not match.');
 const products=JSON.parse(await readFile(path.join(root,'public/products.json'),'utf8'));const db=await openStore(process.env.DATABASE_PATH||path.join(root,'data/store.sqlite'),products);await createAdmin(db,email,password);db.close();console.log('Administrator saved. Sign in at /admin.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
