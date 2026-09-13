import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(p=>p&&existsSync(p)&&/\.(?:tsx?|m?js|css|json|md|ya?ml)$/.test(p)).map(path=>({path,content:readFileSync(path,'utf8')}));
console.log('REHEARSAL_SOURCE_BUNDLE_BASE64='+gzipSync(JSON.stringify(files)).toString('base64'));
