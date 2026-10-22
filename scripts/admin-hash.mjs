import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import {randomBytes,scryptSync} from 'node:crypto';
let hidden=true;const output=new Writable({write(chunk,encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try{
  process.stdout.write('Choose an administrator password (14+ characters, hidden): ');const password=await rl.question('');process.stdout.write('\nConfirm password: ');const confirmation=await rl.question('');process.stdout.write('\n');
  if(password!==confirmation||password.length<14||password.length>200)throw new Error('Passwords must match and contain 14–200 characters.');
  const salt=randomBytes(24).toString('hex');console.log('Set this verifier as SM_ADMIN_PASSWORD_HASH in Netlify environment variables (Functions scope):');console.log('scrypt$'+salt+'$'+scryptSync(password,salt,64).toString('hex'));
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
