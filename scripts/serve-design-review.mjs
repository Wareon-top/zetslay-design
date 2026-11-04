// Local design review only. Cabinet markup is real; accounts and network operations are absent.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.ZETSLAY_REVIEW_PORT||8083);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.woff':'font/woff','.ico':'image/x-icon'};
export const reviewServer=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://local');if(req.method!=='GET'&&req.method!=='HEAD')return res.writeHead(405).end();
  const cabinet=url.pathname==='/review/cabinet';let file=resolve(root,'.'+(cabinet?'/app/index.html':decodeURIComponent(url.pathname)));
  if(file!==resolve(root)&&!file.startsWith(resolve(root)+sep))return res.writeHead(403).end();if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  const type=mime[extname(file)];if(!type)return res.writeHead(403).end();let data=await readFile(file);
  if(extname(file)==='.html'){
   let html=data.toString('utf8').replace(/(<meta name="zetslay-api-base-url" content=")[^"]*/,'$1');
   if(cabinet)html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('class="app-shell" hidden','class="app-shell"').replace(/(href|src)="(?!https?:|\/|#)([^"?]+)(\?[^" ]*)?"/g,(_all,key,path,query='')=>key+'="/app/'+path+query+'"').replace('</body>','<script src="/scripts/design-review-client.js" defer></script></body>');
   if(cabinet)html=html.replace('<script src="/scripts/design-review-client.js"','<script src="/assets/workspace-navigation.js" defer></script><script src="/scripts/design-review-client.js"');
   data=Buffer.from(html);
  }
  res.writeHead(200,{'content-type':type,'cache-control':'no-store','content-security-policy':"default-src 'self' data:; connect-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; frame-src 'none'"});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404).end('Not found');}
});
if(process.argv[1]===fileURLToPath(import.meta.url))reviewServer.listen(port,'127.0.0.1',()=>console.log('Design review: http://localhost:'+port+' /review/cabinet (no API)'));
