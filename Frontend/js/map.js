// Frontend/js/map.js — MapLibre instance, basemap controls, boundary stack.
//
// `createMap` owns the live MapLibre instance, the BRT / Luchtfoto basemap
// layers, the outside-NL mask, the world-country outline halo, the four
// CBS admin sources and their style layers, the boundary toggle plumbing,
// and the layer-filter / fit-bounds helpers. Everything else (BAG layers,
// area selection, legend / summary card, charts, popups) plugs in via the
// returned object and the two mutable containers — `resetController` and
// `basemapRefs` — that bridge late-bound state with the outer IIFE.
//
// maplibregl and topojson are globals (loaded by <script> tags); the
// module references them as bare names rather than importing.

import {
  DEFAULT_VIEW, NL_BOUNDS, NL_FIT_PADDING, PDOK_STYLE_URL,
  LAND_FEATURES_URL, BRT_TILES, LUCHTFOTO_WMTS_CAPS, WORLD_TOPO,
} from './config.js';

export function createMap(deps){
  const {
    tr, fetchWithTimeout, resetController, basemapRefs,
    state, selectionState,
    legendController, refreshBagView, wijkBody,
    toggleGemeenteLayerEl, toggleWijkLayerEl, toggleBuurtLayerEl,
    legendMunicipalityRowEl, legendWijkRowEl, legendBuurtRowEl,
  } = deps;

  let currentBasemapMode = "brt";
  let currentBasemapOpacity = 0.5;

  const emptyFilter = ["==", ["get", "_statcode"], "__none__"];

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
  class HomeBasemapControl{ onAdd(map){ this.map = map; this._open = false; const container = document.createElement("div"); container.className = "maplibregl-ctrl maplibregl-ctrl-group customCtrl"; const homeBtn = document.createElement("button"); homeBtn.type = "button"; homeBtn.title = tr("homeTitle"); homeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`; homeBtn.addEventListener("click", (e)=>{ e.stopPropagation(); resetController.resetToNationalView(); map.fitBounds(NL_BOUNDS, { padding: NL_FIT_PADDING, duration: 600 }); }); const bmBtn = document.createElement("button"); bmBtn.type = "button"; bmBtn.title = tr("basemapTitle"); bmBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/><path d="M3 16l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity="0.75"/></svg>`; const pop = document.createElement("div"); pop.className = "bmPopover"; pop.innerHTML = `<div class="bmTitle">${tr("basemapHeader")}</div><label class="bmOption"><input type="radio" name="basemap" value="brt" checked /><span>${tr("basemapBrt")}</span></label><label class="bmOption"><input type="radio" name="basemap" value="luchtfoto" /><span>${tr("basemapLuchtfoto")}</span></label><label class="bmOption"><input type="radio" name="basemap" value="none" /><span>${tr("basemapNone")}</span></label><div class="bmDivider"></div><div class="bmSliderWrap"><div class="bmSliderHead"><span>${tr("transparency")}</span><span class="bmValue" id="bmOpacityValue">50%</span></div><input class="bmRange" id="bmOpacityRange" type="range" min="0" max="100" step="1" value="50" /></div>`; basemapRefs.homeBtnEl = homeBtn; basemapRefs.bmBtnEl = bmBtn; basemapRefs.basemapPopoverEl = pop; const opacityRange = pop.querySelector("#bmOpacityRange"); const opacityValue = pop.querySelector("#bmOpacityValue"); const syncOpacityLabel = () => { if (opacityValue) opacityValue.textContent = `${Math.round(currentBasemapOpacity * 100)}%`; if (opacityRange) opacityRange.value = String(Math.round(currentBasemapOpacity * 100)); }; syncOpacityLabel(); const openPopover = open => { this._open = !!open; pop.classList.toggle("open", this._open); }; bmBtn.addEventListener("click", e => { e.stopPropagation(); openPopover(!this._open); }); pop.addEventListener("change", async e => { const t = e.target; if (!t) return; if (t.name === "basemap"){ const mode = pop.querySelector('input[name="basemap"]:checked')?.value || "brt"; if (mode === "luchtfoto"){ try{ await ensureLuchtfotoLayer(); } catch(err){ console.warn(err); pop.querySelector('input[value="brt"]').checked = true; } } setBasemap(pop.querySelector('input[name="basemap"]:checked')?.value || "brt"); } }); opacityRange?.addEventListener("input", e => { currentBasemapOpacity = Number(e.target.value || 50) / 100; syncOpacityLabel(); applyBasemapOpacity(); }); this._docClick = e => { if (!this._open) return; if (!container.contains(e.target)) openPopover(false); }; this._docKey = e => { if (e.key === "Escape") openPopover(false); }; document.addEventListener("click", this._docClick); document.addEventListener("keydown", this._docKey); container.appendChild(homeBtn); container.appendChild(bmBtn); container.appendChild(pop); this._container = container; return container; } onRemove(){ if (this._container?.parentNode) this._container.parentNode.removeChild(this._container); document.removeEventListener("click", this._docClick); document.removeEventListener("keydown", this._docKey); this.map = undefined; } }

  const map = new maplibregl.Map({ container: "map", style: PDOK_STYLE_URL, center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, bearing: DEFAULT_VIEW.bearing, pitch: DEFAULT_VIEW.pitch, attributionControl: true });
  map.addControl(new HomeBasemapControl(), "top-left");
  map.addControl(new maplibregl.NavigationControl(), "top-left");

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
    legendController.updateLegendContext();
  }

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
  function featureUnderPointer(point, layerId){ if (!map.getLayer(layerId)) return null; const feats = map.queryRenderedFeatures(point, { layers:[layerId] }); return feats && feats.length ? feats[0] : null; }

  return {
    map,
    geojsonBounds,
    firstNonBackgroundLayerId,
    ensureWhiteBackground,
    hideBrkMunicipalityLayers,
    enforceBoundaryStackOrder,
    setBasemap,
    addAdminSourcesAndLayers,
    ensureBrtLayer,
    ensureLuchtfotoLayer,
    addOutsideNlMask,
    addWorldCountryOutlines,
    setBoundaryLayerVisible,
    boundaryLayerVisible,
    updateAllBoundaryToggleButtons,
    applyBoundaryLayerVisibility,
    applyLayerFilters,
    fitToFeature,
    featureUnderPointer,
  };
}
