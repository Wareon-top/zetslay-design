import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {webcrypto as crypto} from 'node:crypto';import test from 'node:test';import vm from 'node:vm';
const scripts=['messages.js','app.js','messages-actions.js'].map(name=>readFileSync(new URL('./'+name,import.meta.url),'utf8').replace(/\ninit\(\);\s*$/,'')).join('\n');
const at='2026-10-03T12:00:00Z';
function workspace({ polling = false } = {}) {
  const listeners = new Map(), nodes = new Map();
  const node = name => {
    if (!nodes.has(name)) nodes.set(name, { textContent: '', innerHTML: '', value: '', hidden: false, disabled: false, dataset: {}, attributes: {}, scrollTop: 0, scrollHeight: 600, clientHeight: 200, focused: false, renders: 0, classList: { toggle() {} },
      setAttribute(key, value) { this.attributes[key] = value; }, focus() { this.focused = true; }, querySelector: () => null, querySelectorAll: () => [] });
    return nodes.get(name);
  };
  const filters = ['all', 'buyer', 'seller'].map(actor => { const n = node(`filter-${actor}`); n.dataset.messagesFilter = actor; return n; });
  const counts = filters.map(button => { const n = node(`count-${button.dataset.messagesFilter}`); n.dataset.messagesFilterCount = button.dataset.messagesFilter; return n; });
  const matches = ['prev', 'next'].map(direction => { const n = node(`match-${direction}`); n.dataset.messagesMatch = direction; return n; });
  const root = { hidden: false, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, querySelector: selector => selector === '[data-messages-dialog]' ? dialog : node(selector), querySelectorAll: selector => ({ '[data-messages-filter]': filters, '[data-messages-filter-count]': counts, '[data-messages-match]': matches }[selector] || []) };
  const dialog = { open: false, opens: 0, querySelector: node, showModal() { this.open = true; this.opens++; }, close() { this.open = false; } };
  const body = node('[data-messages-body]');
  let html = '';
  Object.defineProperty(body, 'innerHTML', { get: () => html, set: value => { html = value; body.renders++; } });
  const document = {
    visibilityState: 'visible',
    querySelector(selector) { if (selector === '[data-messages-workspace]') return root; if (selector === '[data-messages-dialog]') return dialog; if (selector === 'meta[name="zetslay-api-base-url"]') return { content: 'https://api.zetslay.pro' }; return null; },
    querySelectorAll: () => [], getElementById: () => null,
    addEventListener(type, listener) { listeners.set(type, [...(listeners.get(type) || []), listener]); }
  };
  const timers = new Map(); let timerId = 0, clock = Date.parse(at);
  const window = polling ? { setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } } : {};
  class ClockDate extends Date { static now() { return clock; } }
  const context = vm.createContext({ document, AbortSignal, crypto, AbortController, setTimeout, clearTimeout, URL, URLSearchParams, Date: ClockDate, location: { hostname: 'zetslay.pro', hash: '#messages', search: '' }, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} }, window });
  vm.runInContext(scripts, context);
  const run = code => vm.runInContext(code, context);
  const model = (messages, filters = {}, observedAt = at) => { context.input = { observedAt, messages }; context.inputFilters = filters; return JSON.parse(JSON.stringify(run('buildMessagesWorkspace(input, inputFilters)'))); };
  const render = (messages = [], { observedAt = at, connected = true } = {}) => {
    context.input = { observedAt, messages, orders: [], lots: [] }; context.connected = connected;
    run("state.storeContent=input; authState.user={}; state.storeFleet={stores:[{id:'store',status:connected?'connected_read_only':'attention'}],selectedStoreId:'store'}; renderMessagesWorkspace();");
  };
  const event = (type, selector, { value = '', dataset = {}, disabled = false, key = '' } = {}) => {
    const target = { value, dataset, disabled, hasAttribute: s => `[${s}]` === selector, matches: s => s === selector,
      closest: s => s === 'button' ? target : s === '[data-messages-workspace]' ? root : s === selector ? target : null };
    for (const listener of listeners.get(type) || []) listener({ target, key, preventDefault(){} });
  };
  const tick = async () => { const [id, timer] = timers.entries().next().value; timers.delete(id); clock += timer.delay; await timer.callback(); };
  return { context, run, model, render, event, root, node, dialog, matches, body, timers, tick };
}
function ready(){const app=workspace();app.render([{id:'10',threadId:'123',buyer:'Buyer',sender:'buyer',text:'Hello'},{id:'11',threadId:'456',buyer:'Other',sender:'buyer',text:'Hi'}]);app.run("authState.user={id:'one'};authState.token='token';messagesActions.scope=messagesActionScope();messagesActions.capabilities={sendEnabled:true};messagesActions.metaAt=Date.now();messagesPageState.selectedId='123';renderMessagesWorkspace();");return app;}
test('composer uses scoped per-chat drafts, checks UTF-16 limit and never saves secret-shaped text',()=>{const a=ready();a.event('input','[data-messages-text]',{value:'Ответ первому'});a.run("selectMessagesThread('456');");assert.equal(a.node('[data-messages-text]').value,'');a.event('input','[data-messages-text]',{value:'Ответ второму'});a.run("selectMessagesThread('123');");assert.equal(a.node('[data-messages-text]').value,'Ответ первому');a.event('input','[data-messages-text]',{value:'a'.repeat(1001)});assert.equal(a.node('[data-messages-send]').disabled,true);a.event('input','[data-messages-text]',{value:'http://login:password@host:8000'});assert.equal(a.node('[data-messages-send]').disabled,true);assert.match(a.node('[data-messages-compose-error]').textContent,/Golden Key/);});
test('sending captures recipient, blocks double click, and a later thread switch keeps the other draft',async()=>{const a=ready(),calls=[];let resolve;const pending=new Promise(r=>resolve=r);a.context.mockApi=async(path,options)=>{calls.push({path,options});if(path.endsWith('/send'))return pending;return {sendEnabled:true,operations:[]};};a.run('apiRequest=mockApi;');a.event('input','[data-messages-text]',{value:'Ответ первому'});const sending=a.run('sendMessagesText()');await a.run('sendMessagesText()');assert.equal(calls.filter(c=>c.path.endsWith('/send')).length,1);a.run("selectMessagesThread('456');");a.event('input','[data-messages-text]',{value:'Новый черновик'});resolve({operation:{id:calls[0].options.body.operationId,threadId:'123',storeId:'store',text:'Ответ первому',status:'sent',messageId:'12'},message:{id:'12',threadId:'123',buyer:'Buyer',sender:'seller',text:'Ответ первому'},observedAt:at});await sending;assert.equal(calls[0].options.body.threadId,'123');assert.equal(a.node('[data-messages-text]').value,'Новый черновик');assert.equal(a.run("messagesDraft('123')"),'');assert.equal(a.run("messagesContent().messages.some(m=>m.id==='12'&&m.threadId==='123')"),true);});
test('lost response remains unresolved and explicit result request reuses the identical operation key',async()=>{const a=ready(),calls=[];let fail=true;a.context.mockApi=async(path,options)=>{if(path.endsWith('/send')){calls.push(options.body);if(fail)throw Object.assign(Error('Timeout'),{name:'TimeoutError'});return {operation:{id:options.body.operationId,threadId:'123',text:options.body.text,status:'sent',messageId:'12'}};}return {sendEnabled:true,operations:[]};};a.run('apiRequest=mockApi;');a.event('input','[data-messages-text]',{value:'Ответ'});await a.run('sendMessagesText()');assert.equal(a.run("[...messagesActions.operations.values()][0].status"),'waiting_response');assert.equal(a.node('[data-messages-text]').value,'Ответ');await a.run('sendMessagesText()');assert.equal(calls.length,1);fail=false;await a.run('checkMessagesOperation([...messagesActions.operations.keys()][0])');assert.equal(calls.length,2);assert.equal(calls[0].operationId,calls[1].operationId);assert.equal(a.run("messagesDraft('123')"),'');});
test('late send result cannot enter another account or store',async()=>{const a=ready();let resolve;const pending=new Promise(r=>resolve=r);a.context.mockApi=async path=>path.endsWith('/send')?pending:{sendEnabled:true,operations:[]};a.run('apiRequest=mockApi;');a.event('input','[data-messages-text]',{value:'PRIVATE_BUYER_REPLY'});const sending=a.run('sendMessagesText()');a.run("sessionGeneration++;authState.token='other';authState.user={id:'two'};renderMessagesWorkspace();");resolve({operation:{id:'old',threadId:'123',status:'sent'},message:{id:'12',threadId:'123',sender:'seller',text:'PRIVATE_BUYER_REPLY'},observedAt:at});await sending;assert.equal(a.run("messagesContent().messages.some(m=>m.id==='12')"),false);assert.equal(a.node('[data-messages-text]').value,'');});
test('numeric source IDs are authoritative even when dates disagree; system updates do not hide a buyer awaiting answer',()=>{const a=ready(),m=a.model([{id:'9007199254740993',threadId:'123',buyer:'Buyer',sender:'buyer',text:'Old',createdAt:'2026-10-03T11:59:00Z'},{id:'9007199254740994',threadId:'123',buyer:'Buyer',sender:'system',text:'Event',createdAt:'2026-10-03T10:00:00Z'}]);assert.deepEqual(m.threads[0].messages.map(x=>x.text),['Old','Event']);assert.equal(m.threads[0].lastSender,'buyer');assert.equal(m.counts.buyer,1);});
test('opening another thread starts at its latest message and unchanged refresh preserves reading position',()=>{const a=ready();a.body.scrollTop=5;a.run("selectMessagesThread('456');");assert.equal(a.body.scrollTop,a.body.scrollHeight);a.body.scrollTop=50;a.run('renderMessagesWorkspace();');assert.equal(a.body.scrollTop,50);});
