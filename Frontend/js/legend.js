// Frontend/js/legend.js — info box, boundary legend, BAG summary card.
//
// `createLegend` owns the right-side info breadcrumb, the bottom-left
// boundary/layer legend rows, and the BAG-summary card on the right.
// The factory is reached for via `legendController` in app.js so that
// createMap (applyBoundaryLayerVisibility → updateLegendContext) and
// createAreaSelection (select* → updateInfoBox) can call back into it
// despite running earlier in the boot block.
//
// `bagSummaryStore.html` is a shared mutable container: legend functions
// rebuild it; refreshBagView (in app.js) clears it before fetches.

import { ALL_BAG_KEYS, BAG_COLLECTIONS } from './config.js';
import { escapeHtml } from './popups.js';

export function createLegend(deps){
  const {
    state, selectionState, bagSummaryStore,
    getActiveMapVisualization,
    tr, getCurrentLang,
    prettyName, formatNumber,
    activeBagKeys, bagLevelLabel,
    updateReportButtonVisibility,
    boundaryLayerVisible,
    populateProvinces,
    resetProvinceSelect, resetMunicipalitySelect, resetWijkSelect, resetBuurtSelect,
    renderBagCharts,
    bagSummaryCardEl, bagSummaryBodyEl,
    legendBagRowsEl, legendNationalRowEl, legendProvinceRowEl,
    legendMunicipalityRowEl, legendWijkRowEl, legendBuurtRowEl,
    legendBoundarySectionEl, legendDataSectionEl, legendEl,
    selProvincieEl, selGemeenteEl, selWijkEl, selBuurtEl, selInfoEl,
    provinceByStatcode, gemeenteByStatcode,
  } = deps;

  function collectionLabel(cfg){
    if (!cfg) return '';
    if (typeof cfg.label === 'string') return cfg.label;
    return cfg.label?.[getCurrentLang()] || cfg.label?.nl || '';
  }

  function registrySummarySectionHtml(registryName, innerHtml){
    return `
      <div class="summaryMetricLabel" style="margin:0 0 8px 0;">${escapeHtml(registryName)}</div>
      ${innerHtml}
    `;
  }

  function updateDataSummaryCard(){
    if (!(bagSummaryCardEl && bagSummaryBodyEl)) return;

    const anyAreaSelected = !!(state.provinceStatcode || state.gemeenteStatcode || state.wijkStatcode || state.buurtStatcode);
    const anyBagLayerActive = activeBagKeys().length > 0;
    const sections = [bagSummaryStore.html].filter(Boolean);
    if (!anyAreaSelected || !anyBagLayerActive || !sections.length){
      bagSummaryCardEl.style.display = 'none';
      delete bagSummaryBodyEl.dataset.dynamic;
      updateReportButtonVisibility();
      return;
    }

    bagSummaryCardEl.style.display = 'block';
    bagSummaryBodyEl.dataset.dynamic = '1';
    bagSummaryBodyEl.innerHTML = sections.join('<div style="height:1px;background:rgba(15,23,42,0.08);margin:12px 0;"></div>');
    updateReportButtonVisibility();
  }

  function renderBagSummaryMessage(message){
    bagSummaryStore.html = registrySummarySectionHtml('BAG', `<div class="summaryNote">${escapeHtml(message)}</div>`);
    updateDataSummaryCard();
  }

  function renderBagLayerSummarySkeleton(level, activeKeys, showMap, statusMessage=''){
    const rows = activeKeys.slice(0, 5).map(() => `
      <div class="summarySkeletonRow">
        <span class="summarySkeletonBar" style="width:120px;"></span>
        <span class="summarySkeletonBar" style="width:52px;"></span>
      </div>
    `).join('');

    bagSummaryStore.html = registrySummarySectionHtml('BAG', `
      <div class="summarySkeleton" aria-hidden="true">
        <div class="summarySkeletonRow">
          <span>${escapeHtml(tr('bagSummaryArea'))}</span>
          <span class="summarySkeletonBar" style="width:140px;"></span>
        </div>
        <div class="summarySkeletonRow">
          <span>${escapeHtml(tr('bagSummaryLevel'))}</span>
          <strong>${escapeHtml(bagLevelLabel(level))}</strong>
        </div>
        <div class="summarySkeletonBox">
          <div class="summaryMetricLabel">${escapeHtml(tr('bagSummaryActiveBagLayers'))}</div>
          <div class="summarySkeletonStack">${rows}</div>
        </div>
        <div class="summaryNote">${escapeHtml(statusMessage || tr('bagSummaryLoadingStatic'))}</div>
      </div>
    `);
    updateDataSummaryCard();
  }

  function renderBagLayerSummary(rows, areaFeature, level, partialKeys, showMap, extraNote=''){
    if (!areaFeature) return;

    const areaLabel = `${prettyName(areaFeature.properties)} (${areaFeature.properties?._statcode || ''})`;
    const rowHtml = rows.map(row => {
      if (row.skeleton){
        return `
        <div class="summarySkeletonRow">
          <span>${escapeHtml(row.label)}</span>
          <span class="summarySkeletonBar" style="width:52px;"></span>
        </div>
      `;
      }
      if (row.placeholder){
        return `
        <div class="summaryRow">
          <span>${escapeHtml(row.label)}</span>
          <span style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <strong>-</strong>
            <span class="summaryNote" style="margin:0;">${escapeHtml(tr('bagSummaryAvailableAtWijkBuurt'))}</span>
          </span>
        </div>
      `;
      }
      const valueText = row.error ? tr('summaryLoadFailedShort') : formatNumber(row.count);
      return `
      <div class="summaryRow">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(valueText)}</strong>
      </div>
    `;
    }).join('');

    const partialNote = partialKeys.length
      ? `<div class="summaryNote">${escapeHtml(tr('partialLoadNotePrefix'))}${escapeHtml(partialKeys.join(', '))}.</div>`
      : '';
    const extraNoteHtml = extraNote ? `<div class="summaryNote">${escapeHtml(extraNote)}</div>` : '';
    const modeNote = showMap
      ? `<div class="summaryNote">${escapeHtml(tr('bagSummaryShownOnMap'))}</div>`
      : `<div class="summaryNote">${escapeHtml(tr('bagSummaryOnlySummaryAtLevelPrefix'))}${escapeHtml(bagLevelLabel(level).toLowerCase())}${escapeHtml(tr('bagSummaryOnlySummaryAtLevelSuffix'))}</div>`;

    bagSummaryStore.html = registrySummarySectionHtml('BAG', `
      <div class="summaryRow">
        <span>${escapeHtml(tr('bagSummaryArea'))}</span>
        <strong>${escapeHtml(areaLabel)}</strong>
      </div>
      <div class="summaryRow">
        <span>${escapeHtml(tr('bagSummaryLevel'))}</span>
        <strong>${escapeHtml(bagLevelLabel(level))}</strong>
      </div>
      <div class="summaryList" style="margin-top:10px;">
        <div class="summaryMetricLabel">${escapeHtml(tr('bagSummaryLoadedBagObjects'))}</div>
        ${rowHtml || `<div class="summaryNote">${escapeHtml(tr('summaryNoObjectsLoaded'))}</div>`}
      </div>
      ${modeNote}
      ${partialNote}
      ${extraNoteHtml}
    `);
    updateDataSummaryCard();
  }

  function updateBagLegend(activeKeys, countsByKey = {}, showMap = false){
    const visibleKeys = activeKeys.filter(key => (countsByKey[key] || 0) > 0);
    const keysForLabel = visibleKeys.length ? visibleKeys : activeKeys;

    if (!legendBagRowsEl){
      updateLegendContext();
      return;
    }

    if (!showMap || !keysForLabel.length){
      legendBagRowsEl.innerHTML = '';
      updateLegendContext();
      return;
    }

    const orderedKeys = ALL_BAG_KEYS.filter(k => keysForLabel.includes(k));
    const rows = orderedKeys.map(key => {
      const cfg = BAG_COLLECTIONS[key];
      if (!cfg) return '';
      const label = escapeHtml(collectionLabel(cfg));
      if (cfg.geometry === 'point'){
        const fill = cfg.circle || '#000000';
        return `<div class="legendRow"><span class="legendBagSwatch legendBagSwatch--point" style="background:${fill};border-color:${fill};"></span><span>${label}</span></div>`;
      }
      const fill = cfg.fill || '#ffffff';
      const line = cfg.line || 'rgba(15,23,42,0.18)';
      return `<div class="legendRow"><span class="legendBagSwatch" style="background:${fill};border-color:${line};"></span><span>${label}</span></div>`;
    }).join('');
    legendBagRowsEl.innerHTML = rows;
    updateLegendContext();
  }

  function clearBagSummaryPanel(){
    const activeKeys = activeBagKeys();
    const level = state.buurtStatcode ? 'buurt'
                : state.wijkStatcode ? 'wijk'
                : state.gemeenteStatcode ? 'municipality'
                : state.provinceStatcode ? 'province'
                : '';
    const showMap = level === 'wijk' || level === 'buurt';

    if (activeKeys.length){
      renderBagLayerSummarySkeleton(level, activeKeys, showMap);
    } else {
      bagSummaryStore.html = '';
      updateDataSummaryCard();
    }

    renderBagCharts(new Set(activeKeys));

    const sourceLineEl = document.getElementById('bagChartSourceLine');
    if (sourceLineEl) sourceLineEl.style.display = 'none';
  }

  function updateLegendContext(){
    let showNational = false;
    let showProvince = false;
    let showMunicipality = false;
    let showWijk = false;
    let showBuurt = false;

    if (state.buurtStatcode){
      showBuurt = boundaryLayerVisible('buurt');
    } else if (state.wijkStatcode){
      showWijk = boundaryLayerVisible('wijk');
      showBuurt = boundaryLayerVisible('buurt');
    } else if (state.gemeenteStatcode){
      showMunicipality = boundaryLayerVisible('gemeente');
      showWijk = boundaryLayerVisible('wijk');
    } else if (state.provinceStatcode){
      showProvince = true;
      showMunicipality = boundaryLayerVisible('gemeente');
    } else {
      showNational = true;
      showProvince = true;
    }

    if (legendNationalRowEl) legendNationalRowEl.style.display = showNational ? 'flex' : 'none';
    if (legendProvinceRowEl) legendProvinceRowEl.style.display = showProvince ? 'flex' : 'none';
    if (legendMunicipalityRowEl) legendMunicipalityRowEl.style.display = showMunicipality ? 'flex' : 'none';
    if (legendWijkRowEl) legendWijkRowEl.style.display = showWijk ? 'flex' : 'none';
    if (legendBuurtRowEl) legendBuurtRowEl.style.display = showBuurt ? 'flex' : 'none';
    if (legendBoundarySectionEl) legendBoundarySectionEl.style.display = (showNational || showProvince || showMunicipality || showWijk || showBuurt) ? 'block' : 'none';
    const bagVisible = !!legendBagRowsEl && legendBagRowsEl.children.length > 0;
    if (legendDataSectionEl) legendDataSectionEl.style.display = bagVisible ? 'block' : 'none';
    const vizLegendVisible = !!getActiveMapVisualization();
    if (legendEl) legendEl.style.display = (showNational || showProvince || showMunicipality || showWijk || showBuurt || bagVisible || vizLegendVisible) ? 'block' : 'none';
  }

  function syncAreaFieldEmptyStates(){
    const pairs = [
      [selProvincieEl, !state.provinceStatcode],
      [selGemeenteEl, !state.gemeenteStatcode],
      [selWijkEl, !state.wijkStatcode],
      [selBuurtEl, !state.buurtStatcode]
    ];
    for (const [el, isEmpty] of pairs){
      const field = el?.closest('.areaField');
      if (field) field.classList.toggle('is-empty', isEmpty);
    }
  }

  function updateInfoBox(){
      const escapeHtmlLocal = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
      const segs = [];

      if (state.provinceStatcode){
      const pf = provinceByStatcode.get(state.provinceStatcode);
      if (pf) segs.push({ level: 'province', name: prettyName(pf.properties) });
      }

      if (state.gemeenteStatcode){
      const gf = gemeenteByStatcode.get(state.gemeenteStatcode);
      if (gf) segs.push({ level: 'gemeente', name: prettyName(gf.properties) });
      }

      if (state.wijkStatcode){
      const wf =
      selectionState.visibleWijken.find(f => f.properties?._statcode === state.wijkStatcode) ||
      selectionState.allWijken.find(f => f.properties?._statcode === state.wijkStatcode);
      if (wf) segs.push({ level: 'wijk', name: prettyName(wf.properties) });
      }

      if (state.buurtStatcode){
     const bf =
      selectionState.visibleBuurten.find(f => f.properties?._statcode === state.buurtStatcode) ||
      selectionState.allBuurten.find(f => f.properties?._statcode === state.buurtStatcode);
      if (bf) segs.push({ level: 'buurt', name: prettyName(bf.properties) });
      }

      if (!segs.length){
        selInfoEl.innerHTML = '';
      } else {
        const sep = '<svg class="bcSep" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
        const lastIdx = segs.length - 1;
        const html = segs.map((s, i) => {
          const text = escapeHtmlLocal(s.name);
          if (i === lastIdx){
            return `<span class="bcSeg bcSeg--current">${text}</span>`;
          }
          return `<button type="button" class="bcSeg" data-bc-level="${s.level}">${text}</button>`;
        }).join(sep);
        selInfoEl.innerHTML = html;
      }

      syncAreaFieldEmptyStates();
}

  function refreshSelectionLabelsOnly(){
  if (selectionState.allProvinces.length){
    populateProvinces();
    selProvincieEl.value = state.provinceStatcode || "";
  } else {
    resetProvinceSelect(tr("loadingProvinces"));
  }

  if (state.provinceStatcode){
    const rows = selectionState.allGemeenten
      .map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
      .sort((a,b) => a.name.localeCompare(b.name, "nl"));

    if (!rows.length){
      resetMunicipalitySelect(tr("noMunicipalitiesFound"));
    } else {
      selGemeenteEl.innerHTML = `<option value="">${tr("allMunicipalities")}</option>`;
      for (const row of rows){
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = `${row.name} (${row.id})`;
        selGemeenteEl.appendChild(opt);
      }
      selGemeenteEl.disabled = false;
      selGemeenteEl.value = state.gemeenteStatcode || "";
    }
  } else {
    resetMunicipalitySelect(tr("selectProvinceFirst"));
  }

  if (state.gmCode){
    const rows = selectionState.visibleWijken
      .map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
      .sort((a,b) => a.name.localeCompare(b.name, "nl"));

    if (!rows.length){
      resetWijkSelect(tr("noWijkFound"));
    } else {
      selWijkEl.innerHTML = `<option value="">${tr("allWijken")}</option>`;
      for (const row of rows){
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = `${row.name} (${row.id})`;
        selWijkEl.appendChild(opt);
      }
      selWijkEl.disabled = false;
      selWijkEl.value = state.wijkStatcode || "";
    }
  } else {
    resetWijkSelect(tr("selectMunicipalityFirst"));
  }

  if (state.gmCode && state.wijkStatcode){
    const rows = selectionState.visibleBuurten
      .map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
      .sort((a,b) => a.name.localeCompare(b.name, "nl"));

    if (!rows.length){
      resetBuurtSelect(tr("noBuurtFound"));
    } else {
      selBuurtEl.innerHTML = `<option value="">${tr("allBuurten")}</option>`;
      for (const row of rows){
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = `${row.name} (${row.id})`;
        selBuurtEl.appendChild(opt);
      }
      selBuurtEl.disabled = false;
      selBuurtEl.value = state.buurtStatcode || "";
    }
  } else {
    resetBuurtSelect(tr("selectWijkFirst"));
  }

  updateInfoBox();
}

  return {
    updateLegendContext,
    updateInfoBox,
    updateDataSummaryCard,
    updateBagLegend,
    refreshSelectionLabelsOnly,
    renderBagSummaryMessage,
    renderBagLayerSummarySkeleton,
    renderBagLayerSummary,
    clearBagSummaryPanel,
    collectionLabel,
  };
}
