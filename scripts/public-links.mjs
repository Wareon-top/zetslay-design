import {readFile, readdir, stat} from 'node:fs/promises';
import {resolve, join} from 'node:path';

export async function checkPublicLinks(root) {
  const base=resolve(root),files=['index.html','app/index.html',
    ...(await readdir(join(base,'app'))).filter(n=>n.endsWith('.js')).map(n=>'app/'+n),
    ...(await readdir(join(base,'legal'))).filter(n=>n.endsWith('.html')).map(n=>'legal/'+n)];
  const missing=[];
  for(const file of files){
    const text=await readFile(join(base,file),'utf8');
    for(const [,link]of text.matchAll(/\b(?:href|src|poster)=["']([^"'<>]+)["']/g)){
      if(link.startsWith('#')||link.includes('${')||link.includes('{{')||link.includes(' + '))continue;
      let url;try{url=new URL(link,new URL(file,'https://zetslay.pro/'));}catch{continue;}
      if(url.origin!=='https://zetslay.pro')continue;
      let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{missing.push({file,target:link});continue;}
      const target=resolve(base,'.'+pathname);
      if(target!==base&&!target.startsWith(base+'/')){missing.push({file,target:pathname});continue;}
      try{const item=await stat(target);if(item.isDirectory())await stat(join(target,'index.html'));}
      catch{missing.push({file,target:pathname});}
    }
  }
  return missing;
}
