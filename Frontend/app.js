// Frontend application logic for the split frontend/backend dashboard.
// Administrative hierarchy and BAG data are loaded from the backend endpoints.
// External PDOK services are used directly only for basemap rendering.

import { initI18n, tr, getCurrentLang } from './js/i18n.js';
import {
  DEFAULT_VIEW,
  NL_BOUNDS,
  NL_FIT_PADDING,
  BACKEND_BASE_URL,
  PDOK_STYLE_URL,
  LAND_FEATURES_URL,
  BRT_TILES,
  LUCHTFOTO_WMTS_CAPS,
  WORLD_TOPO,
  BAG_COLLECTIONS,
  ALL_BAG_KEYS,
  AUTO_RETRY_DELAYS_MS,
  BAG_FETCH_CONCURRENCY,
  BOUWJAAR_BUCKETS,
  OPPERVLAKTE_BUCKETS,
  GEBRUIKSDOEL_CATEGORIES,
} from './js/config.js';
import {
  fetchWithTimeout,
  fetchBackendJson,
  runWithConcurrencyLimit,
  loadWithAutoRetry,
  loadBagFeaturesForArea,
  loadBagSummaryForArea,
  postReportRequest,
} from './js/api.js';
import {
  initCharts,
  renderBagCharts,
  clearAllBagCharts,
  openChartModal,
  closeChartModal,
  refreshExpandedChartIfOpen,
  syncExpandedTitle,
  getExpandedChartKey,
} from './js/charts.js';
import {
  escapeHtml,
  formatBagLabel,
  bagPopupHtml,
} from './js/popups.js';
import { createReportUi } from './js/reports.js';
import { createBagLayers } from './js/bagLayers.js';
import { createAreaSelection } from './js/areaSelection.js';
import { createMap } from './js/map.js';
import { createLegend } from './js/legend.js';
import {
  state, selectionState,
  provinceByStatcode, gemeenteByStatcode, gmToProvinceStatcode,
  resetController, basemapRefs, legendController, bagSummaryStore,
} from './js/uiState.js';

    (function boot(){
      (function initLogo(){
        const img = document.getElementById('geonovumLogo');
        if (!img) return;
        const srcs = (img.getAttribute('data-srcs') || '').split(',').map(s => s.trim()).filter(Boolean);
        let i = 0;
        const tryNext = () => {
          i += 1;
          if (i >= srcs.length) return;
          img.src = srcs[i];
        };
        img.addEventListener('error', tryNext);
        if (!img.getAttribute('src')) img.src = srcs[0] || '';
      })();

      const selProvincieEl = document.getElementById("selProvincie");
      const selGemeenteEl = document.getElementById("selGemeente");
      const selWijkEl = document.getElementById("selWijk");
      const selBuurtEl = document.getElementById("selBuurt");
      const toggleGemeenteLayerEl = document.getElementById("toggleGemeenteLayer");
      const toggleWijkLayerEl = document.getElementById("toggleWijkLayer");
      const toggleBuurtLayerEl = document.getElementById("toggleBuurtLayer");
      const selInfoEl = document.getElementById("selInfo");
      const languageButtonEl = document.getElementById("languageButton");
      const languageMenuEl = document.getElementById("languageMenu");
      const languageValueEl = document.getElementById("languageValue");
      const bagTogglePandEl = document.getElementById("toggleBagPand");
      const bagToggleVerblijfsobjectEl = document.getElementById("toggleBagVerblijfsobject");
      const bagToggleAdresEl = document.getElementById("toggleBagAdres");
      const bagToggleWoonplaatsEl = document.getElementById("toggleBagWoonplaats");
      const bagToggleStandplaatsEl = document.getElementById("toggleBagStandplaats");
      const bagToggleLigplaatsEl = document.getElementById("toggleBagLigplaats");
      const bagToggleEls = {
        pand: bagTogglePandEl,
        verblijfsobject: bagToggleVerblijfsobjectEl,
        adres: bagToggleAdresEl,
        woonplaats: bagToggleWoonplaatsEl,
        standplaats: bagToggleStandplaatsEl,
        ligplaats: bagToggleLigplaatsEl
      };

      const bagAccordionEl = document.getElementById("bagAccordion");
      const bagAccordionToggleEl = document.getElementById("bagAccordionToggle");
      const bagAccordionPanelEl = document.getElementById("bagAccordionPanel");
      function syncAccordion(groupEl, toggleEl, panelEl, animate=false){
        if (!(groupEl && toggleEl && panelEl)) return;
        const isOpen = groupEl.classList.contains('is-open');
        toggleEl.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (!animate) panelEl.style.transition = 'none';
        if (isOpen) panelEl.style.maxHeight = `${panelEl.scrollHeight}px`;
        else panelEl.style.maxHeight = '0px';
        requestAnimationFrame(() => { if (!animate) panelEl.style.transition = ''; });
      }
      function toggleAccordion(groupEl, toggleEl, panelEl){
        if (!(groupEl && panelEl && toggleEl)) return;
        const opening = !groupEl.classList.contains('is-open');
        if (opening){
          groupEl.classList.add('is-open');
          panelEl.style.maxHeight = '0px';
          requestAnimationFrame(() => { panelEl.style.maxHeight = `${panelEl.scrollHeight}px`; });
        } else {
          panelEl.style.maxHeight = `${panelEl.scrollHeight}px`;
          requestAnimationFrame(() => {
            groupEl.classList.remove('is-open');
            panelEl.style.maxHeight = '0px';
          });
        }
        toggleEl.setAttribute('aria-expanded', opening ? 'true' : 'false');
      }
      function syncBagAccordion(animate=false){ syncAccordion(bagAccordionEl, bagAccordionToggleEl, bagAccordionPanelEl, animate); }
      function toggleBagAccordion(){ toggleAccordion(bagAccordionEl, bagAccordionToggleEl, bagAccordionPanelEl); }
      const legendEl = document.querySelector(".legend");
      const legendBoundarySectionEl = document.getElementById("legendBoundarySection");
      const legendNationalRowEl = document.getElementById("legendNationalRow");
      const legendProvinceRowEl = document.getElementById("legendProvinceRow");
      const legendMunicipalityRowEl = document.getElementById("legendMunicipalityRow");
      const legendWijkRowEl = document.getElementById("legendWijkRow");
      const legendBuurtRowEl = document.getElementById("legendBuurtRow");
      const legendDataSectionEl = document.getElementById("legendDataSection");
      const legendBagRowsEl = document.getElementById("legendBagRows");
      const bagSummaryCardEl = document.getElementById("bagSummaryCard");
      const bagSummaryTitleEl = document.getElementById("bagSummaryTitle");
      const bagSummaryBodyEl = document.getElementById("bagSummaryBody");

      const overviewBtn = document.getElementById("overviewBtn");
      const overviewModal = document.getElementById("overviewModal");
      const overviewClose = document.getElementById("overviewClose");

      function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value; }
      function setHtml(id, value){ const el = document.getElementById(id); if (el) el.innerHTML = value; }

      function openOverview(open){ overviewModal.classList.toggle("open", !!open); }
      overviewBtn.addEventListener("click", () => openOverview(true));
      overviewClose.addEventListener("click", () => openOverview(false));
      overviewModal.addEventListener("click", (e) => { if (e.target === overviewModal) openOverview(false); });
      openOverview(true);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") openOverview(false); });

      if (typeof maplibregl === "undefined"){
        console.error("MapLibre not available. CDN blocked or offline.");
        return;
      }

      let bagPopup = null;
      let bagFeatureRequestId = 0;
      const bagFeatureCache = new Map();

      // Map visualization state - declared here (top-of-file) because
      // updateLegendContext reads `activeMapVisualization` during boot via
      // applyLanguageText, which would TDZ-throw if the let lived inside
      // the Map visualization section further down the file.
      let activeMapVisualization = null;
      const savedLayerPaint = new Map();

      function retryAttemptMessage(label, attempt, totalAttempts, delayMs){
        return `${tr('summaryRetryingPrefix')}${label}. ${tr('summaryRetryAttemptPrefix')}${attempt}${tr('summaryRetryAttemptSeparator')}${totalAttempts}. ${tr('summaryRetryWaitPrefix')}${Math.ceil(delayMs / 1000)}${tr('summaryRetryWaitSuffix')}`;
      }

      function retryFailedMessage(labels){
        const text = Array.isArray(labels) ? labels.join(', ') : String(labels || '');
        return `${tr('summaryRetryFailedPrefix')}${text}.`;
      }

      function selectedAreaFeature(){
        if (state.buurtStatcode) return selectionState.visibleBuurten.find(x => x.properties._statcode === state.buurtStatcode) || selectionState.allBuurten.find(x => x.properties._statcode === state.buurtStatcode) || null;
        if (state.wijkStatcode) return selectionState.visibleWijken.find(x => x.properties._statcode === state.wijkStatcode) || selectionState.allWijken.find(x => x.properties._statcode === state.wijkStatcode) || null;
        if (state.gemeenteStatcode) return gemeenteByStatcode.get(state.gemeenteStatcode) || null;
        if (state.provinceStatcode) return provinceByStatcode.get(state.provinceStatcode) || null;
        return null;
      }

      function selectedAreaLevel(){
        if (state.buurtStatcode) return 'buurt';
        if (state.wijkStatcode) return 'wijk';
        if (state.gemeenteStatcode) return 'municipality';
        if (state.provinceStatcode) return 'province';
        return '';
      }

      function municipalityCodeFromStatcode(statcode){ const m = String(statcode || "").trim().toUpperCase().match(/^(?:GM|WK|BU)(\d{4})/); return m ? m[1] : ""; }
      function normalizeGmCode(v){ const s = String(v ?? "").trim(); return !s ? "" : (s.startsWith("-") ? s : s.padStart(4, "0")); }
      function wijkBody(statcode){ const m = String(statcode || "").match(/WK(.+)/i); return m ? m[1] : ""; }
      function prettyName(props){ return String(props?.statnaam || props?.naam || props?.name || ""); }
      function prettyStatcode(props){ return String(props?.statcode || props?.code || ""); }
      
      
      const {
        map, geojsonBounds, firstNonBackgroundLayerId, ensureWhiteBackground,
        hideBrkMunicipalityLayers, enforceBoundaryStackOrder, setBasemap,
        addAdminSourcesAndLayers, ensureBrtLayer, ensureLuchtfotoLayer,
        addOutsideNlMask, addWorldCountryOutlines,
        setBoundaryLayerVisible, boundaryLayerVisible,
        updateAllBoundaryToggleButtons, applyBoundaryLayerVisibility,
        applyLayerFilters, fitToFeature, featureUnderPointer,
      } = createMap({
        tr, fetchWithTimeout, resetController, basemapRefs, state, selectionState,
        legendController, refreshBagView, wijkBody,
        toggleGemeenteLayerEl, toggleWijkLayerEl, toggleBuurtLayerEl,
        legendMunicipalityRowEl, legendWijkRowEl, legendBuurtRowEl,
      });
      const {
        activeBagKeys, bagSourceId, bagLayerIdsForKey,
        allBagRenderableLayerIds, allDataRenderableLayerIds,
        bagKeyFromLayerId, setBagKeyData, setBagKeyVisibility,
        clearAllBagLayers, ensureBagFeatureLayers,
        bagCacheKey, bagLevelLabel,
      } = createBagLayers({ map, bagToggleEls, tr });
      const { updateReportButtonVisibility, generateReport } = createReportUi({
        tr, postReportRequest,
        selectedAreaLevel, selectedAreaFeature,
        activeBagKeys, state,
        gemeenteByStatcode, provinceByStatcode,
        getCurrentLang, geojsonBounds,
      });
      const {
        resetProvinceSelect, resetMunicipalitySelect, resetWijkSelect, resetBuurtSelect,
        populateProvinces, populateMunicipalities, populateWijken, populateBuurten,
        clearBelowProvince, clearBelowMunicipality, clearBelowWijk,
        selectProvince, selectMunicipality, selectWijk, selectBuurt,
        selectProvinceByFeature, selectMunicipalityByFeature, selectWijkByFeature, selectBuurtByFeature,
        loadAdminData,
      } = createAreaSelection({
        map, tr, fetchBackendJson, state, selectionState,
        provinceByStatcode, gemeenteByStatcode, gmToProvinceStatcode,
        selProvincieEl, selGemeenteEl, selWijkEl, selBuurtEl,
        applyLayerFilters, legendController, fitToFeature,
        prettyStatcode, municipalityCodeFromStatcode,
      });
      const legendApi = createLegend({
        state, selectionState, bagSummaryStore,
        getActiveMapVisualization: () => activeMapVisualization,
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
      });
      Object.assign(legendController, legendApi);
      const {
        renderBagSummaryMessage, renderBagLayerSummarySkeleton,
        renderBagLayerSummary, clearBagSummaryPanel, collectionLabel,
      } = legendApi;
      initCharts({
        getCachedBagFeatures,
        getActiveBagKeys: activeBagKeys,
        getActiveMapVisualization: () => activeMapVisualization,
        getCurrentBagAreaLevel: currentBagAreaLevel,
        getCurrentBagAreaFeature,
        formatNumber,
        getPalettes: () => ({
          bouwjaar: VIZ_PALETTE_BOUWJAAR,
          gebruiksdoel: VIZ_PALETTE_GEBRUIKSDOEL,
          oppervlakte: VIZ_PALETTE_OPPERVLAKTE,
        }),
      });
      initI18n({
        els: {
          languageButtonEl,
          languageMenuEl,
          languageValueEl,
          bagSummaryBodyEl,
          overviewModal,
          overviewBtn,
        },
        setText,
        setHtml,
        updateAllBoundaryToggleButtons,
        updateLegendContext: () => legendController.updateLegendContext(),
        syncExpandedTitle,
        refreshSelectionLabelsOnly: () => legendController.refreshSelectionLabelsOnly(),
        getMutableRefs: () => ({
          homeBtnEl: basemapRefs.homeBtnEl,
          bmBtnEl: basemapRefs.bmBtnEl,
          basemapPopoverEl: basemapRefs.basemapPopoverEl,
          expandedChartKey: getExpandedChartKey(),
        }),
        onLanguageChange: () => {
          refreshBagView().catch(err => console.warn("BAG refresh failed", err));
        },
      });
      legendController.updateDataSummaryCard();

      function formatNumber(value){
        const n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString(tr('formatLocale')) : String(value ?? '');
      }

      function queryDataFeature(point){
        const layers = allDataRenderableLayerIds();
        if (!layers.length) return null;
        const feats = map.queryRenderedFeatures(point, { layers });
        return feats && feats.length ? feats[0] : null;
      }

      function openBagPopup(feature, lngLat){
        closeBagPopup();
        bagPopup = new maplibregl.Popup({
          closeButton:true,
          closeOnClick:false,
          maxWidth:'360px'
        })
          .setLngLat(lngLat)
          .setHTML(bagPopupHtml(feature, { BAG_COLLECTIONS, tr, getCurrentLang, bagKeyFromLayerId }))
          .addTo(map);
      }

      function closeBagPopup(){
        if (bagPopup){
          bagPopup.remove();
          bagPopup = null;
        }
      }

      function getCurrentBagAreaFeature(){ return selectedAreaFeature(); }
      function currentBagAreaLevel(){ return selectedAreaLevel(); }

      function getCachedBagFeatures(key){
        const level = currentBagAreaLevel();
        if (level !== 'wijk' && level !== 'buurt') return null;
        const areaFeature = getCurrentBagAreaFeature();
        if (!areaFeature) return null;
        const statcode = areaFeature.properties?._statcode || '';
        const cacheKey = bagCacheKey(key, level, statcode);
        const fc = bagFeatureCache.get(cacheKey);
        return fc?.features || null;
      }


      // ===== end BAG charts =====

      // ===== Map visualization (bouwjaar / gebruiksdoel / oppervlakte) =====

      // `activeMapVisualization` (the single source of truth for which
      // chart, if any, is recoloring the map) is declared at the top of
      // the file so it is in scope during boot when applyLanguageText →
      // updateLegendContext reads it.

      // ColorBrewer-derived palettes. Hex codes match the spec exactly.
      const VIZ_PALETTE_BOUWJAAR = {
        preBefore1900:  '#ffffb2',
        band1900_1944:  '#fed976',
        band1945_1969:  '#feb24c',
        band1970_1989:  '#fd8d3c',
        band1990_2009:  '#f03b20',
        band2010Plus:   '#bd0026',
        unknown:        '#bdbdbd',
      };
      const VIZ_PALETTE_GEBRUIKSDOEL = {
        woonfunctie:            '#66c2a5',
        winkelfunctie:          '#fc8d62',
        kantoorfunctie:         '#8da0cb',
        industriefunctie:       '#e78ac3',
        onderwijsfunctie:       '#a6d854',
        gezondheidszorgfunctie: '#ffd92f',
        overige:                '#b3b3b3',
        unknown:                '#bdbdbd',
      };
      const VIZ_PALETTE_OPPERVLAKTE = {
        band_lt50:    '#eff3ff',
        band_50_75:   '#c6dbef',
        band_75_100:  '#9ecae1',
        band_100_150: '#6baed6',
        band_150_250: '#3182bd',
        band_250plus: '#08519c',
        unknown:      '#bdbdbd',
        noData:       '#bdbdbd',
      };

      // `savedLayerPaint` (original paint values keyed by
      // `${layerId}::${propName}`, captured at activation and restored on
      // deactivation) is declared at the top of the file alongside
      // `activeMapVisualization` to keep the visualization-state pair
      // co-located and TDZ-safe.

      // ---------- MapLibre paint expressions ----------

      function vizExpressionBouwjaar(){
        return [
          'case',
          ['any',
            ['!', ['has', 'bouwjaar']],
            ['==', ['get', 'bouwjaar'], null],
            ['<=', ['to-number', ['get', 'bouwjaar'], 0], 0],
            ['>=', ['to-number', ['get', 'bouwjaar'], 0], 9000],
          ],
          VIZ_PALETTE_BOUWJAAR.unknown,
          [
            'step',
            ['to-number', ['get', 'bouwjaar']],
            VIZ_PALETTE_BOUWJAAR.preBefore1900,
            1900, VIZ_PALETTE_BOUWJAAR.band1900_1944,
            1945, VIZ_PALETTE_BOUWJAAR.band1945_1969,
            1970, VIZ_PALETTE_BOUWJAAR.band1970_1989,
            1990, VIZ_PALETTE_BOUWJAAR.band1990_2009,
            2010, VIZ_PALETTE_BOUWJAAR.band2010Plus,
          ],
        ];
      }

      function vizExpressionGebruiksdoel(){
        // Bind `gd` to the comma-prefix of `gebruiksdoel`. MapLibre's `let`
        // only exposes the variable inside its BODY (the third argument);
        // the binding-value (second argument) cannot reference `var(gd)`,
        // so the prefix-length calculation here uses `["get","gebruiksdoel"]`
        // directly. Every `["var","gd"]` lives strictly inside the body.
        return [
          'let',
          'gd',
          [
            'slice',
            ['to-string', ['get', 'gebruiksdoel']],
            0,
            [
              'case',
              ['>=', ['index-of', ',', ['to-string', ['get', 'gebruiksdoel']]], 0],
              ['index-of', ',', ['to-string', ['get', 'gebruiksdoel']]],
              ['length', ['to-string', ['get', 'gebruiksdoel']]],
            ],
          ],
          [
            'case',
            ['==', ['typeof', ['get', 'gebruiksdoel']], 'string'],
            [
              'match',
              ['var', 'gd'],
              'woonfunctie',            VIZ_PALETTE_GEBRUIKSDOEL.woonfunctie,
              'winkelfunctie',          VIZ_PALETTE_GEBRUIKSDOEL.winkelfunctie,
              'kantoorfunctie',         VIZ_PALETTE_GEBRUIKSDOEL.kantoorfunctie,
              'industriefunctie',       VIZ_PALETTE_GEBRUIKSDOEL.industriefunctie,
              'onderwijsfunctie',       VIZ_PALETTE_GEBRUIKSDOEL.onderwijsfunctie,
              'gezondheidszorgfunctie', VIZ_PALETTE_GEBRUIKSDOEL.gezondheidszorgfunctie,
              VIZ_PALETTE_GEBRUIKSDOEL.overige,
            ],
            VIZ_PALETTE_GEBRUIKSDOEL.unknown,
          ],
        ];
      }

      function vizExpressionOppervlakte(){
        return [
          'case',
          ['any',
            ['!', ['has', 'oppervlakte']],
            ['==', ['get', 'oppervlakte'], null],
            ['<=', ['to-number', ['get', 'oppervlakte'], 0], 0],
          ],
          VIZ_PALETTE_OPPERVLAKTE.unknown,
          [
            'step',
            ['to-number', ['get', 'oppervlakte']],
            VIZ_PALETTE_OPPERVLAKTE.band_lt50,
            50,  VIZ_PALETTE_OPPERVLAKTE.band_50_75,
            75,  VIZ_PALETTE_OPPERVLAKTE.band_75_100,
            100, VIZ_PALETTE_OPPERVLAKTE.band_100_150,
            150, VIZ_PALETTE_OPPERVLAKTE.band_150_250,
            250, VIZ_PALETTE_OPPERVLAKTE.band_250plus,
          ],
        ];
      }

      // ---------- Layer override resolution ----------

      function visualizationLayersFor(mode){
        const activeKeys = activeBagKeys();
        if (mode === 'bouwjaar'){
          return [{ layerId: 'bag-pand-fill', prop: 'fill-color', value: vizExpressionBouwjaar() }];
        }
        if (mode === 'gebruiksdoel'){
          if (activeKeys.includes('verblijfsobject')){
            return [{ layerId: 'bag-verblijfsobject-circle', prop: 'circle-color', value: vizExpressionGebruiksdoel() }];
          }
          if (activeKeys.includes('pand')){
            return [{ layerId: 'bag-pand-fill', prop: 'fill-color', value: vizExpressionGebruiksdoel() }];
          }
          return [];
        }
        if (mode === 'oppervlakte'){
          const out = [{ layerId: 'bag-verblijfsobject-circle', prop: 'circle-color', value: vizExpressionOppervlakte() }];
          if (activeKeys.includes('pand')){
            out.push({ layerId: 'bag-pand-fill', prop: 'fill-color', value: VIZ_PALETTE_OPPERVLAKTE.noData });
          }
          return out;
        }
        return [];
      }

      function vizModeSourceIsActive(mode){
        const keys = activeBagKeys();
        if (mode === 'bouwjaar')      return keys.includes('pand');
        if (mode === 'gebruiksdoel')  return keys.includes('pand') || keys.includes('verblijfsobject');
        if (mode === 'oppervlakte')   return keys.includes('verblijfsobject');
        return false;
      }

      function vizModeIsAvailable(mode){
        const level = currentBagAreaLevel();
        if (level !== 'wijk' && level !== 'buurt') return false;
        return vizModeSourceIsActive(mode);
      }

      // ---------- Apply / restore paint properties ----------

      function applyMapVisualization(mode){
        const overrides = visualizationLayersFor(mode);
        for (const { layerId, prop, value } of overrides){
          if (!map.getLayer(layerId)) continue;
          const cacheKey = `${layerId}::${prop}`;
          if (!savedLayerPaint.has(cacheKey)){
            savedLayerPaint.set(cacheKey, map.getPaintProperty(layerId, prop));
          }
          try{ map.setPaintProperty(layerId, prop, value); }
          catch(err){ console.warn(`Visualization paint set failed for ${layerId}.${prop}`, err); }
        }
      }

      function restoreMapVisualization(){
        for (const [cacheKey, originalValue] of savedLayerPaint){
          const sep = cacheKey.indexOf('::');
          const layerId = cacheKey.slice(0, sep);
          const prop = cacheKey.slice(sep + 2);
          if (map.getLayer(layerId)){
            try{ map.setPaintProperty(layerId, prop, originalValue); }
            catch(err){ console.warn(`Visualization paint restore failed for ${layerId}.${prop}`, err); }
          }
        }
        savedLayerPaint.clear();
      }

      function refreshActiveMapVisualization(){
        if (!activeMapVisualization) return;
        restoreMapVisualization();
        applyMapVisualization(activeMapVisualization);
      }

      // ---------- State transitions ----------

      function setActiveMapVisualization(mode){
        if (mode === activeMapVisualization){
          deactivateMapVisualization();
          return;
        }
        if (activeMapVisualization){
          restoreMapVisualization();
        }
        activeMapVisualization = mode;
        applyMapVisualization(mode);
        updateVizButtons();
        updateVizLegend();
        legendController.updateLegendContext();
        renderBagCharts();
      }

      function deactivateMapVisualization(){
        if (!activeMapVisualization){
          updateVizButtons();
          updateVizLegend();
          legendController.updateLegendContext();
          return;
        }
        activeMapVisualization = null;
        restoreMapVisualization();
        updateVizButtons();
        updateVizLegend();
        legendController.updateLegendContext();
        renderBagCharts();
      }

      // Called at the end of every refreshBagView so map paint properties
      // stay in sync with whatever data was just loaded for the new area
      // or after a layer toggle. Auto-deactivates if the source layer is
      // no longer on.
      function postBagRefreshSync(){
        if (activeMapVisualization){
          if (!vizModeSourceIsActive(activeMapVisualization)){
            deactivateMapVisualization();
          } else {
            refreshActiveMapVisualization();
          }
        }
        updateVizButtons();
        updateVizLegend();
        legendController.updateLegendContext();
      }

      // ---------- Button / legend rendering ----------

      function updateVizButtons(){
        for (const mode of ['bouwjaar', 'gebruiksdoel', 'oppervlakte']){
          const btn = document.getElementById(`bagVizBtn_${mode}`);
          if (!btn) continue;
          const active = activeMapVisualization === mode;
          const enabled = vizModeIsAvailable(mode);
          btn.classList.toggle('is-active', active);
          btn.disabled = !enabled;
          btn.textContent = active ? tr('vizBtnActive') : tr('vizBtnInactive');
          btn.title = enabled ? '' : tr('vizBtnDisabledHint');
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
      }

      function vizLegendRowHtml(color, label){
        return `<div class="legendVizRow"><span class="legendVizSwatch" style="background:${color}"></span><span>${escapeHtml(label)}</span></div>`;
      }

      function updateVizLegend(){
        const sectionEl = document.getElementById('legendVizSection');
        const titleEl = document.getElementById('legendVizTitle');
        const rowsEl = document.getElementById('legendVizRows');
        if (!(sectionEl && titleEl && rowsEl)) return;
        if (!activeMapVisualization){
          sectionEl.style.display = 'none';
          titleEl.textContent = '';
          rowsEl.innerHTML = '';
          return;
        }
        let title = '';
        let rows = '';
        if (activeMapVisualization === 'bouwjaar'){
          title = tr('vizLegendTitleBouwjaar');
          rows =
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.preBefore1900, '< 1900') +
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.band1900_1944, '1900-1944') +
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.band1945_1969, '1945-1969') +
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.band1970_1989, '1970-1989') +
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.band1990_2009, '1990-2009') +
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.band2010Plus,  '2010+') +
            vizLegendRowHtml(VIZ_PALETTE_BOUWJAAR.unknown,       tr('vizLegendUnknown'));
        } else if (activeMapVisualization === 'gebruiksdoel'){
          title = tr('vizLegendTitleGebruiksdoel');
          rows =
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.woonfunctie,            tr('gebruiksdoelWoonfunctie')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.winkelfunctie,          tr('gebruiksdoelWinkelfunctie')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.kantoorfunctie,         tr('gebruiksdoelKantoorfunctie')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.industriefunctie,       tr('gebruiksdoelIndustriefunctie')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.onderwijsfunctie,       tr('gebruiksdoelOnderwijsfunctie')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.gezondheidszorgfunctie, tr('gebruiksdoelGezondheidszorgfunctie')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.overige,                tr('vizLegendOverige')) +
            vizLegendRowHtml(VIZ_PALETTE_GEBRUIKSDOEL.unknown,                tr('vizLegendUnknown'));
        } else if (activeMapVisualization === 'oppervlakte'){
          title = tr('vizLegendTitleOppervlakte');
          rows =
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.band_lt50,    '< 50 m²') +
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.band_50_75,   '50-75 m²') +
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.band_75_100,  '75-100 m²') +
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.band_100_150, '100-150 m²') +
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.band_150_250, '150-250 m²') +
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.band_250plus, '250+ m²') +
            vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.unknown,      tr('vizLegendUnknown'));
          if (activeBagKeys().includes('pand')){
            rows += vizLegendRowHtml(VIZ_PALETTE_OPPERVLAKTE.noData, tr('vizLegendNoData'));
          }
        }
        titleEl.textContent = title;
        rowsEl.innerHTML = rows;
        sectionEl.style.display = 'block';
      }


      // ===== end map visualization =====

      async function refreshBagView(){
        closeChartModal();
        const activeKeys = activeBagKeys();
        const reqId = ++bagFeatureRequestId;
        closeBagPopup();

        if (!activeKeys.length){
          clearAllBagLayers();
          bagSummaryStore.html = '';
          legendController.updateBagLegend([], {}, false);
          legendController.updateDataSummaryCard();
          clearAllBagCharts();
          postBagRefreshSync();
          return;
        }

        const areaFeature = getCurrentBagAreaFeature();
        const level = currentBagAreaLevel();
        const showMap = level === 'wijk' || level === 'buurt';

        if (!areaFeature){
          clearAllBagLayers();
          legendController.updateBagLegend([], {}, false);
          renderBagSummaryMessage(tr('bagSummaryNoSelection'));
          clearAllBagCharts();
          postBagRefreshSync();
          return;
        }

        // Synchronous, single-paint reset: stale data is replaced with the
        // skeleton state before any fetch begins. Then immediately overlay
        // any cached values so previously-loaded layers stay visible.
        clearBagSummaryPanel();

        const initialRows = [];
        const loadingKeys = new Set();
        for (const key of activeKeys){
          const label = collectionLabel(BAG_COLLECTIONS[key]);
          if (showMap){
            const cacheKey = bagCacheKey(key, level, areaFeature.properties?._statcode || '');
            const cached = bagFeatureCache.get(cacheKey);
            if (cached){
              const cachedCount = Number.isFinite(cached._summaryCount) ? cached._summaryCount : (cached.features || []).length;
              initialRows.push({ key, label, count: cachedCount });
            } else {
              initialRows.push({ key, label, skeleton: true });
              loadingKeys.add(key);
            }
          } else {
            // Non-feature level: every active BAG type tries the per-type
            // summary cache. Cached number → render count; cached null
            // (backend has no summary for this type yet) → render the
            // "Available at wijk/buurt level" placeholder; not cached
            // yet → skeleton until the async loop populates the cache.
            const summaryCacheKey = `${bagCacheKey(key, level, areaFeature.properties?._statcode || '')}:summary`;
            const cached = bagFeatureCache.get(summaryCacheKey);
            if (cached){
              if (Number.isFinite(cached._summaryCount)){
                initialRows.push({ key, label, count: cached._summaryCount });
              } else {
                initialRows.push({ key, label, placeholder: true });
              }
            } else {
              initialRows.push({ key, label, skeleton: true });
              loadingKeys.add(key);
            }
          }
        }

        renderBagLayerSummary(initialRows, areaFeature, level, [], showMap, loadingKeys.size ? tr('bagSummaryLoadingStatic') : '');
        renderBagCharts(loadingKeys);

        const statcode = areaFeature.properties?._statcode || '';

        // Phase A — Build per-key tasks synchronously in ALL_BAG_KEYS order.
        // Tasks that need a network call are picked up by the worker pool in
        // Phase B; cached/inactive tasks are resolved here without awaiting.
        const tasks = ALL_BAG_KEYS.map(key => {
          const isActive = activeKeys.includes(key);
          const label = collectionLabel(BAG_COLLECTIONS[key]);

          if (!isActive){
            return { key, label, kind: 'inactive' };
          }

          if (!showMap){
            const cacheKey = `${bagCacheKey(key, level, statcode)}:summary`;
            const cached = bagFeatureCache.get(cacheKey);
            if (cached){
              return { key, label, kind: 'cached-summary', summaryEntry: cached };
            }
            return { key, label, kind: 'fetch-summary', cacheKey };
          }

          const cacheKey = bagCacheKey(key, level, statcode);
          const cached = bagFeatureCache.get(cacheKey);
          if (cached){
            return { key, label, kind: 'cached-features', fc: cached };
          }
          return { key, label, kind: 'fetch-features', cacheKey };
        });

        // Pre-clear stale map layer state. This mirrors the original
        // setBagKeyData(empty)+setBagKeyVisibility(false) writes that
        // happened before each per-key await in the old loop.
        for (const task of tasks){
          if (task.kind === 'cached-features') continue;
          setBagKeyData(task.key, { type:'FeatureCollection', features: [] });
          setBagKeyVisibility(task.key, false);
        }

        // Phase B — run network tasks in parallel with concurrency cap of 3.
        const fetchTasks = tasks.filter(t => t.kind === 'fetch-summary' || t.kind === 'fetch-features');
        const fetchResults = await runWithConcurrencyLimit(fetchTasks, BAG_FETCH_CONCURRENCY, async (task) => {
          if (task.kind === 'fetch-summary'){
            const attemptResult = await loadWithAutoRetry({
              loadFn: () => loadBagSummaryForArea(task.key, areaFeature, level),
              onRetry: ({ error }) => {
                console.warn(`BAG summary load failed for ${task.key}; retrying`, error);
              }
            });
            if (reqId !== bagFeatureRequestId) return null;
            return { taskKey: task.key, attemptResult };
          }
          const attemptResult = await loadWithAutoRetry({
            loadFn: () => loadBagFeaturesForArea(task.key, areaFeature, level),
            onRetry: ({ error }) => {
              console.warn(`BAG load failed for ${task.key}; retrying`, error);
            }
          });
          if (reqId !== bagFeatureRequestId) return null;
          return { taskKey: task.key, attemptResult };
        });

        if (reqId !== bagFeatureRequestId) return;

        const resultByKey = new Map();
        for (const entry of fetchResults){
          if (entry) resultByKey.set(entry.taskKey, entry.attemptResult);
        }

        // Phase C — merge in ALL_BAG_KEYS order so rows render in stable order.
        const rows = [];
        const countsByKey = {};
        const partialKeys = [];
        const failedKeys = [];

        for (const task of tasks){
          const { key, label, kind } = task;

          if (kind === 'inactive'){
            continue;
          }

          if (kind === 'cached-summary'){
            const count = task.summaryEntry?._summaryCount;
            if (Number.isFinite(count)){
              countsByKey[key] = count;
              rows.push({ label, count });
            } else {
              countsByKey[key] = 0;
              rows.push({ label, placeholder: true });
            }
            continue;
          }

          if (kind === 'fetch-summary'){
            const attemptResult = resultByKey.get(key);
            if (attemptResult && attemptResult.ok){
              const summaryEntry = {
                type:'FeatureCollection',
                features: [],
                _summaryCount: attemptResult.data?.count
              };
              bagFeatureCache.set(task.cacheKey, summaryEntry);
              const count = summaryEntry._summaryCount;
              if (Number.isFinite(count)){
                countsByKey[key] = count;
                rows.push({ label, count });
              } else {
                countsByKey[key] = 0;
                rows.push({ label, placeholder: true });
              }
            } else {
              if (attemptResult){
                console.warn(`BAG summary load failed for ${key}`, attemptResult.error);
              }
              failedKeys.push(label);
              rows.push({ label, error: true });
              countsByKey[key] = 0;
            }
            continue;
          }

          if (kind === 'cached-features'){
            const fc = task.fc;
            setBagKeyData(key, fc);
            const count = Number.isFinite(fc._summaryCount) ? fc._summaryCount : (fc.features || []).length;
            countsByKey[key] = count;
            setBagKeyVisibility(key, (fc.features || []).length > 0);
            rows.push({ label, count });
            if (fc._truncated) partialKeys.push(label);
            continue;
          }

          if (kind === 'fetch-features'){
            const attemptResult = resultByKey.get(key);
            if (attemptResult && attemptResult.ok){
              const fc = attemptResult.data;
              bagFeatureCache.set(task.cacheKey, fc);
              setBagKeyData(key, fc);
              const count = Number.isFinite(fc._summaryCount) ? fc._summaryCount : (fc.features || []).length;
              countsByKey[key] = count;
              setBagKeyVisibility(key, (fc.features || []).length > 0);
              rows.push({ label, count });
              if (fc._truncated) partialKeys.push(label);
            } else {
              if (attemptResult){
                console.warn(`BAG load failed for ${key}`, attemptResult.error);
              }
              failedKeys.push(label);
              rows.push({ label, error: true });
              countsByKey[key] = 0;
            }
            continue;
          }
        }

        if (reqId !== bagFeatureRequestId) return;
        legendController.updateBagLegend(activeKeys, countsByKey, showMap);
        renderBagLayerSummary(rows, areaFeature, level, partialKeys, showMap, failedKeys.length ? retryFailedMessage(failedKeys) : '');
        renderBagCharts();
        postBagRefreshSync();
      }


      map.on("load", async ()=>{ map.fitBounds(NL_BOUNDS, { padding: NL_FIT_PADDING, duration: 0, animate: false }); ensureWhiteBackground(); const beforeId = firstNonBackgroundLayerId(); try{ await ensureBrtLayer(beforeId); await addOutsideNlMask(beforeId); await addWorldCountryOutlines(beforeId); }catch(err){ console.warn(err); } setBasemap("brt"); hideBrkMunicipalityLayers(); addAdminSourcesAndLayers(); ensureBagFeatureLayers(); updateAllBoundaryToggleButtons(); applyBoundaryLayerVisibility(); enforceBoundaryStackOrder(); try{ await loadAdminData(); enforceBoundaryStackOrder(); }catch(err){ console.error(err); selProvincieEl.innerHTML = `<option value="">${tr("loadFailedProvinces")}</option>`; selGemeenteEl.innerHTML = `<option value="">${tr("loadFailedMunicipalities")}</option>`; resetWijkSelect(tr("loadFailedShort")); resetBuurtSelect(tr("loadFailedShort")); }
        resetController.resetToNationalView = () => { state.provinceStatcode = ""; state.gemeenteStatcode = ""; state.gmCode = ""; state.wijkStatcode = ""; state.buurtStatcode = ""; selProvincieEl.value = ""; selGemeenteEl.value = ""; selWijkEl.value = ""; selBuurtEl.value = ""; resetMunicipalitySelect(); resetWijkSelect(); resetBuurtSelect(); applyLayerFilters(); legendController.updateInfoBox(); closeBagPopup(); };
        selProvincieEl.addEventListener("change", ()=> selectProvince(selProvincieEl.value, true));
        selGemeenteEl.addEventListener("change", ()=> selectMunicipality(selGemeenteEl.value, true));
        selWijkEl.addEventListener("change", ()=> { if (!state.gemeenteStatcode) return; selectWijk(selWijkEl.value, true); });
        selBuurtEl.addEventListener("change", ()=> { if (!state.wijkStatcode) return; selectBuurt(selBuurtEl.value, true); });
        selInfoEl?.addEventListener("click", (e) => {
          const btn = e.target.closest('button.bcSeg[data-bc-level]');
          if (!btn) return;
          const level = btn.dataset.bcLevel;
          if (level === 'province') selectMunicipality('', true);
          else if (level === 'gemeente') selectWijk('', true);
          else if (level === 'wijk') selectBuurt('', true);
        });
        toggleGemeenteLayerEl?.addEventListener("click", (e)=> { e.stopPropagation(); setBoundaryLayerVisible('gemeente', !boundaryLayerVisible('gemeente')); });
        toggleWijkLayerEl?.addEventListener("click", (e)=> { e.stopPropagation(); setBoundaryLayerVisible('wijk', !boundaryLayerVisible('wijk')); });
        toggleBuurtLayerEl?.addEventListener("click", (e)=> { e.stopPropagation(); setBoundaryLayerVisible('buurt', !boundaryLayerVisible('buurt')); });
        for (const btn of [toggleGemeenteLayerEl, toggleWijkLayerEl, toggleBuurtLayerEl]){
          btn?.addEventListener("mousedown", (e)=> e.stopPropagation());
        }
        Object.values(bagToggleEls).forEach(el => {
          el?.addEventListener("change", () => {
            refreshBagView().catch(err => console.warn("BAG refresh failed", err));
          });
        });
        ['bouwjaar', 'gebruiksdoel', 'oppervlakte'].forEach(mode => {
          const btn = document.getElementById(`bagVizBtn_${mode}`);
          btn?.addEventListener('click', () => {
            if (btn.disabled) return;
            setActiveMapVisualization(mode);
          });
        });

        document.querySelectorAll('.chartExpandBtn[data-chart-key]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = btn.dataset.chartKey;
            if (key) openChartModal(key);
          });
        });
        ['Bouwjaar', 'Gebruiksdoel', 'Oppervlakte'].forEach(suffix => {
          const sectionEl = document.getElementById(`chartSection${suffix}`);
          const wrapEl = sectionEl?.querySelector('.bagChartCanvasWrap');
          const key = suffix.toLowerCase();
          wrapEl?.addEventListener('click', (e) => {
            if (e.target.closest('.chartExpandBtn')) return;
            openChartModal(key);
          });
        });

        updateVizButtons();
        updateVizLegend();
        map.on("click", e => { const dataFeature = queryDataFeature(e.point); if (dataFeature){ openBagPopup(dataFeature, e.lngLat); return; } const buurt = featureUnderPointer(e.point, "cbs-buurt-hit"); if (buurt){ closeBagPopup(); return selectBuurtByFeature(buurt, true); } const wijk = featureUnderPointer(e.point, "cbs-wijk-hit"); if (wijk){ closeBagPopup(); return selectWijkByFeature(wijk, true); } const gemeente = featureUnderPointer(e.point, "cbs-gemeente-hit"); if (gemeente){ closeBagPopup(); return selectMunicipalityByFeature(gemeente, true); } const provincie = featureUnderPointer(e.point, "cbs-provincie-hit"); if (provincie){ closeBagPopup(); return selectProvinceByFeature(provincie, true); } closeBagPopup(); });
        syncBagAccordion(false);
        bagAccordionToggleEl?.addEventListener("click", toggleBagAccordion);
        document.getElementById('reportDownloadBtn')?.addEventListener('click', () => { generateReport(); });
        updateReportButtonVisibility();
        map.on("mousemove", e => { const hit = queryDataFeature(e.point) || featureUnderPointer(e.point, "cbs-buurt-hit") || featureUnderPointer(e.point, "cbs-wijk-hit") || featureUnderPointer(e.point, "cbs-gemeente-hit") || featureUnderPointer(e.point, "cbs-provincie-hit"); map.getCanvas().style.cursor = hit ? "pointer" : ""; });
      });
      map.on("error", e => console.error("MapLibre error:", e?.error || e));
    })();