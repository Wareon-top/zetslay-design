import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8'),data=JSON.parse(read('../subscription-plans.json')),runtime=read('./billing-pricing.js');
const plugins=data.pluginGroups.flatMap(g=>g.plugins.map(p=>({...p,rarity:g.rarity}))),names=['start','growth','pro','maximum'];
const c=vm.createContext({document:{querySelector:()=>null},Intl,Date,authState:{user:{id:'user'},token:'session',workspace:{plan:{id:'start',active:true,expiresAt:'2100-01-01T00:00:00Z'},pluginLicenses:[]}}});
vm.runInContext(runtime,c);vm.runInContext(read('./plugin-rarity.js'),c);vm.runInContext(read('./subscription-access.js').split('async function subscriptionLoad')[0],c);
test('current subscription catalogue includes all fifteen runtime plugins at the correct rarity',()=>{
 assert.equal(plugins.length,15);assert.equal(new Set(plugins.map(p=>p.id)).size,15);assert.deepEqual(data.pluginGroups.map(g=>g.plugins.length),[3,4,3,5]);
 assert.equal(plugins.find(p=>p.id==='zetslay.ai-reviews').rarity,'ultra');assert.equal(plugins.find(p=>p.id==='zetslay.steam-rent').rarity,'legendary');assert.equal(plugins.find(p=>p.id==='zetslay.priority-orders').rarity,'common');
 const mapped=vm.runInContext('Object.keys(PLUGIN_RARITY_BY_ID).sort()',c);assert.deepEqual([...mapped],plugins.map(p=>p.id).sort());
 for(const p of plugins){c.plugin=p;assert.equal(vm.runInContext('pluginRarity(plugin).key',c),p.rarity);}
});
test('advertised inclusions exactly match cabinet access for every paid plan and plugin',()=>{
 const counts=[];for(const plan of data.plans){c.authState.workspace.plan.id=plan.id;let count=0;for(const plugin of plugins){c.plugin=plugin;const allowed=vm.runInContext('subscriptionPluginAllowed(plugin.id)',c);assert.equal(allowed,plan.includes.includes(plugin.rarity),plan.id+':'+plugin.id);if(allowed)count++;}counts.push(count);}
 assert.deepEqual(counts,[3,7,10,15]);
 c.authState.workspace.plan.id='trial_3d';assert.equal(data.trial.days,3);for(const plugin of plugins){c.plugin=plugin;assert.equal(vm.runInContext('subscriptionPluginAllowed(plugin.id)',c),data.trial.includes.includes(plugin.rarity));}
 c.authState.workspace.pluginLicenses=['zetslay.steam-rent'];c.plugin=plugins.find(p=>p.id==='zetslay.steam-rent');assert.equal(vm.runInContext('subscriptionPluginAllowed(plugin.id)',c),false);
 c.authState.workspace.plan.id='start';assert.equal(vm.runInContext('subscriptionPluginAllowed(plugin.id)',c),true);c.authState.workspace.plan.active=false;for(const plugin of plugins){c.plugin=plugin;assert.equal(vm.runInContext('subscriptionPluginAllowed(plugin.id)',c),false);}c.authState.workspace.plan.active=true;c.authState.workspace.pluginLicenses=[];
});
test('landing and subscription comparison display the same complete entitlement matrix',()=>{
 for(const [path,id] of [['../index.html','tariffs'],['./index.html','billing-tariffs'],['./billing-section.html','billing-tariffs']]){
  const html=read(path),section=html.match(new RegExp('<section\\b[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)</section>'))?.[1];assert.ok(section);assert.equal((section.match(/data-pricing-platform/g)||[]).length,1);assert.equal((section.match(/data-pricing-plugin=/g)||[]).length,15);assert.ok(section.includes('3 дня на знакомство'));
  for(const plugin of plugins){const row=section.match(new RegExp('<tr data-pricing-plugin="'+plugin.id.replaceAll('.','\\.')+'">([\\s\\S]*?)</tr>'))?.[1];assert.ok(row,plugin.id);const cells=[...row.matchAll(/data-plan-id="([^"]+)" data-included="(true|false)"/g)];assert.deepEqual(cells.map(m=>m[1]),names);assert.deepEqual(cells.map(m=>m[2]==='true'),data.plans.map(p=>p.includes.includes(plugin.rarity)));}
 }
 const faq=read('../index.html').match(/<details\b[^>]*id="faq-plugins"[\s\S]*?<\/details>/)?.[0];for(const p of plugins)assert.ok(faq?.includes(p.name),p.name);
});
test('quotes retain current amounts, exact access days and the wallet payment policy',()=>{
 const pricing=c.ZetSlayPricing;assert.deepEqual(data.plans.map(p=>p.monthlyRub),[149,299,499,799]);
 for(const plan of data.plans)for(const [period,days] of [['month',30],['quarter',90],['year',360]]){const q=pricing.quote(plan.id,period);assert.equal(q.days,days);assert.equal(q.totalKopecks,plan.monthlyRub*(100-data.periods[period].discount)*data.periods[period].months);assert.ok(q.totalKopecks<=1000000);}
 assert.match(data.availability,/внутренний баланс через Platega/);assert.ok(data.conditions.some(x=>x.includes('API нейросетей')));assert.ok(data.conditions.some(x=>x.includes('лицензии сохраняются')));assert.ok(!data.plans.some(p=>p.monthlyRub===0));assert.match(read('./billing-pricing.js'),/Пополните внутренний баланс через Platega/);assert.ok(!read('./billing-pricing.js').includes('оформить платную подписку пока нельзя'));
});
