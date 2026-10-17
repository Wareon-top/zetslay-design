/* Reading experience only: preserve catalog data, permissions and all settings. */
function pluginDetailEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function pluginDetailInline(value) {
  return String(value).split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map(part => {
    if (/^`[^`]+`$/.test(part)) return `<code>${pluginDetailEscape(part.slice(1, -1))}</code>`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return `<strong>${pluginDetailEscape(part.slice(2, -2))}</strong>`;
    return pluginDetailEscape(part);
  }).join('');
}

function pluginDetailDescription(description, pluginId) {
  const prefix = `plugin-detail-${String(pluginId || 'module').replace(/[^a-z0-9-]/gi, '-').slice(0, 100)}`;
  const sections = [{ title: '', blocks: [] }];
  let section = sections[0], buffer = [], kind = '', code = null;
  const flush = () => { if (buffer.length) section.blocks.push({ kind, lines: buffer }); buffer = []; kind = ''; };
  const add = (type, text) => { if (kind !== type) flush(); kind = type; buffer.push(text); };
  for (const line of String(description || '').split(/\r?\n/)) {
    if (code !== null) {
      if (/^\s*```\s*$/.test(line)) { section.blocks.push({ kind: 'code', lines: code }); code = null; }
      else code.push(line);
      continue;
    }
    if (/^\s*```/.test(line)) { flush(); code = []; continue; }
    const heading = line.match(/^\s*#{1,3}\s+(.+?)\s*#*\s*$/) || line.match(/^\s*\*\*([^*\n]{1,160})\*\*\s*$/);
    if (heading) { flush(); section = { title: heading[1], blocks: [] }; sections.push(section); continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) { flush(); section.blocks.push({ kind: 'rule', lines: [] }); continue; }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) { add('quote', quote[1]); continue; }
    const unordered = line.match(/^\s*[-*•]\s+(.+)$/);
    if (unordered) { add('unordered', unordered[1]); continue; }
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    if (ordered) { add('ordered', { text: ordered[2], number: Number(ordered[1]) }); continue; }
    add('paragraph', line);
  }
  if (code !== null) section.blocks.push({ kind: 'code', lines: code });
  flush();
  const contents = [];
  const render = block => {
    const text = block.kind === 'ordered' ? '' : block.lines.join('\n');
    if (block.kind === 'code') return `<pre><code>${pluginDetailEscape(text)}</code></pre>`;
    if (block.kind === 'rule') return '<hr>';
    if (block.kind === 'quote') return `<blockquote><p>${pluginDetailInline(text)}</p></blockquote>`;
    if (block.kind === 'unordered' || block.kind === 'ordered') {
      const tag = block.kind === 'ordered' ? 'ol' : 'ul';
      return `<${tag}>${block.lines.map(item => block.kind === 'ordered'
        ? `<li${Number.isInteger(item.number) && item.number >= 0 && item.number <= 2147483647 ? ` value="${item.number}"` : ''}>${pluginDetailInline(item.text)}</li>`
        : `<li>${pluginDetailInline(item)}</li>`).join('')}</${tag}>`;
    }
    return `<p>${pluginDetailInline(text)}</p>`;
  };
  const markup = sections.filter(item => item.title || item.blocks.length).map((item, index) => {
    const id = `${prefix}-section-${index + 1}`;
    const number = item.title ? contents.length + 1 : null;
    if (item.title) contents.push({ id, title: item.title });
    return `<section class="plugin-detail-content${item.title ? '' : ' plugin-detail-content--intro'}" id="${id}" tabindex="-1" ${item.title ? `aria-labelledby="${id}-title"` : 'aria-label="Краткое описание"'}>
      ${item.title ? `<div class="plugin-detail-content__heading"><span aria-hidden="true">${String(number).padStart(2, '0')}</span><h3 id="${id}-title">${pluginDetailInline(item.title)}</h3></div>` : ''}
      <div class="plugin-detail-prose">${item.blocks.map(render).join('')}</div></section>`;
  }).join('') || '<p class="plugin-detail-no-description">Описание пока не добавлено.</p>';
  const lines = String(description || '').split(/\r?\n/);
  const first = lines.find(line => line.trim() && !/^\s*(?:#{1,3}\s|>|[-*•]\s|\d+[.)]\s|```)/.test(line) && !/^\s*\*\*[^*]+\*\*\s*$/.test(line))
    || lines.find(line => line.trim()) || 'Подробности модуля ZetSlay';
  const plain = first.replace(/^\s*(?:#{1,3}\s+|>\s?)/, '').replace(/\*\*|`/g, '').trim();
  const summary = plain.length > 260 ? plain.slice(0, 257).trimEnd() + '…' : plain;
  return { markup, contents, prefix, summary };
}

(function installPluginDetailPresentation() {
  if (typeof document === 'undefined' || typeof pluginPageMarkup !== 'function' || pluginPageMarkup.detailPresentation) return;
  const original = pluginPageMarkup;
  pluginPageMarkup = function pluginDetailPresentation(plugin) {
    let html = original(plugin);
    if (typeof html !== 'string' || !html.includes('<div class="plugin-page-description">')) return html;
    const detail = pluginDetailDescription(plugin.description, plugin.id);
    const href = typeof pluginPageHref === 'function' ? pluginPageHref(plugin.id) : `#plugins/${encodeURIComponent(plugin.id)}`;
    const jump = (id, text, className = '') => `<a class="${className}" href="${pluginDetailEscape(href)}" data-plugin-detail-jump="${pluginDetailEscape(id)}">${pluginDetailEscape(text)}</a>`;
    const permissionList = plugin.permissionsRaw || plugin.permissions;
    const count = Array.isArray(permissionList) ? new Set(permissionList.filter(item => typeof item === 'string')).size : 0;
    const category = typeof PLUGIN_CATEGORIES !== 'undefined' ? PLUGIN_CATEGORIES[plugin.category] : null;
    const rarity = typeof pluginRarity === 'function' ? pluginRarity(plugin) : null;
    const symbol = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
    const facts = `<div class="plugin-detail-facts" aria-label="Характеристики плагина">
      <article>${symbol('grid')}<div><span>Категория</span><strong>${pluginDetailEscape(typeof category === 'string' ? category : 'Плагин')}</strong></div></article>
      <article>${symbol('puzzle')}<div><span>Уровень</span><strong>${pluginDetailEscape(rarity?.label || 'Не указан')}</strong></div></article>
      <article>${symbol('shield')}<div><span>Доступ</span><strong>${count} ${count === 1 ? 'разрешение' : count >= 2 && count <= 4 ? 'разрешения' : 'разрешений'}</strong></div></article></div>`;
    const manageId = `${detail.prefix}-manage`;
    const navigation = `<nav class="plugin-detail-navigation" aria-label="Разделы страницы плагина">${jump('plugin-description-title', 'Описание')}${jump('plugin-access-title', 'Разрешения')}${jump(manageId, 'Управление')}</nav>`;
    html = html.replace(/(<header class="plugin-page-heading">[\s\S]*?<p>)[\s\S]*?(<\/p>)/, (_, before, after) => before + pluginDetailEscape(detail.summary) + after);
    html = html.replace(/<div class="plugin-page-description">[\s\S]*?<\/div>/, () => `<div class="plugin-page-description plugin-detail-description">${detail.markup}</div>`);
    html = html.replace(/(<div class="plugin-page-layout">)/, () => facts + navigation + '<div class="plugin-page-layout">');
    html = html.replace('<section class="plugin-page-panel plugin-page-action">', `<section class="plugin-page-panel plugin-page-action" id="${manageId}" tabindex="-1" aria-label="Управление плагином">`);
    if (detail.contents.length > 1) {
      const toc = `<nav class="plugin-detail-toc" aria-label="Содержание описания"><span>В этом описании</span>${detail.contents.map((item, index) => jump(item.id, item.title, 'plugin-detail-toc__link').replace('>', `><small aria-hidden="true">${String(index + 1).padStart(2, '0')}</small>`)).join('')}</nav>`;
      html = html.replace('<section class="plugin-page-panel plugin-page-context">', toc + '<section class="plugin-page-panel plugin-page-context">');
    }
    return html;
  };
  pluginPageMarkup.detailPresentation = true;
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-plugin-detail-jump]');
    if (!link) return;
    const root = document.querySelector('[data-plugin-page]');
    const target = document.getElementById(link.dataset.pluginDetailJump);
    if (!root?.contains(link) || !target || !root.contains(target)) return;
    // Keep #plugins/id intact: changing the hash to a heading would leave this route.
    event.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
  if (typeof renderPluginPage === 'function') renderPluginPage();
})();
