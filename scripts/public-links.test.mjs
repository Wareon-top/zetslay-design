import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkPublicLinks} from './public-links.mjs';

test('checks dynamic UI static links as well as HTML, with root paths, query versions and directories',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zetslay-links-'));
 try{
  await mkdir(join(root,'app'));await mkdir(join(root,'legal'));
  await writeFile(join(root,'index.html'),'<a href="/app/?auth=register">Go</a><a href="#features">local</a>');
  await writeFile(join(root,'app/index.html'),'<script src="shop.js?v=version"></script>');
  await writeFile(join(root,'app/shop.js'),'const markup=`<a href="../legal/terms.html">terms</a><img src="${cover}"><a href="https://outside.test/">external</a>`;');
  await writeFile(join(root,'legal/index.html'),'<a href="/">home</a>');
  assert.deepEqual(await checkPublicLinks(root),[{file:'app/shop.js',target:'/legal/terms.html'}]);
  await writeFile(join(root,'legal/terms.html'),'<a href="/legal/">all</a>');
  assert.deepEqual(await checkPublicLinks(root),[]);
 }finally{await rm(root,{recursive:true,force:true});}
});
