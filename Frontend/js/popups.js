// Frontend/js/popups.js — popup HTML helpers for BAG feature popups.
//
// This module is pure: it does not import from i18n.js or config.js. The
// surrounding strings, layer metadata, and the layer-id→bag-key resolver
// are passed in by app.js as a `deps` object so the module stays free of
// hidden state and is easy to reason about in isolation.

export function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
  ));
}

export function formatBagLabel(key){
  return String(key || '')
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .split(' ')
    .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export function renderUrlArrayHtml(arr){
  if (!Array.isArray(arr) || arr.length === 0) return null;
  if (!arr.every(item => typeof item === 'string' && /^https?:\/\//i.test(item.trim()))) return null;
  if (arr.length === 1){
    const href = escapeHtml(arr[0].trim());
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">${escapeHtml('Link')}</a>`;
  }
  return arr
    .map((url, i) => {
      const href = escapeHtml(url.trim());
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">${escapeHtml('Link ' + (i + 1))}</a>`;
    })
    .join(', ');
}

export function popupValueHtml(value){
  if (value === undefined) return undefined;
  if (value === null) return 'null';

  if (typeof value === 'string'){
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')){
      try{
        const parsed = JSON.parse(trimmed);
        const html = renderUrlArrayHtml(parsed);
        if (html !== null) return html;
      }catch(_){ /* fall through */ }
    }
    if (/^https?:\/\//i.test(trimmed)){
      const href = escapeHtml(trimmed);
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">Link</a>`;
    }
    return escapeHtml(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'){
    return escapeHtml(String(value));
  }

  if (Array.isArray(value)){
    const html = renderUrlArrayHtml(value);
    if (html !== null) return html;
  }

  try{
    return escapeHtml(JSON.stringify(value));
  }catch(_){
    return escapeHtml(String(value));
  }
}

export function collectionPopupTitle(cfg, getCurrentLang){
  if (!cfg) return '';
  if (typeof cfg.popupTitle === 'string') return cfg.popupTitle;
  return cfg.popupTitle?.[getCurrentLang()] || cfg.popupTitle?.nl || '';
}

export function bagPopupHtml(feature, deps){
  const { BAG_COLLECTIONS, tr, getCurrentLang, bagKeyFromLayerId } = deps;
  const props = feature?.properties || {};
  const bagKey = bagKeyFromLayerId(feature?.layer?.id);
  const cfg = BAG_COLLECTIONS[bagKey];
  const title = collectionPopupTitle(cfg, getCurrentLang) || tr('bagPopupDefaultTitle');
  const rows = [];
  const seen = new Set();

  function pushRow(keyName, value){
    if (seen.has(keyName) || value === undefined) return;
    seen.add(keyName);
    const html = popupValueHtml(value);
    rows.push(
      `<div class="summaryRow"><span>${escapeHtml(formatBagLabel(keyName))}</span><strong style="white-space:normal; word-break:break-word;">${html}</strong></div>`
    );
  }

  const preferred = [
    'identificatie',
    'naam',
    'postcode',
    'huisnummer',
    'huisletter',
    'huisnummertoevoeging',
    'status',
    'gebruiksdoel',
    'oppervlakte',
    'bouwjaar'
  ];

  for (const keyName of preferred){
    if (keyName in props) pushRow(keyName, props[keyName]);
  }

  for (const [keyName, value] of Object.entries(props)){
    if (keyName === 'id') continue;
    pushRow(keyName, value);
  }

  return `
    <div style="min-width:240px; max-width:340px;">
      <div style="font-weight:900; margin-bottom:8px;">${escapeHtml(title)}</div>
      ${rows.join('') || `<div class="summaryNote">${escapeHtml(tr('bagSummaryUnavailable'))}</div>`}
    </div>
  `;
}
