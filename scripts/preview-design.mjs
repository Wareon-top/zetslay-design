/* Local review only. Product files keep their real API URL and authentication.
 * The HTTP preview substitutes a local signed-out response; no API is proxied. */
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.argv[2]||8140);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.ico':'image/x-icon'};
createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname.startsWith('/__preview_api/')){
      res.writeHead(401,{'Content-Type':'application/json'});
      res.end(JSON.stringify({error:{code:'INVALID_SESSION',message:'В локальном просмотре вход не выполнен'}}));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const parts=pathname.split('/');
    if(parts.some(p=>p.startsWith('.')||['deploy','research','artifacts','docs','scripts'].includes(p))){res.writeHead(404);res.end();return;}
    let file=resolve(root,'.'+pathname),inside=relative(root,file);
    if(isAbsolute(inside)||inside==='..'||inside.startsWith('..\\')||inside.startsWith('../'))throw Error('path');
    if((await stat(file)).isDirectory())file=join(file,'index.html');
    let data=await readFile(file);
    if(extname(file)==='.html')data=Buffer.from(data.toString('utf8').replace(/(<meta\s+name="zetslay-api-base-url"\s+content=")[^"]+("\s*\/?>)/,'$1http://127.0.0.1:'+port+'/__preview_api$2'));
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'"});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Не найдено');}
}).listen(port,'127.0.0.1',()=>console.log('Design review: http://127.0.0.1:'+port+'/'));
