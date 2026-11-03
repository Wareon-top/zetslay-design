import {readFile, readdir, stat} from 'node:fs/promises';
import {resolve, join, relative, isAbsolute} from 'node:path';

export async function checkPublicLinks(root) {
  async function pages(directory){
    let entries;try{entries=await readdir(join(root,directory),{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return [];throw error;}
    const found=[];for(const entry of entries){const file=directory+'/'+entry.name;if(entry.isDirectory())found.push(...await pages(file));else if(/\.(?:html|js)$/.test(entry.name))found.push(file);}return found;
  }
  const base=resolve(root),files=['index.html','app/index.html',
    ...(await readdir(join(base,'app'))).filter(n=>n.endsWith('.js')).map(n=>'app/'+n),
    ...(await readdir(join(base,'legal'))).filter(n=>n.endsWith('.html')).map(n=>'legal/'+n),
    ...await pages('demo'),...await pages('pricing'),...await pages('docs')];
  const missing=[];
  for(const file of files){
    const text=await readFile(join(base,file),'utf8');
    for(const [,link]of text.matchAll(/\b(?:href|src|poster)=["']([^"'<>]+)["']/g)){
      if(link.startsWith('#')||link.includes('${')||link.includes('{{')||link.includes(' + '))continue;
      let url;try{url=new URL(link,new URL(file,'https://zetslay.pro/'));}catch{continue;}
      if(url.origin!=='https://zetslay.pro')continue;
      let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{missing.push({file,target:link});continue;}
      const target=resolve(base,'.'+pathname);
      const within=relative(base,target);
      if(within==='..'||within.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(within)){missing.push({file,target:pathname});continue;}
      try{const item=await stat(target);if(item.isDirectory())await stat(join(target,'index.html'));}
      catch{missing.push({file,target:pathname});}
    }
  }
  return missing;
}
