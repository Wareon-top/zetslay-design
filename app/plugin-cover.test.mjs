import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('./plugin-cover.js', import.meta.url), 'utf8');
const page = readFileSync(new URL('./plugin-page.js', import.meta.url), 'utf8');
const cabinet = readFileSync(new URL('./app.js', import.meta.url), 'utf8').replace(/^init\(\);[ \t]*$/m, '');
const max = 2 * 1024 * 1024;
const file = (type = 'image/png', size = 1000) => ({ type, size, bytes: Buffer.from('original raster bytes') });
function harness({ width = 1920, height = 1080, sizes = [1000], decodeError = false, readError = false, contextMissing = false, nullBlob = false } = {}) {
  const draws = [], encodes = [];
  const bitmap = { width, height, closed: 0, close() { this.closed++; } };
  const context2d = { clearRect() {}, drawImage(...args) { draws.push(args.slice(1)); } };
  let canvasCalls = 0;
  const canvas = { width: 0, height: 0, getContext: () => contextMissing ? null : context2d, toBlob(callback, type, quality) {
    encodes.push({ type, quality, width: this.width, height: this.height });
    callback(nullBlob ? null : { type, size: sizes[Math.min(encodes.length - 1, sizes.length - 1)], bytes: Buffer.from('encoded transparent raster bytes') });
  } };
  class Reader {
    readAsDataURL(value) {
      if (readError) { this.onerror(); return; }
      this.result = `data:${value.type};base64,${value.bytes.toString('base64')}`;
      this.onload();
    }
  }
  const document = { createElement(name) { assert.equal(name, 'canvas'); canvasCalls++; return canvas; }, querySelector: selector => selector.startsWith('meta') ? { content: 'https://api.zetslay.pro' } : null, querySelectorAll: () => [], addEventListener() {} };
  const context = vm.createContext({ document, FileReader: Reader, createImageBitmap: async () => { if (decodeError) throw Error('decoder error'); return bitmap; }, URL, URLSearchParams, location: { hostname: 'zetslay.pro', search: '' }, sessionStorage: { getItem: () => null }, localStorage: { getItem: () => null, removeItem() {} }, window: {} });
  vm.runInContext(source + '\n' + page + '\n' + cabinet, context);
  const run = code => vm.runInContext(code, context);
  const prepare = input => { context.file = input; return run('compressPluginCover(file)'); };
  return { run, prepare, context, bitmap, draws, encodes, context2d, canvasCalls: () => canvasCalls };
}

test('PNG, JPEG and WebP originals within limits are saved byte-for-byte without a canvas', async () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
    const app = harness();
    const input = file(type, max);
    assert.equal(await app.prepare(input), `data:${type};base64,${input.bytes.toString('base64')}`);
    assert.equal(app.canvasCalls(), 0);
    assert.equal(app.bitmap.closed, 1);
  }
});

test('large banners resize proportionally at high WebP quality and never crop or upscale', async () => {
  const app = harness({ width: 6000, height: 3000 });
  await app.prepare(file('image/jpeg', 6 * 1024 * 1024));
  assert.deepEqual(app.encodes[0], { type: 'image/webp', quality: 0.92, width: 2560, height: 1280 });
  assert.deepEqual(app.draws[0], [0, 0, 2560, 1280]);
  assert.equal(app.context2d.imageSmoothingQuality, 'high');
  assert.equal(app.bitmap.closed, 1);
  const small = harness({ width: 1200, height: 600 });
  await small.prepare(file('image/png', max + 1));
  assert.equal(small.encodes[0].width, 1200);
});

test('portrait and panoramic images use the same full-image resize without distortion', async () => {
  const portrait = harness({ width: 3000, height: 6000 });
  await portrait.prepare(file('image/png', max + 1));
  assert.deepEqual(portrait.draws[0], [0, 0, 1280, 2560]);
  const panoramic = harness({ width: 8000, height: 800 });
  await panoramic.prepare(file('image/jpeg', 1000));
  assert.deepEqual(panoramic.draws[0], [0, 0, 2560, 256]);
});

test('large output has bounded resize retries while retaining encoding quality', async () => {
  const app = harness({ width: 3000, height: 1500, sizes: [max + 1, 1000] });
  await app.prepare(file('image/jpeg', max + 1));
  assert.equal(app.encodes.length, 2);
  assert.equal(app.encodes[1].width, 2176);
  assert.ok(app.encodes.every(encode => encode.quality === 0.92));
  const oversized = harness({ width: 3000, height: 1500, sizes: [max + 1] });
  await assert.rejects(oversized.prepare(file('image/jpeg', max + 1)), /высоким качеством/);
  assert.equal(oversized.encodes.length, 5);
  assert.equal(oversized.bitmap.closed, 1);
});

test('unsupported, empty and oversized files are rejected before decoding', async () => {
  const app = harness();
  for (const input of [file('image/svg+xml'), file('text/html'), file('image/png', 0), file('image/png', 10 * 1024 * 1024 + 1)]) await assert.rejects(app.prepare(input), /до 10 МБ/);
  assert.equal(app.bitmap.closed, 0);
  assert.equal(app.canvasCalls(), 0);
});

test('decode, reading and encoding failures are readable and release decoded images', async () => {
  const decode = harness({ decodeError: true });
  await assert.rejects(decode.prepare(file()), /файл не повреждён/);
  for (const options of [{ readError: true }, { width: 3000, contextMissing: true }, { width: 3000, nullBlob: true }]) {
    const app = harness(options);
    await assert.rejects(app.prepare(file('image/png', options.readError ? 1000 : max + 1)), /Не удалось прочитать|не смог/);
    assert.equal(app.bitmap.closed, 1);
  }
  const bomb = harness({ width: 10000, height: 10000 });
  await assert.rejects(bomb.prepare(file()), /40 млн/);
  assert.equal(bomb.bitmap.closed, 1);
});

test('catalog and detail use the same bounded raster contract, including covers over the old 18K limit', () => {
  const app = harness();
  app.context.cover = `data:image/png;base64,${Buffer.alloc(max).toString('base64')}`;
  assert.ok(app.run('pluginCoverSource({cover,category:"chat"})') === app.context.cover, 'The full 2 MiB raster must be returned without substituting a fallback');
  app.context.cover = `data:image/png;base64,${Buffer.alloc(max + 1).toString('base64')}`;
  assert.equal(app.run('pluginCoverSource({cover,category:"chat"})'), 'assets/plugin-covers/chat.svg');
  for (const cover of ['data:image/svg+xml;base64,AA==', 'https://tracker.test/img', 'data:image/png;base64,AA=', 'javascript:alert(1)']) {
    app.context.cover = cover;
    assert.equal(app.run('isPluginCoverDataUrl(cover)'), false);
  }
});

test('catalog covers restore the original ratio without cropping and cover editing stays separate from the rarity label', () => {
  const css = readFileSync(new URL('./plugin-cover.css', import.meta.url), 'utf8');
  assert.match(css, /\.plugin-catalog \.plugin-card__cover \{[^}]*aspect-ratio: 4 \/ 2\.9/);
  assert.match(css, /\.plugin-page \.plugin-page-cover__frame \{[^}]*aspect-ratio: 4 \/ 2\.9/);
  assert.match(css, /\.plugin-catalog \.plugin-card__cover img \{[^}]*object-fit: contain/);
  assert.match(css, /\.plugin-page \.plugin-page-cover__frame img \{[^}]*object-fit: contain/);
  assert.match(cabinet, /adminMark \? `<div class="plugin-card__cover-meta">\$\{adminMark\}/);
  assert.doesNotMatch(cabinet, /<\/a>\$\{adminMark\}/);
  assert.doesNotMatch(page, /<figure class="plugin-page-cover"/);
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('src="plugin-cover.js') < html.indexOf('src="plugin-page.js'));
  assert.ok(html.indexOf('href="plugin-cover.css') > html.indexOf('href="plugin-page.css'));
});

test('PNG lettering can retain full decoded resolution through lossless encoding under the API limit', async () => {
  const app = harness({ width: 3000, height: 1500 });
  const result = await app.prepare(file('image/png', 3 * 1024 * 1024));
  assert.match(result, /^data:image\/png;base64,/);
  assert.equal(app.encodes.length, 1);
  assert.equal(app.encodes[0].type, 'image/png');
  assert.equal(app.encodes[0].width, 3000);
  assert.deepEqual(app.draws[0], [0, 0, 3000, 1500]);
});

test('detail sizing caps source pixels at device density and leaves catalog and unloaded images alone', () => {
  const app = harness();
  const properties = {};
  app.context.window.devicePixelRatio = 2;
  app.context.image = { src: 'data:image/png;base64,AA==', complete: true, naturalWidth: 720, naturalHeight: 405, matches: () => true, style: { setProperty: (key, value) => { properties[key] = value; }, removeProperty: key => { delete properties[key]; } } };
  app.run('fitPluginDetailCover(image)');
  assert.equal(properties['--plugin-cover-native-width'], '360px');
  assert.equal(properties['--plugin-cover-native-height'], '202.5px');
  app.context.window.devicePixelRatio = 1;
  app.run('fitPluginDetailCover(image)');
  assert.equal(properties['--plugin-cover-native-width'], '720px');
  app.context.image.matches = () => false;
  app.context.window.devicePixelRatio = 3;
  app.run('fitPluginDetailCover(image)');
  assert.equal(properties['--plugin-cover-native-width'], '720px');
  app.context.image.matches = () => true;
  app.context.image.complete = false;
  app.run('fitPluginDetailCover(image)');
  assert.equal(properties['--plugin-cover-native-width'], '720px');
  app.context.image.complete = true;
  app.context.image.src = 'assets/plugin-covers/chat.svg';
  app.run('fitPluginDetailCover(image)');
  assert.equal(properties['--plugin-cover-native-width'], undefined);
});

function uploadHarness() {
  const app = harness();
  app.context.upload = { files: [file()], dataset: { coverFor: 'zetslay.test-plugin' }, value: 'selected' };
  app.context.saved = [];
  app.context.toasts = [];
  app.run(`authState.token='owner-session';authState.user={telegramUserId:'5062414502'};state.pluginCanManage=true;
    state.plugins=[{id:'zetslay.test-plugin',name:'Test',category:'chat',priceRub:0,description:'Description',published:true,cover:'old',installed:true,config:{keep:true}}];
    renderPlugins=()=>{};showToast=(message,tone)=>toasts.push({message,tone});
    compressPluginCover=async()=> 'data:image/png;base64,AA==';
    saveCatalogEntry=async entry=>{saved.push(entry);return entry};loadPluginCatalog=async()=>{};`);
  return app;
}

test('owner upload saves the selected plugin, reflects the acknowledged cover and preserves installation/config', async () => {
  const app = uploadHarness();
  assert.equal(await app.run('uploadPluginCover(upload)'), true);
  assert.equal(app.context.upload.value, '');
  assert.equal(app.context.saved.length, 1);
  assert.equal(app.context.saved[0].id, 'zetslay.test-plugin');
  assert.equal(app.run('state.plugins[0].cover'), 'data:image/png;base64,AA==');
  assert.equal(app.run('state.plugins[0].installed && state.plugins[0].config.keep'), true);
  assert.equal(app.run('pluginCoverUploadId()'), null);
});

test('upload rejects non-admins, a removed plugin and a missing card before saving', async () => {
  for (const setup of ["state.pluginCanManage=false", "authState.user.telegramUserId='123'", "upload.dataset.coverFor='zetslay.auto-reply'", 'state.plugins=[]']) {
    const app = uploadHarness();app.run(setup);
    assert.equal(await app.run('uploadPluginCover(upload)'), false);
    assert.equal(app.context.saved.length, 0);
  }
});

test('duplicate uploads are blocked and a switched session cannot save a decoded image', async () => {
  const app = uploadHarness();let finish;
  app.context.decode = () => new Promise(resolve => {finish=resolve;});
  app.run('compressPluginCover=decode');
  const pending = app.run('uploadPluginCover(upload)');
  assert.equal(app.run('pluginCoverUploadId()'), 'zetslay.test-plugin');
  assert.equal(await app.run('uploadPluginCover(upload)'), false);
  app.run("authState.token='another-session'");finish('data:image/png;base64,AA==');
  assert.equal(await pending, false);
  assert.equal(app.context.saved.length, 0);
  assert.equal(app.run('pluginCoverUploadId()'), null);
});

test('a failed refresh after save stays a saved cover; failed uploads allow selecting the same file again', async () => {
  const app=uploadHarness();app.run("loadPluginCatalog=async()=>{state.pluginCanManage=false;throw Error('NETWORK')}");
  assert.equal(await app.run('uploadPluginCover(upload)'),true);
  assert.equal(app.run('state.plugins[0].cover'),'data:image/png;base64,AA==');
  assert.ok(app.context.toasts.some(t=>t.message.includes('Каталог не обновился')));
  assert.ok(!app.context.toasts.some(t=>t.tone==='error'));
  const failed=uploadHarness();failed.run("saveCatalogEntry=async()=>{throw Error('SAVE_ERROR')}");
  assert.equal(await failed.run('uploadPluginCover(upload)'),false);
  assert.equal(failed.run('state.plugins[0].cover'),'old');
  assert.equal(failed.context.upload.value,'');
  failed.run('saveCatalogEntry=async entry=>entry');
  assert.equal(await failed.run('uploadPluginCover(upload)'),true);
});
