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

      let homeBtnEl = null;
      let bmBtnEl = null;
      let basemapPopoverEl = null;



      function collectionLabel(cfg){
        if (!cfg) return '';
        if (typeof cfg.label === 'string') return cfg.label;
        return cfg.label?.[getCurrentLang()] || cfg.label?.nl || '';
      }

      function collectionPopupTitle(cfg){
        if (!cfg) return '';
        if (typeof cfg.popupTitle === 'string') return cfg.popupTitle;
        return cfg.popupTitle?.[getCurrentLang()] || cfg.popupTitle?.nl || '';
      }

      function setText(id, value){ const el = document.getElementById(id); if (el) el.textContent = value; }
      function setHtml(id, value){ const el = document.getElementById(id); if (el) el.innerHTML = value; }

      function refreshSelectionLabelsOnly(){
  if (allProvinces.length){
    populateProvinces();
    selProvincieEl.value = state.provinceStatcode || "";
  } else {
    resetProvinceSelect(tr("loadingProvinces"));
  }

  if (state.provinceStatcode){
    const rows = allGemeenten
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
    const rows = visibleWijken
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
    const rows = visibleBuurten
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

      function openOverview(open){ overviewModal.classList.toggle("open", !!open); }
      overviewBtn.addEventListener("click", () => openOverview(true));
      overviewClose.addEventListener("click", () => openOverview(false));
      overviewModal.addEventListener("click", (e) => { if (e.target === overviewModal) openOverview(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") openOverview(false); });

      if (typeof maplibregl === "undefined"){
        console.error("MapLibre not available. CDN blocked or offline.");
        return;
      }

      const provinceByStatcode = new Map();
      const gemeenteByStatcode = new Map();
      const gmToProvinceStatcode = new Map();
      let currentBasemapMode = "brt";
      let currentBasemapOpacity = 0.5;
      let allProvinces = [], allGemeenten = [], allWijken = [], allBuurten = [];
      let visibleWijken = [], visibleBuurten = [];
      let resetToNationalView = () => {};
      let bagPopup = null;
      let bagFeatureRequestId = 0;
      const bagFeatureCache = new Map();
      let bagSummarySectionHtml = "";

      // Map visualization state - declared here (top-of-file) because
      // updateLegendContext reads `activeMapVisualization` during boot via
      // applyLanguageText, which would TDZ-throw if the let lived inside
      // the Map visualization section further down the file.
      let activeMapVisualization = null;
      const savedLayerPaint = new Map();

      function registrySummarySectionHtml(registryName, innerHtml){
        return `
          <div class="summaryMetricLabel" style="margin:0 0 8px 0;">${escapeHtml(registryName)}</div>
          ${innerHtml}
        `;
      }

      function updateDataSummaryCard(){
        if (!(bagSummaryCardEl && bagSummaryBodyEl)) return;

        // Panel is visible iff (any administrative area is selected) AND
        // (any BAG layer is ticked). Otherwise it is hidden entirely so
        // the map fills the full available width. No empty-state message
        // is rendered inside the panel.
        const anyAreaSelected = !!(state.provinceStatcode || state.gemeenteStatcode || state.wijkStatcode || state.buurtStatcode);
        const anyBagLayerActive = activeBagKeys().length > 0;
        const sections = [bagSummarySectionHtml].filter(Boolean);
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

      function updateReportButtonVisibility(){
        const btn = document.getElementById('reportDownloadBtn');
        if (!btn) return;
        const level = (typeof selectedAreaLevel === 'function') ? selectedAreaLevel() : '';
        const areaFeature = (typeof selectedAreaFeature === 'function') ? selectedAreaFeature() : null;
        const visible = (level === 'wijk' || level === 'buurt')
          && activeBagKeys().length > 0
          && !!areaFeature;
        btn.hidden = !visible;
        if (!visible){
          const errEl = document.getElementById('reportDownloadError');
          if (errEl){ errEl.hidden = true; errEl.textContent = ''; }
        }
      }

      async function generateReport(){
        const btn = document.getElementById('reportDownloadBtn');
        const errEl = document.getElementById('reportDownloadError');
        if (!btn) return;
        const level = (typeof selectedAreaLevel === 'function') ? selectedAreaLevel() : '';
        if (level !== 'wijk' && level !== 'buurt') return;
        const areaFeature = (typeof selectedAreaFeature === 'function') ? selectedAreaFeature() : null;
        if (!areaFeature){ return; }

        if (errEl){ errEl.hidden = true; errEl.textContent = ''; }
        btn.disabled = true;
        btn.classList.add('is-loading');
        btn.setAttribute('aria-busy', 'true');
        btn.title = tr('reportDownloadInProgress');

        const props = areaFeature.properties || {};
        const areaId = String(props._statcode || '').trim().toUpperCase();
        const areaName = String(props._statnaam || areaId || '').trim();

        const gmStatcode = state.gemeenteStatcode;
        const pvStatcode = state.provinceStatcode;
        const municipalityName = gmStatcode ? (gemeenteByStatcode.get(gmStatcode)?.properties?._statnaam || '') : '';
        const provinceName = pvStatcode ? (provinceByStatcode.get(pvStatcode)?.properties?._statnaam || '') : '';
        const bounds = geojsonBounds(areaFeature);
        const bbox = bounds
          ? [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]]
          : [];

        const body = {
          area_type: level,
          area_id: areaId,
          area_name: areaName,
          parent_municipality: municipalityName,
          parent_province: provinceName,
          layers: activeBagKeys(),
          language: getCurrentLang(),
          bbox,
        };

        try {
          const { blob, filename: serverFilename } = await postReportRequest(body);
          const today = new Date();
          const datePart = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
          const filename = serverFilename || `${(areaName || areaId || 'report').replace(/[^A-Za-z0-9_-]/g,'_')}_${datePart}.pdf`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (err){
          console.error('report generation failed', err);
          if (errEl){
            errEl.textContent = tr('reportDownloadFailed');
            errEl.hidden = false;
          }
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-loading');
          btn.removeAttribute('aria-busy');
          btn.title = tr('reportDownload');
        }
      }


      function retryAttemptMessage(label, attempt, totalAttempts, delayMs){
        return `${tr('summaryRetryingPrefix')}${label}. ${tr('summaryRetryAttemptPrefix')}${attempt}${tr('summaryRetryAttemptSeparator')}${totalAttempts}. ${tr('summaryRetryWaitPrefix')}${Math.ceil(delayMs / 1000)}${tr('summaryRetryWaitSuffix')}`;
      }

      function retryFailedMessage(labels){
        const text = Array.isArray(labels) ? labels.join(', ') : String(labels || '');
        return `${tr('summaryRetryFailedPrefix')}${text}.`;
      }

      function selectedAreaFeature(){
        if (state.buurtStatcode) return visibleBuurten.find(x => x.properties._statcode === state.buurtStatcode) || allBuurten.find(x => x.properties._statcode === state.buurtStatcode) || null;
        if (state.wijkStatcode) return visibleWijken.find(x => x.properties._statcode === state.wijkStatcode) || allWijken.find(x => x.properties._statcode === state.wijkStatcode) || null;
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

      const state = { provinceStatcode:"", gemeenteStatcode:"", gmCode:"", wijkStatcode:"", buurtStatcode:"", showGemeente:true, showWijk:true, showBuurt:true };
      const emptyFilter = ["==", ["get", "_statcode"], "__none__"];
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
        updateLegendContext,
        syncExpandedTitle,
        refreshSelectionLabelsOnly,
        getMutableRefs: () => ({ homeBtnEl, bmBtnEl, basemapPopoverEl, expandedChartKey: getExpandedChartKey() }),
        onLanguageChange: () => {
          refreshBagView().catch(err => console.warn("BAG refresh failed", err));
        },
      });
      updateDataSummaryCard();

      function municipalityCodeFromStatcode(statcode){ const m = String(statcode || "").trim().toUpperCase().match(/^(?:GM|WK|BU)(\d{4})/); return m ? m[1] : ""; }
      function normalizeGmCode(v){ const s = String(v ?? "").trim(); return !s ? "" : (s.startsWith("-") ? s : s.padStart(4, "0")); }
      function wijkBody(statcode){ const m = String(statcode || "").match(/WK(.+)/i); return m ? m[1] : ""; }
      function prettyName(props){ return String(props?.statnaam || props?.naam || props?.name || ""); }
      function prettyStatcode(props){ return String(props?.statcode || props?.code || ""); }
      
      
      function geojsonBounds(feature){
        let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
        function scanCoords(coords){ if (!coords) return; if (typeof coords[0] === "number" && typeof coords[1] === "number"){ const x = coords[0], y = coords[1]; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; return; } for (const c of coords) scanCoords(c); }
        function scanGeom(geom){ if (!geom) return; if (geom.type === "GeometryCollection"){ for (const g of (geom.geometries || [])) scanGeom(g); return; } scanCoords(geom.coordinates); }
        scanGeom(feature?.geometry); return isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
      }

      function firstLayerId(){ const layers = map.getStyle().layers || []; return layers.length ? layers[0].id : null; }
      function firstNonBackgroundLayerId(){ const layers = map.getStyle().layers || []; for (const lyr of layers){ if (lyr.type !== "background") return lyr.id; } return null; }
      function ensureWhiteBackground(){ const layers = map.getStyle().layers || []; const bg = layers.find(l => l.type === "background"); if (bg){ map.setPaintProperty(bg.id, "background-color", "#ffffff"); map.setPaintProperty(bg.id, "background-opacity", 1.0); } else { map.addLayer({ id:"bg-white", type:"background", paint:{"background-color":"#ffffff","background-opacity":1.0} }, firstLayerId() || undefined); } }
      function hideBrkMunicipalityLayers(){ for (const lyr of (map.getStyle().layers || [])){ if (lyr["source-layer"] === "gemeentegebied"){ try{ map.setLayoutProperty(lyr.id, "visibility", "none"); }catch(_){} } } }
      function brkLineLayerIds(sourceLayerName){ return (map.getStyle().layers || []).filter(lyr => lyr.type === "line" && lyr["source-layer"] === sourceLayerName).map(lyr => lyr.id); }
      function moveLayerIdsToFront(ids){ for (const id of ids){ if (map.getLayer(id)){ try{ map.moveLayer(id); }catch(_){ } } } }
      function enforceBoundaryStackOrder(){ const orderedGroups = [brkLineLayerIds("provinciegebied"), ["world-country-outline-halo", "world-country-outline"], brkLineLayerIds("landgebied"), ["cbs-provincie-selected"], ["cbs-gemeente-line", "cbs-gemeente-selected"], ["cbs-wijk-line", "cbs-wijk-selected"], ["cbs-buurt-line", "cbs-buurt-selected"], ["cbs-provincie-hit", "cbs-gemeente-hit", "cbs-wijk-hit", "cbs-buurt-hit"]]; for (const group of orderedGroups) moveLayerIdsToFront(group); }
      function outerRings(geom){ if (!geom) return []; if (geom.type === "Polygon") return [geom.coordinates?.[0]].filter(Boolean); if (geom.type === "MultiPolygon") return (geom.coordinates || []).map(p => p?.[0]).filter(Boolean); return []; }
      async function ensureBrtLayer(insertBeforeId){ if (!map.getSource("brt-raster")) map.addSource("brt-raster", { type:"raster", tiles:[BRT_TILES], tileSize:256, attribution:"© Kadaster / PDOK (BRT-A)" }); if (!map.getLayer("brt-raster")) map.addLayer({ id:"brt-raster", type:"raster", source:"brt-raster", paint:{ "raster-opacity": currentBasemapMode === "brt" ? currentBasemapOpacity : 0.0 } }, insertBeforeId || undefined); }
      function applyBasemapOpacity(){
        if (map.getLayer("brt-raster")) map.setPaintProperty("brt-raster", "raster-opacity", currentBasemapMode === "brt" ? currentBasemapOpacity : 0.0);
        if (map.getLayer("luchtfoto-raster")) map.setPaintProperty("luchtfoto-raster", "raster-opacity", currentBasemapMode === "luchtfoto" ? currentBasemapOpacity : 0.0);
      }
      function setBasemap(mode){ currentBasemapMode = mode; applyBasemapOpacity(); }
      async function discoverLuchtfotoTemplateFromCapabilities(){
        const r = await fetchWithTimeout(LUCHTFOTO_WMTS_CAPS, 12000); if (!r.ok) throw new Error("WMTS GetCapabilities failed: " + r.status); const xml = await r.text(); const doc = new DOMParser().parseFromString(xml, "text/xml"); const layers = Array.from(doc.getElementsByTagName("Layer"));
        const firstByTag = (el, names) => { for (const n of names){ const got = el.getElementsByTagName(n)[0]; if (got) return got; } return null; };
        const text = el => (el && (el.textContent || "").trim()) || ""; const layerIdentifier = layerEl => text(firstByTag(layerEl, ["ows:Identifier","Identifier"]));
        let chosen = layers.find(l => /actueel/i.test(layerIdentifier(l)) && /ortho25/i.test(layerIdentifier(l))) || layers.find(l => /actueel/i.test(layerIdentifier(l))); if (!chosen) throw new Error("No 'Actueel' layer found in WMTS capabilities");
        const layerId = layerIdentifier(chosen); const styleId = (Array.from(chosen.getElementsByTagName("Style")).map(s => text(firstByTag(s, ["ows:Identifier","Identifier"]))).filter(Boolean)[0]) || "default"; const tmsIds = Array.from(chosen.getElementsByTagName("TileMatrixSetLink")).map(x => text(firstByTag(x, ["TileMatrixSet"]))).filter(Boolean); const tmsId = tmsIds.find(x => /googlemapscompatible/i.test(x)) || tmsIds.find(x => /webmercator|3857/i.test(x)) || tmsIds[0];
        const tileRes = Array.from(chosen.getElementsByTagName("ResourceURL")).find(x => (x.getAttribute("resourceType") || "").toLowerCase() === "tile"); let template = tileRes ? (tileRes.getAttribute("template") || "") : ""; if (!template) throw new Error("WMTS capabilities: missing ResourceURL tile template");
        return template.replaceAll("{Layer}", layerId).replaceAll("{Style}", styleId).replaceAll("{TileMatrixSet}", tmsId).replaceAll("{TileMatrix}", "{z}").replaceAll("{TileRow}", "{y}").replaceAll("{TileCol}", "{x}");
      }
      function lonLatToTileXY(lon, lat, z){ const n = Math.pow(2, z), x = Math.floor((lon + 180) / 360 * n), latRad = lat * Math.PI / 180, y = Math.floor((1 - Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI) / 2 * n); return {x, y}; }
      async function pickWorkingLuchtfotoTemplate(){ const z = 9, {x, y} = lonLatToTileXY(5.3, 52.1, z); const candidates = ["https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/actueel_ortho25/default/GoogleMapsCompatible/{z}/{y}/{x}.jpeg", "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/actueel_ortho25/default/GoogleMapsCompatible/{z}/{x}/{y}.jpeg", "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/actueel_ortho25/default/EPSG:3857/{z}/{y}/{x}.jpeg", "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/actueel_ortho25/default/EPSG:3857/{z}/{x}/{y}.jpeg", "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/actueel_ortho25/default/GoogleMapsCompatible/{z}/{y}/{x}.png", "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/actueel_ortho25/default/GoogleMapsCompatible/{z}/{x}/{y}.png"]; for (const tpl of candidates){ try{ const r = await fetchWithTimeout(tpl.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)), 5000); if (r.ok) return tpl; }catch(_){} } return null; }
      async function ensureLuchtfotoLayer(){ if (map.getLayer("luchtfoto-raster")) return; let template = null; try{ template = await discoverLuchtfotoTemplateFromCapabilities(); }catch(err){ console.warn("Luchtfoto WMTS discovery failed, trying fallbacks:", err); } if (!template) template = await pickWorkingLuchtfotoTemplate(); if (!template) throw new Error("Could not resolve a working Luchtfoto template."); map.addSource("luchtfoto-raster", { type:"raster", tiles:[template], tileSize:256, attribution:"© Kadaster / PDOK (Luchtfoto RGB)" }); const before = map.getLayer("mask-outside-nl") ? "mask-outside-nl" : firstNonBackgroundLayerId() || undefined; map.addLayer({ id:"luchtfoto-raster", type:"raster", source:"luchtfoto-raster", paint:{ "raster-opacity": currentBasemapMode === "luchtfoto" ? currentBasemapOpacity : 0.0 } }, before); }
      async function addOutsideNlMask(beforeId){ if (map.getSource("outside-nl-mask")) return; const resp = await fetchWithTimeout(LAND_FEATURES_URL, 12000); if (!resp.ok) throw new Error("landgebied fetch failed: " + resp.status); const gj = await resp.json(); const feat = (gj.features && gj.features[0]) ? gj.features[0] : null; if (!feat?.geometry) throw new Error("No landgebied geometry returned"); const holes = outerRings(feat.geometry).map(ring => Array.isArray(ring) ? ring.slice().reverse() : ring).filter(ring => ring && ring.length >= 4); if (!holes.length) return; const worldRing = [[-180,-85.0511],[180,-85.0511],[180,85.0511],[-180,85.0511],[-180,-85.0511]]; map.addSource("outside-nl-mask", { type:"geojson", data:{ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[worldRing, ...holes] } } }); map.addLayer({ id:"mask-outside-nl", type:"fill", source:"outside-nl-mask", paint:{ "fill-color":"#ffffff", "fill-opacity":1.0 } }, beforeId || undefined); }
      async function addWorldCountryOutlines(beforeId){ if (map.getSource("world-countries")) return; const topo = await (await fetchWithTimeout(WORLD_TOPO, 12000)).json(); const countries = topojson.feature(topo, topo.objects.countries); map.addSource("world-countries", { type:"geojson", data:countries }); map.addLayer({ id:"world-country-outline-halo", type:"line", source:"world-countries", filter:["!=", ["id"], 528], maxzoom:7.50, layout:{ "line-join":"round", "line-cap":"round" }, paint:{ "line-color":"#8a8a8a", "line-opacity":0.85, "line-width":["interpolate",["linear"],["zoom"],0,0.9,5,1.4,10,2.1] } }, beforeId || undefined); map.addLayer({ id:"world-country-outline", type:"line", source:"world-countries", filter:["!=", ["id"], 528], maxzoom:6, layout:{ "line-join":"round", "line-cap":"round" }, paint:{ "line-color":"#4a4a4a", "line-opacity":0.95, "line-width":["interpolate",["linear"],["zoom"],0,0.35,5,0.6,10,1.0] } }, beforeId || undefined); }
      class HomeBasemapControl{ onAdd(map){ this.map = map; this._open = false; const container = document.createElement("div"); container.className = "maplibregl-ctrl maplibregl-ctrl-group customCtrl"; const homeBtn = document.createElement("button"); homeBtn.type = "button"; homeBtn.title = tr("homeTitle"); homeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`; homeBtn.addEventListener("click", (e)=>{ e.stopPropagation(); resetToNationalView(); map.fitBounds(NL_BOUNDS, { padding: NL_FIT_PADDING, duration: 600 }); }); const bmBtn = document.createElement("button"); bmBtn.type = "button"; bmBtn.title = tr("basemapTitle"); bmBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/><path d="M3 16l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity="0.75"/></svg>`; const pop = document.createElement("div"); pop.className = "bmPopover"; pop.innerHTML = `<div class="bmTitle">${tr("basemapHeader")}</div><label class="bmOption"><input type="radio" name="basemap" value="brt" checked /><span>${tr("basemapBrt")}</span></label><label class="bmOption"><input type="radio" name="basemap" value="luchtfoto" /><span>${tr("basemapLuchtfoto")}</span></label><label class="bmOption"><input type="radio" name="basemap" value="none" /><span>${tr("basemapNone")}</span></label><div class="bmDivider"></div><div class="bmSliderWrap"><div class="bmSliderHead"><span>${tr("transparency")}</span><span class="bmValue" id="bmOpacityValue">50%</span></div><input class="bmRange" id="bmOpacityRange" type="range" min="0" max="100" step="1" value="50" /></div>`; homeBtnEl = homeBtn; bmBtnEl = bmBtn; basemapPopoverEl = pop; const opacityRange = pop.querySelector("#bmOpacityRange"); const opacityValue = pop.querySelector("#bmOpacityValue"); const syncOpacityLabel = () => { if (opacityValue) opacityValue.textContent = `${Math.round(currentBasemapOpacity * 100)}%`; if (opacityRange) opacityRange.value = String(Math.round(currentBasemapOpacity * 100)); }; syncOpacityLabel(); const openPopover = open => { this._open = !!open; pop.classList.toggle("open", this._open); }; bmBtn.addEventListener("click", e => { e.stopPropagation(); openPopover(!this._open); }); pop.addEventListener("change", async e => { const t = e.target; if (!t) return; if (t.name === "basemap"){ const mode = pop.querySelector('input[name="basemap"]:checked')?.value || "brt"; if (mode === "luchtfoto"){ try{ await ensureLuchtfotoLayer(); } catch(err){ console.warn(err); pop.querySelector('input[value="brt"]').checked = true; } } setBasemap(pop.querySelector('input[name="basemap"]:checked')?.value || "brt"); } }); opacityRange?.addEventListener("input", e => { currentBasemapOpacity = Number(e.target.value || 50) / 100; syncOpacityLabel(); applyBasemapOpacity(); }); this._docClick = e => { if (!this._open) return; if (!container.contains(e.target)) openPopover(false); }; this._docKey = e => { if (e.key === "Escape") openPopover(false); }; document.addEventListener("click", this._docClick); document.addEventListener("keydown", this._docKey); container.appendChild(homeBtn); container.appendChild(bmBtn); container.appendChild(pop); this._container = container; return container; } onRemove(){ if (this._container?.parentNode) this._container.parentNode.removeChild(this._container); document.removeEventListener("click", this._docClick); document.removeEventListener("keydown", this._docKey); this.map = undefined; } }
      const map = new maplibregl.Map({ container: "map", style: PDOK_STYLE_URL, center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, bearing: DEFAULT_VIEW.bearing, pitch: DEFAULT_VIEW.pitch, attributionControl: true }); map.addControl(new HomeBasemapControl(), "top-left"); map.addControl(new maplibregl.NavigationControl(), "top-left");
      function addAdminSourcesAndLayers(){
        if (!map.getSource("cbs-provincie")) map.addSource("cbs-provincie", { type:"geojson", data:{type:"FeatureCollection", features:[]} });
        if (!map.getSource("cbs-gemeente")) map.addSource("cbs-gemeente", { type:"geojson", data:{type:"FeatureCollection", features:[]} });
        if (!map.getSource("cbs-wijk")) map.addSource("cbs-wijk", { type:"geojson", data:{type:"FeatureCollection", features:[]} });
        if (!map.getSource("cbs-buurt")) map.addSource("cbs-buurt", { type:"geojson", data:{type:"FeatureCollection", features:[]} });
        if (!map.getLayer("cbs-provincie-hit")) map.addLayer({ id:"cbs-provincie-hit", type:"fill", source:"cbs-provincie", paint:{ "fill-color":"#000000", "fill-opacity":0.0 } });
        if (!map.getLayer("cbs-provincie-selected")) map.addLayer({ id:"cbs-provincie-selected", type:"line", source:"cbs-provincie", filter: emptyFilter, paint:{ "line-color":"#be123c", "line-width":["interpolate", ["linear"], ["zoom"], 6, 1.8, 9, 2.8, 12, 4.0], "line-opacity":1.0 } });
        if (!map.getLayer("cbs-gemeente-hit")) map.addLayer({ id:"cbs-gemeente-hit", type:"fill", source:"cbs-gemeente", filter: emptyFilter, paint:{ "fill-color":"#000000", "fill-opacity":0.0 } });
        if (!map.getLayer("cbs-gemeente-line")) map.addLayer({ id:"cbs-gemeente-line", type:"line", source:"cbs-gemeente", filter: emptyFilter, paint:{ "line-color":"#111827", "line-width":["interpolate", ["linear"], ["zoom"], 6, 0.9, 9, 1.3, 12, 2.0], "line-opacity": 0.95 } });
        if (!map.getLayer("cbs-gemeente-selected")) map.addLayer({ id:"cbs-gemeente-selected", type:"line", source:"cbs-gemeente", filter: emptyFilter, paint:{ "line-color":"#0ea5e9", "line-width":["interpolate", ["linear"], ["zoom"], 6, 1.4, 9, 2.4, 12, 3.8], "line-opacity":1.0 } });
        if (!map.getLayer("cbs-wijk-hit")) map.addLayer({ id:"cbs-wijk-hit", type:"fill", source:"cbs-wijk", filter: emptyFilter, minzoom:9.5, paint:{ "fill-color":"#000000", "fill-opacity":0.0 } });
        if (!map.getLayer("cbs-wijk-line")) map.addLayer({ id:"cbs-wijk-line", type:"line", source:"cbs-wijk", filter: emptyFilter, minzoom:9.5, paint:{ "line-color":"#d97706", "line-width":["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 1.4, 15, 2.2], "line-opacity":0.9 } });
        if (!map.getLayer("cbs-wijk-selected")) map.addLayer({ id:"cbs-wijk-selected", type:"line", source:"cbs-wijk", filter: emptyFilter, minzoom:9.5, paint:{ "line-color":"#b45309", "line-width":["interpolate", ["linear"], ["zoom"], 9, 1.3, 12, 2.2, 15, 3.0], "line-opacity":1.0 } });
        if (!map.getLayer("cbs-buurt-hit")) map.addLayer({ id:"cbs-buurt-hit", type:"fill", source:"cbs-buurt", filter: emptyFilter, minzoom:11, paint:{ "fill-color":"#000000", "fill-opacity":0.0 } });
        if (!map.getLayer("cbs-buurt-line")) map.addLayer({ id:"cbs-buurt-line", type:"line", source:"cbs-buurt", filter: emptyFilter, minzoom:11, paint:{ "line-color":"#7c3aed", "line-width":["interpolate", ["linear"], ["zoom"], 11, 0.6, 14, 1.0, 16, 1.6], "line-opacity":0.9 } });
        if (!map.getLayer("cbs-buurt-selected")) map.addLayer({ id:"cbs-buurt-selected", type:"line", source:"cbs-buurt", filter: emptyFilter, minzoom:11, paint:{ "line-color":"#5b21b6", "line-width":["interpolate", ["linear"], ["zoom"], 11, 1.0, 14, 1.8, 16, 2.6], "line-opacity":1.0 } });
      }

      function escapeHtml(value){
        return String(value ?? '').replace(/[&<>"']/g, ch => (
          {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
        ));
      }

      function formatBagLabel(key){
        return String(key || '')
          .replace(/^_+/, '')
          .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
          .replace(/_/g, ' ')
          .split(' ')
          .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
          .join(' ');
      }

      function formatNumber(value){
        const n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString(tr('formatLocale')) : String(value ?? '');
      }

      function bagLevelLabel(level){
        if (level === 'province') return tr('bagSummaryProvince');
        if (level === 'municipality') return tr('bagSummaryMunicipality');
        if (level === 'wijk') return tr('bagSummaryWijk');
        if (level === 'buurt') return tr('bagSummaryBuurt');
        return '';
      }

      function activeBagKeys(){
        return ALL_BAG_KEYS.filter(key => !!bagToggleEls[key]?.checked);
      }

      function bagSourceId(key){
        return `bag-${key}-features`;
      }

      function bagLayerIdsForKey(key){
        const cfg = BAG_COLLECTIONS[key];
        if (!cfg) return [];
        return cfg.geometry === 'point'
          ? [`bag-${key}-circle`]
          : [`bag-${key}-fill`, `bag-${key}-line`];
      }

      function allBagRenderableLayerIds(){
        return ALL_BAG_KEYS.flatMap(key => bagLayerIdsForKey(key)).filter(id => map.getLayer(id));
      }

      function allDataRenderableLayerIds(){
        return allBagRenderableLayerIds();
      }

      function bagKeyFromLayerId(layerId){
        const m = String(layerId || '').match(/^bag-(.+?)-(fill|line|circle)$/);
        return m ? m[1] : '';
      }

      function setBagKeyData(key, fc){
        const source = map.getSource(bagSourceId(key));
        if (source) source.setData(fc || { type:'FeatureCollection', features: [] });
      }

      function setBagKeyVisibility(key, visible){
        for (const id of bagLayerIdsForKey(key)){
          if (map.getLayer(id)){
            map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
          }
        }
      }

      function clearAllBagLayers(){
        for (const key of ALL_BAG_KEYS){
          setBagKeyData(key, { type:'FeatureCollection', features: [] });
          setBagKeyVisibility(key, false);
        }
      }

      function ensureBagFeatureLayers(){
        for (const [key, cfg] of Object.entries(BAG_COLLECTIONS)){
          const sourceId = bagSourceId(key);
          if (!map.getSource(sourceId)){
            map.addSource(sourceId, {
              type:'geojson',
              data:{ type:'FeatureCollection', features: [] }
            });
          }

          if (cfg.geometry === 'point'){
            const layerId = `bag-${key}-circle`;
            if (!map.getLayer(layerId)){
              map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                layout: { visibility:'none' },
                paint: {
                  'circle-color': cfg.circle,
                  'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    8, cfg.radius - 1.0,
                    11, cfg.radius,
                    15, cfg.radius + 1.2
                  ],
                  'circle-stroke-color': '#ffffff',
                  'circle-stroke-width': 1.2,
                  'circle-opacity': 0.92
                }
              }, 'cbs-provincie-hit');
            }
          } else {
            const fillId = `bag-${key}-fill`;
            const lineId = `bag-${key}-line`;

            if (!map.getLayer(fillId)){
              map.addLayer({
                id: fillId,
                type:'fill',
                source: sourceId,
                layout:{ visibility:'none' },
                paint:{
                  'fill-color': cfg.fill,
                  'fill-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    7, Math.max(0.05, cfg.fillOpacity - 0.10),
                    10, Math.max(0.08, cfg.fillOpacity - 0.05),
                    13, cfg.fillOpacity,
                    16, Math.min(0.68, cfg.fillOpacity + 0.10)
                  ]
                }
              }, 'cbs-provincie-hit');
            }

            if (!map.getLayer(lineId)){
              map.addLayer({
                id: lineId,
                type:'line',
                source: sourceId,
                layout:{ visibility:'none' },
                paint:{
                  'line-color': cfg.line,
                  'line-opacity': 0.92,
                  'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    7, 0.35,
                    10, 0.65,
                    13, 1.0,
                    16, 1.5
                  ]
                }
              }, 'cbs-provincie-hit');
            }
          }
        }
      }

      function queryDataFeature(point){
        const layers = allDataRenderableLayerIds();
        if (!layers.length) return null;
        const feats = map.queryRenderedFeatures(point, { layers });
        return feats && feats.length ? feats[0] : null;
      }

      function renderUrlArrayHtml(arr){
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

      function popupValueHtml(value){
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

      function bagPopupHtml(feature){
        const props = feature?.properties || {};
        const bagKey = bagKeyFromLayerId(feature?.layer?.id);
        const cfg = BAG_COLLECTIONS[bagKey];
        const title = collectionPopupTitle(cfg) || tr('bagPopupDefaultTitle');
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

      function openBagPopup(feature, lngLat){
        closeBagPopup();
        bagPopup = new maplibregl.Popup({
          closeButton:true,
          closeOnClick:false,
          maxWidth:'360px'
        })
          .setLngLat(lngLat)
          .setHTML(bagPopupHtml(feature))
          .addTo(map);
      }

      function closeBagPopup(){
        if (bagPopup){
          bagPopup.remove();
          bagPopup = null;
        }
      }

      function renderBagSummaryMessage(message){
        bagSummarySectionHtml = registrySummarySectionHtml('BAG', `<div class="summaryNote">${escapeHtml(message)}</div>`);
        updateDataSummaryCard();
      }

      function renderBagLayerSummarySkeleton(level, activeKeys, showMap, statusMessage=''){
        const rows = activeKeys.slice(0, 5).map(() => `
          <div class="summarySkeletonRow">
            <span class="summarySkeletonBar" style="width:120px;"></span>
            <span class="summarySkeletonBar" style="width:52px;"></span>
          </div>
        `).join('');

        bagSummarySectionHtml = registrySummarySectionHtml('BAG', `
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
            // Backend has no count for this BAG type at the current
            // (province/municipality) level yet. Render the dash plus a
            // muted hint so the user knows where the data lives.
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

        bagSummarySectionHtml = registrySummarySectionHtml('BAG', `
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

      function bagCacheKey(key, level, statcode){
        return `${key}:${level}:${statcode}`;
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


      // Single source of truth: wipe the data summary panel and replace
      // every section with a skeleton placeholder. Called on both area
      // change and layer toggle so stale data never lingers on screen.
      function clearBagSummaryPanel(){
        const activeKeys = activeBagKeys();
        const level = currentBagAreaLevel();
        const showMap = level === 'wijk' || level === 'buurt';

        if (activeKeys.length){
          renderBagLayerSummarySkeleton(level, activeKeys, showMap);
        } else {
          bagSummarySectionHtml = '';
          updateDataSummaryCard();
        }

        // Chart skeletons for every active chart-eligible layer.
        renderBagCharts(new Set(activeKeys));

        const sourceLineEl = document.getElementById('bagChartSourceLine');
        if (sourceLineEl) sourceLineEl.style.display = 'none';
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
        updateLegendContext();
        renderBagCharts();
      }

      function deactivateMapVisualization(){
        if (!activeMapVisualization){
          updateVizButtons();
          updateVizLegend();
          updateLegendContext();
          return;
        }
        activeMapVisualization = null;
        restoreMapVisualization();
        updateVizButtons();
        updateVizLegend();
        updateLegendContext();
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
        updateLegendContext();
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
          bagSummarySectionHtml = '';
          updateBagLegend([], {}, false);
          updateDataSummaryCard();
          clearAllBagCharts();
          postBagRefreshSync();
          return;
        }

        const areaFeature = getCurrentBagAreaFeature();
        const level = currentBagAreaLevel();
        const showMap = level === 'wijk' || level === 'buurt';

        if (!areaFeature){
          clearAllBagLayers();
          updateBagLegend([], {}, false);
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
        updateBagLegend(activeKeys, countsByKey, showMap);
        renderBagLayerSummary(rows, areaFeature, level, partialKeys, showMap, failedKeys.length ? retryFailedMessage(failedKeys) : '');
        renderBagCharts();
        postBagRefreshSync();
      }


      function boundaryLayerVisible(kind){
        if (kind === 'gemeente') return state.showGemeente !== false;
        if (kind === 'wijk') return state.showWijk !== false;
        if (kind === 'buurt') return state.showBuurt !== false;
        return true;
      }
      function setBoundaryLayerVisible(kind, visible){
        if (kind === 'gemeente') state.showGemeente = !!visible;
        if (kind === 'wijk') state.showWijk = !!visible;
        if (kind === 'buurt') state.showBuurt = !!visible;
        updateBoundaryToggleButton(kind);
        applyBoundaryLayerVisibility();
      }
      function boundaryLayerConfig(kind){
        if (kind === 'gemeente'){
          return {
            buttonEl: toggleGemeenteLayerEl,
            legendRowEl: legendMunicipalityRowEl,
            layerIds: ['cbs-gemeente-line', 'cbs-gemeente-hit', 'cbs-gemeente-selected'],
            label: tr('labelGemeente')
          };
        }
        if (kind === 'wijk'){
          return {
            buttonEl: toggleWijkLayerEl,
            legendRowEl: legendWijkRowEl,
            layerIds: ['cbs-wijk-line', 'cbs-wijk-hit', 'cbs-wijk-selected'],
            label: tr('labelWijk')
          };
        }
        if (kind === 'buurt'){
          return {
            buttonEl: toggleBuurtLayerEl,
            legendRowEl: legendBuurtRowEl,
            layerIds: ['cbs-buurt-line', 'cbs-buurt-hit', 'cbs-buurt-selected'],
            label: tr('labelBuurt')
          };
        }
        return null;
      }
      function updateBoundaryToggleButton(kind){
        const cfg = boundaryLayerConfig(kind);
        const btn = cfg?.buttonEl;
        if (!btn || !cfg) return;
        const visible = boundaryLayerVisible(kind);
        btn.classList.toggle('is-hidden', !visible);
        btn.setAttribute('aria-pressed', visible ? 'true' : 'false');
        const action = visible ? tr('hideLayerSuffix') : tr('showLayerSuffix');
        const stateLabel = visible ? tr('visibleSuffix') : tr('hiddenSuffix');
        const title = `${cfg.label} ${action}`;
        btn.title = title;
        btn.setAttribute('aria-label', title);
        const sr = btn.querySelector('.srOnly');
        if (sr) sr.textContent = `${cfg.label} ${stateLabel}`;
      }
      function updateAllBoundaryToggleButtons(){
        updateBoundaryToggleButton('gemeente');
        updateBoundaryToggleButton('wijk');
        updateBoundaryToggleButton('buurt');
      }
      function applyBoundaryLayerVisibility(){
        for (const kind of ['gemeente', 'wijk', 'buurt']){
          const cfg = boundaryLayerConfig(kind);
          const visible = boundaryLayerVisible(kind);
          for (const id of (cfg?.layerIds || [])){
            if (map.getLayer(id)){
              try{ map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); }catch(_){}
            }
          }
        }
        updateLegendContext();
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
        const vizLegendVisible = !!activeMapVisualization;
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
      const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
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
      visibleWijken.find(f => f.properties?._statcode === state.wijkStatcode) ||
      allWijken.find(f => f.properties?._statcode === state.wijkStatcode);
      if (wf) segs.push({ level: 'wijk', name: prettyName(wf.properties) });
      }

      if (state.buurtStatcode){
     const bf =
      visibleBuurten.find(f => f.properties?._statcode === state.buurtStatcode) ||
      allBuurten.find(f => f.properties?._statcode === state.buurtStatcode);
      if (bf) segs.push({ level: 'buurt', name: prettyName(bf.properties) });
      }

      if (!segs.length){
        selInfoEl.innerHTML = '';
      } else {
        const sep = '<svg class="bcSep" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';
        const lastIdx = segs.length - 1;
        const html = segs.map((s, i) => {
          const text = escapeHtml(s.name);
          if (i === lastIdx){
            return `<span class="bcSeg bcSeg--current">${text}</span>`;
          }
          return `<button type="button" class="bcSeg" data-bc-level="${s.level}">${text}</button>`;
        }).join(sep);
        selInfoEl.innerHTML = html;
      }

      syncAreaFieldEmptyStates();
}
      function resetProvinceSelect(message=tr("loadingProvinces")){ selProvincieEl.innerHTML = `<option value="">${message}</option>`; selProvincieEl.disabled = true; }
      function resetMunicipalitySelect(message=tr("selectProvinceFirst")){ selGemeenteEl.innerHTML = `<option value="">${message}</option>`; selGemeenteEl.disabled = true; }
      function resetWijkSelect(message=tr("selectMunicipalityFirst")){ selWijkEl.innerHTML = `<option value="">${message}</option>`; selWijkEl.disabled = true; }
      function resetBuurtSelect(message=tr("selectWijkFirst")){ selBuurtEl.innerHTML = `<option value="">${message}</option>`; selBuurtEl.disabled = true; }
      function applyLayerFilters(){
        if (map.getLayer("cbs-provincie-selected")) map.setFilter("cbs-provincie-selected", state.provinceStatcode ? ["==", ["get", "_statcode"], state.provinceStatcode] : emptyFilter);
        const municipalityFilter = state.provinceStatcode ? ["==", ["get", "_pvstatcode"], state.provinceStatcode] : emptyFilter;
        if (map.getLayer("cbs-gemeente-line")) map.setFilter("cbs-gemeente-line", municipalityFilter);
        if (map.getLayer("cbs-gemeente-hit")) map.setFilter("cbs-gemeente-hit", municipalityFilter);
        if (map.getLayer("cbs-gemeente-selected")) map.setFilter("cbs-gemeente-selected", state.gemeenteStatcode ? ["==", ["get", "_statcode"], state.gemeenteStatcode] : emptyFilter);
        const wijkFilter = state.gmCode ? ["==", ["get", "_gmcode"], state.gmCode] : emptyFilter;
        if (map.getLayer("cbs-wijk-line")) map.setFilter("cbs-wijk-line", wijkFilter);
        if (map.getLayer("cbs-wijk-hit")) map.setFilter("cbs-wijk-hit", wijkFilter);
        if (map.getLayer("cbs-wijk-selected")) map.setFilter("cbs-wijk-selected", state.wijkStatcode ? ["==", ["get", "_statcode"], state.wijkStatcode] : emptyFilter);
        let buurtFilter = emptyFilter;
        if (state.gmCode && state.wijkStatcode){
          const body = wijkBody(state.wijkStatcode);
          buurtFilter = [
            "all",
            ["==", ["get", "_gmcode"], state.gmCode],
            ["==", ["slice", ["get", "_statcode"], 2, 2 + body.length], body]
          ];
        }
        if (map.getLayer("cbs-buurt-line")) map.setFilter("cbs-buurt-line", buurtFilter);
        if (map.getLayer("cbs-buurt-hit")) map.setFilter("cbs-buurt-hit", buurtFilter);
        if (map.getLayer("cbs-buurt-selected")) map.setFilter("cbs-buurt-selected", state.buurtStatcode ? ["==", ["get", "_statcode"], state.buurtStatcode] : emptyFilter);
        applyBoundaryLayerVisibility();
        refreshBagView().catch(err => console.warn("BAG refresh failed", err));
      }
      function fitToFeature(feature){ const b = geojsonBounds(feature); if (b) map.fitBounds(b, { padding: 70, duration: 800 }); }
      function populateProvinces(){ const opts = allProvinces.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam })).sort((a,b) => a.name.localeCompare(b.name, "nl")); selProvincieEl.innerHTML = `<option value="">${tr("selectProvince")}</option>`; for (const o of opts){ const opt = document.createElement("option"); opt.value = o.id; opt.textContent = `${o.name} (${o.id})`; selProvincieEl.appendChild(opt); } selProvincieEl.disabled = false; }
      async function populateMunicipalities(){
        if (!state.provinceStatcode){
          allGemeenten = [];
          gemeenteByStatcode.clear();
          gmToProvinceStatcode.clear();
          if (map.getSource("cbs-gemeente")) {
            map.getSource("cbs-gemeente").setData({ type:"FeatureCollection", features: [] });
          }
          resetMunicipalitySelect();
          return;
        }

        selGemeenteEl.innerHTML = `<option value="">${tr("labelGemeente")}…</option>`;
        selGemeenteEl.disabled = true;

        try{
          const fc = await fetchBackendJson(
            `/api/areas/municipalities?province_statcode=${encodeURIComponent(state.provinceStatcode)}`,
            30000
          );

          allGemeenten = fc?.features || [];
          gemeenteByStatcode.clear();
          gmToProvinceStatcode.clear();

          for (const f of allGemeenten){
            gemeenteByStatcode.set(f.properties._statcode, f);
            if (f.properties?._statcode && f.properties?._pvstatcode){
              gmToProvinceStatcode.set(f.properties._statcode, f.properties._pvstatcode);
            }
          }

          if (map.getSource("cbs-gemeente")) {
            map.getSource("cbs-gemeente").setData({
              type:"FeatureCollection",
              features: allGemeenten
            });
          }

          const rows = allGemeenten
            .map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
            .sort((a,b) => a.name.localeCompare(b.name, "nl"));

          if (!rows.length){
            resetMunicipalitySelect(tr("noMunicipalitiesFound"));
            return;
          }

          selGemeenteEl.innerHTML = `<option value="">${tr("allMunicipalities")}</option>`;
          for (const row of rows){
            const opt = document.createElement("option");
            opt.value = row.id;
            opt.textContent = `${row.name} (${row.id})`;
            selGemeenteEl.appendChild(opt);
          }
          selGemeenteEl.disabled = false;
        }catch(err){
          console.error("Failed to load municipalities from backend", err);
          allGemeenten = [];
          gemeenteByStatcode.clear();
          gmToProvinceStatcode.clear();
          if (map.getSource("cbs-gemeente")) {
            map.getSource("cbs-gemeente").setData({ type:"FeatureCollection", features: [] });
          }
          resetMunicipalitySelect(tr("loadFailedMunicipalities"));
        }
      }
      async function populateWijken(){
  if (!state.gmCode){
    visibleWijken = [];
    resetWijkSelect();
    if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] });
    return;
  }
  selWijkEl.innerHTML = `<option value="">${tr("loadingWijken")}</option>`;
  selWijkEl.disabled = true;
  try{
    const fc = await fetchBackendJson(`/api/areas/wijken?municipality_gmcode=${encodeURIComponent(state.gmCode)}`, 30000);
    visibleWijken = fc?.features || [];
    if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: visibleWijken });
    const rows = visibleWijken.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
      .sort((a,b) => a.name.localeCompare(b.name, "nl"));
    if (!rows.length){
      resetWijkSelect(tr("noWijkFound"));
      return;
    }
    selWijkEl.innerHTML = `<option value="">${tr("allWijken")}</option>`;
    for (const row of rows){
      const opt = document.createElement("option");
      opt.value = row.id;
      opt.textContent = `${row.name} (${row.id})`;
      selWijkEl.appendChild(opt);
    }
    selWijkEl.disabled = false;
  }catch(err){
    console.error("Failed to load wijken from backend", err);
    visibleWijken = [];
    if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] });
    resetWijkSelect(tr("loadFailedShort"));
  }
}
async function populateBuurten(){
  if (!state.gmCode || !state.wijkStatcode){
    visibleBuurten = [];
    resetBuurtSelect();
    if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] });
    return;
  }
  selBuurtEl.innerHTML = `<option value="">${tr("loadingBuurten")}</option>`;
  selBuurtEl.disabled = true;
  try{
    const params = new URLSearchParams({
      municipality_gmcode: state.gmCode,
      wijk_statcode: state.wijkStatcode
    });
    const fc = await fetchBackendJson(`/api/areas/buurten?${params.toString()}`, 30000);
    visibleBuurten = fc?.features || [];
    if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: visibleBuurten });
    const rows = visibleBuurten.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
      .sort((a,b) => a.name.localeCompare(b.name, "nl"));
    if (!rows.length){
      resetBuurtSelect(tr("noBuurtFound"));
      return;
    }
    selBuurtEl.innerHTML = `<option value="">${tr("allBuurten")}</option>`;
    for (const row of rows){
      const opt = document.createElement("option");
      opt.value = row.id;
      opt.textContent = `${row.name} (${row.id})`;
      selBuurtEl.appendChild(opt);
    }
    selBuurtEl.disabled = false;
  }catch(err){
    console.error("Failed to load buurten from backend", err);
    visibleBuurten = [];
    if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] });
    resetBuurtSelect(tr("loadFailedShort"));
  }
}
function clearBelowProvince(){ state.gemeenteStatcode = ""; state.gmCode = ""; state.wijkStatcode = ""; state.buurtStatcode = ""; selGemeenteEl.value = ""; selWijkEl.value = ""; selBuurtEl.value = ""; resetWijkSelect(); resetBuurtSelect(); }
      function clearBelowMunicipality(){ state.wijkStatcode = ""; state.buurtStatcode = ""; selWijkEl.value = ""; selBuurtEl.value = ""; resetBuurtSelect(); }
      function clearBelowWijk(){ state.buurtStatcode = ""; selBuurtEl.value = ""; }
      function selectProvince(statcode, doZoom=true){
        state.provinceStatcode = statcode || "";
        selProvincieEl.value = state.provinceStatcode;

        clearBelowProvince();

        allGemeenten = [];
        gemeenteByStatcode.clear();
        gmToProvinceStatcode.clear();
        visibleWijken = [];
        visibleBuurten = [];

        if (map.getSource("cbs-gemeente")) {
          map.getSource("cbs-gemeente").setData({ type:"FeatureCollection", features: [] });
        }
        if (map.getSource("cbs-wijk")) {
          map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] });
        }
        if (map.getSource("cbs-buurt")) {
          map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] });
        }

        applyLayerFilters();
        updateInfoBox();

        if (state.provinceStatcode){
          populateMunicipalities()
            .then(() => {
              applyLayerFilters();
              updateInfoBox();
            })
            .catch(err => console.warn("populateMunicipalities failed", err));
        } else {
          resetMunicipalitySelect();
        }

        if (doZoom && state.provinceStatcode){
          const f = provinceByStatcode.get(state.provinceStatcode);
          if (f) fitToFeature(f);
        }
      }
      function selectMunicipality(statcode, doZoom=true){ if (!statcode){ state.gemeenteStatcode = ""; state.gmCode = ""; clearBelowMunicipality(); selGemeenteEl.value = ""; visibleWijken = []; visibleBuurten = []; if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] }); if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] }); resetWijkSelect(); resetBuurtSelect(); applyLayerFilters(); updateInfoBox(); return; } const f = gemeenteByStatcode.get(statcode); if (!f) return; const pv = gmToProvinceStatcode.get(statcode) || ""; if (pv && state.provinceStatcode !== pv){ state.provinceStatcode = pv; selProvincieEl.value = pv; populateMunicipalities(); } state.gemeenteStatcode = statcode; state.gmCode = f.properties._gmcode; clearBelowMunicipality(); selGemeenteEl.value = statcode; visibleBuurten = []; if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] }); applyLayerFilters(); updateInfoBox(); populateWijken().then(() => { applyLayerFilters(); updateInfoBox(); }).catch(err => console.warn("populateWijken failed", err)); if (doZoom) fitToFeature(f); }
      function selectWijk(statcode, doZoom=true){ if (!statcode){ state.wijkStatcode = ""; clearBelowWijk(); selWijkEl.value = ""; visibleBuurten = []; if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] }); resetBuurtSelect(); applyLayerFilters(); updateInfoBox(); return; } state.wijkStatcode = statcode; clearBelowWijk(); selWijkEl.value = statcode; applyLayerFilters(); updateInfoBox(); populateBuurten().then(() => { applyLayerFilters(); updateInfoBox(); }).catch(err => console.warn("populateBuurten failed", err)); if (doZoom){ const f = visibleWijken.find(x => x.properties._statcode === statcode) || allWijken.find(x => x.properties._statcode === statcode); if (f) fitToFeature(f); } }
      function selectBuurt(statcode, doZoom=true){ state.buurtStatcode = statcode || ""; selBuurtEl.value = statcode || ""; applyLayerFilters(); updateInfoBox(); if (doZoom && statcode){ const f = visibleBuurten.find(x => x.properties._statcode === statcode) || allBuurten.find(x => x.properties._statcode === statcode); if (f) fitToFeature(f); } }
      function selectProvinceByFeature(feature, doZoom=true){ const statcode = feature?.properties?._statcode || prettyStatcode(feature?.properties); if (statcode) selectProvince(statcode, doZoom); }
      function selectMunicipalityByFeature(feature, doZoom=true){ const statcode = feature?.properties?._statcode || prettyStatcode(feature?.properties); if (statcode) selectMunicipality(statcode, doZoom); }
      function selectWijkByFeature(feature, doZoom=true){ const statcode = feature?.properties?._statcode || prettyStatcode(feature?.properties); const gmcode = feature?.properties?._gmcode || municipalityCodeFromStatcode(statcode); const gmStat = gmcode ? `GM${gmcode}` : ""; if (gmStat && gmStat !== state.gemeenteStatcode) selectMunicipality(gmStat, false); if (statcode) selectWijk(statcode, doZoom); }
      function selectBuurtByFeature(feature, doZoom=true){ const statcode = feature?.properties?._statcode || prettyStatcode(feature?.properties); const gmcode = feature?.properties?._gmcode || municipalityCodeFromStatcode(statcode); const gmStat = gmcode ? `GM${gmcode}` : ""; const wijkStat = statcode ? `WK${String(statcode).replace(/^BU/i, "").slice(0, 6)}` : ""; if (gmStat && gmStat !== state.gemeenteStatcode) selectMunicipality(gmStat, false); if (wijkStat && wijkStat !== state.wijkStatcode) selectWijk(wijkStat, false); if (statcode) selectBuurt(statcode, doZoom); }
      async function loadAdminData(){
        resetProvinceSelect();
        resetMunicipalitySelect();
        resetWijkSelect(tr("loadingWijken"));
        resetBuurtSelect(tr("loadingBuurten"));

        const p = await fetchBackendJson("/api/areas/provinces", 30000);

        allProvinces = p.features || [];
        allGemeenten = [];
        allWijken = [];
        allBuurten = [];
        visibleWijken = [];
        visibleBuurten = [];

        provinceByStatcode.clear();
        gemeenteByStatcode.clear();
        gmToProvinceStatcode.clear();

        for (const f of allProvinces){
          provinceByStatcode.set(f.properties._statcode, f);
        }

        map.getSource("cbs-provincie").setData(p);
        map.getSource("cbs-gemeente").setData({ type:"FeatureCollection", features: [] });
        map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] });
        map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] });

        populateProvinces();
        resetMunicipalitySelect();
        resetWijkSelect();
        resetBuurtSelect();
        applyLayerFilters();
        updateInfoBox();
      }
      function featureUnderPointer(point, layerId){ if (!map.getLayer(layerId)) return null; const feats = map.queryRenderedFeatures(point, { layers:[layerId] }); return feats && feats.length ? feats[0] : null; }
      map.on("load", async ()=>{ map.fitBounds(NL_BOUNDS, { padding: NL_FIT_PADDING, duration: 0, animate: false }); ensureWhiteBackground(); const beforeId = firstNonBackgroundLayerId(); try{ await ensureBrtLayer(beforeId); await addOutsideNlMask(beforeId); await addWorldCountryOutlines(beforeId); }catch(err){ console.warn(err); } setBasemap("brt"); hideBrkMunicipalityLayers(); addAdminSourcesAndLayers(); ensureBagFeatureLayers(); updateAllBoundaryToggleButtons(); applyBoundaryLayerVisibility(); enforceBoundaryStackOrder(); try{ await loadAdminData(); enforceBoundaryStackOrder(); }catch(err){ console.error(err); selProvincieEl.innerHTML = `<option value="">${tr("loadFailedProvinces")}</option>`; selGemeenteEl.innerHTML = `<option value="">${tr("loadFailedMunicipalities")}</option>`; resetWijkSelect(tr("loadFailedShort")); resetBuurtSelect(tr("loadFailedShort")); }
        resetToNationalView = () => { state.provinceStatcode = ""; state.gemeenteStatcode = ""; state.gmCode = ""; state.wijkStatcode = ""; state.buurtStatcode = ""; selProvincieEl.value = ""; selGemeenteEl.value = ""; selWijkEl.value = ""; selBuurtEl.value = ""; resetMunicipalitySelect(); resetWijkSelect(); resetBuurtSelect(); applyLayerFilters(); updateInfoBox(); closeBagPopup(); };
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
  
