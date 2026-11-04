import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('./assets/ui-foundation.css',import.meta.url),'utf8');
const tokens=Object.fromEntries([...css.matchAll(/(--zs-[a-z-]+):\s*(#[a-f0-9]{6})\s*;/g)].map(m=>[m[1],m[2]]));
function luminance(hex){return hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
test('shared text, secondary labels and semantic colours meet AA on work surfaces',()=>{for(const foreground of ['--zs-text','--zs-muted','--zs-subtle','--zs-accent','--zs-positive','--zs-negative'])for(const background of ['--zs-canvas','--zs-surface','--zs-raised'])assert.ok(contrast(tokens[foreground],tokens[background])>=4.5,foreground+' on '+background);assert.ok(contrast('#24180f',tokens['--zs-accent'])>=4.5);});
test('presentation controller performs no account access or network operations',()=>{const source=readFileSync(new URL('./assets/workspace-navigation.js',import.meta.url),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|apiRequest|authState|localStorage|sessionStorage|\.submit\(/);});
