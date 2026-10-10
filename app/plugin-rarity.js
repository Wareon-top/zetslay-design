/* Presentation-only levels. They never grant permissions or change pricing. */
const PLUGIN_RARITIES = Object.freeze({
  common: Object.freeze({label:'Обычный',symbol:'◇'}),
  advanced: Object.freeze({label:'Продвинутый',symbol:'◆'}),
  ultra: Object.freeze({label:'Ультра',symbol:'✦'}),
  legendary: Object.freeze({label:'Легендарный',symbol:'✧'})
});
const PLUGIN_RARITY_BY_ID = Object.freeze({
  'zetslay.confirm-reminder':'common',
  'zetslay.review-reminder':'common',
  'zetslay.lot-cloner':'advanced',
  'zetslay.mass-price-editor':'advanced',
  'zetslay.robux-relay':'ultra',
  'zetslay.stars-relay':'legendary',
  'zetslay.roblox-lzt-market':'legendary',
  'zetslay.tiktok-lzt-market':'legendary',
  'zetslay.sales-pause':'advanced',
  'zetslay.kosell-rent':'legendary',
  'zetslay.auto-review-bonus':'advanced'
});
function pluginRarity(plugin) {
  const key=Object.hasOwn(PLUGIN_RARITY_BY_ID,plugin?.id)?PLUGIN_RARITY_BY_ID[plugin.id]:'common';
  return {key,...PLUGIN_RARITIES[key]};
}
function pluginRarityMarkup(plugin) {
  const rarity=pluginRarity(plugin);
  return `<span class="plugin-rarity plugin-rarity--${rarity.key}" data-plugin-rarity="${rarity.key}" aria-label="Редкость: ${rarity.label}"><span class="plugin-rarity__symbol" aria-hidden="true">${rarity.symbol}</span>${rarity.label}</span>`;
}
