import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('every paid or zero-price licence shows the subscription prerequisite before the lifetime action',()=>{
 const c=vm.createContext({Intl,Number});vm.runInContext(read('./plugin-purchase-options.js'),c);
 for(const priceRub of [0,149,990]){c.plugin={id:'zetslay.kosell-rent',priceRub};const html=vm.runInContext('pluginPurchaseOptionsMarkup(plugin)',c);assert.match(html,/Для работы нужна активная подписка ZetSlay/);assert.match(html,/Бессрочная лицензия сохраняется/);if(priceRub)assert.ok(html.indexOf('Для работы нужна')<html.indexOf('Купить навсегда'));assert.ok(!html.includes('или доступ по подписке'));}
});
test('catalogue, knowledge base, connection wizard and financial terms explain the same prerequisite',()=>{
 const plans=JSON.parse(read('../subscription-plans.json'));assert.ok(plans.conditions.some(x=>x.includes('Бессрочная покупка плагина не заменяет подписку')));assert.ok(plans.conditions.some(x=>x.includes('лицензии сохраняются')));
 for(const [name,pattern] of [['./knowledge-base.js',/Бессрочная покупка сохраняет лицензию/],['./app.js',/data-connection-subscription-note/],['./billing.js',/включая купленные навсегда/],['./learning.js',/в том числе купленных навсегда/],['./index.html',/Бессрочная покупка плагина не заменяет подписку/]])assert.match(read(name),pattern);
 // The owner removed the landing block «Что входит в стоимость» (14.11.2026); the redesigned landing states the
 // same prerequisite in its tariff FAQ. The meaning stays mandatory: active plan, lifetime plugins included, licences kept.
 const landing=read('../index.html').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
 assert.match(landing,/нужен активный тариф или пробный период/);assert.match(landing,/Это условие действует и для плагинов, купленных навсегда/);assert.match(landing,/Лицензии сохраняются после окончания подписки/);
 assert.match(read('./subscription-access.js'),/подключение|Подключение/);assert.match(read('./subscription-access.js'),/'zetslay.priority-orders':0/);
});
test('new legal version preserves the previous immutable definition and links to its archive',()=>{
 const current=JSON.parse(read('../legal/publication.json')),previous=JSON.parse(read('../legal/archive/2026-10-12-v1/publication.json')),old=JSON.parse(read('../legal/archive/2026-10-12-v1/documents.json'));
 const archived=JSON.parse(read('../legal/archive/2026-10-16-v1/publication.json'));
 assert.equal(current.version,'2026-11-21-v1');
 assert.equal(current.hostingCountry,'Россия');
 assert.equal(current.localizationReviewed,false);
 assert.equal(archived.hash,'d3231659f380f1cf368e64564a8706df9d06fb181340bac139aa2506f6aa04d6');
 assert.ok(read('../legal/index.html').includes('/legal/archive/2026-10-16-v1/index.html'));
 assert.equal(previous.hash,'03a2b39ae1c55b43d8a979c5ebc48965858338583d4bf016f5f39648c16d5819');assert.equal(old.version,previous.version);assert.notEqual(previous.hash,current.hash);assert.ok(read('../legal/index.html').includes('/legal/archive/2026-10-12-v1/index.html'));
 const offer=JSON.parse(read('../legal/documents.json')).documents.find(d=>d.id==='offer');const text=JSON.stringify(offer);assert.match(text,/бессрочной лицензии/);assert.match(text,/не изменяет задним числом/);assert.match(text,/не аннулирует/);
});
test('owned-plugin metadata cannot bypass inactive cabinet access; Priority Orders follows the common tariff',()=>{
 const authState={user:{id:'u'},token:'t',workspace:{plan:{id:'maximum',active:false,expiresAt:'2100-01-01T00:00:00Z'},ownedPlugins:['zetslay.mass-price-editor','zetslay.kosell-rent']}},c=vm.createContext({authState,Date});vm.runInContext(read('./subscription-access.js').split('async function subscriptionLoad')[0],c);
 for(const id of ['zetslay.mass-price-editor','zetslay.kosell-rent']){c.id=id;assert.equal(vm.runInContext('subscriptionPluginAllowed(id)',c),false);}authState.workspace.plan={id:'start',active:true,expiresAt:'2100-01-01T00:00:00Z'};assert.equal(vm.runInContext("subscriptionPluginAllowed('zetslay.priority-orders')",c),true);
});
