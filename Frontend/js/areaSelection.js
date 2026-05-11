// Frontend/js/areaSelection.js — province/municipality/wijk/buurt drill-down.
//
// The factory takes everything via `deps`. Notably it takes a single mutable
// `selectionState` object that contains the six rebindable arrays
// (allProvinces, allGemeenten, allWijken, allBuurten, visibleWijken,
// visibleBuurten). Routing all reads and writes through this object means
// the factory and the rest of app.js share a single source of truth and
// rebindings inside the factory are visible to outside consumers like
// selectedAreaFeature / updateInfoBox / refreshSelectionLabelsOnly.
//
// Indentation inside populateMunicipalities / populateWijken / populateBuurten
// / clearBelowProvince was irregular in the original IIFE; preserved here
// verbatim per the migration spec (pretty-printing was out of scope).

export function createAreaSelection(deps){
  const {
    map, tr, fetchBackendJson, state, selectionState,
    provinceByStatcode, gemeenteByStatcode, gmToProvinceStatcode,
    selProvincieEl, selGemeenteEl, selWijkEl, selBuurtEl,
    applyLayerFilters, legendController, fitToFeature,
    prettyStatcode, municipalityCodeFromStatcode,
  } = deps;

  function resetProvinceSelect(message=tr("loadingProvinces")){ selProvincieEl.innerHTML = `<option value="">${message}</option>`; selProvincieEl.disabled = true; }
  function resetMunicipalitySelect(message=tr("selectProvinceFirst")){ selGemeenteEl.innerHTML = `<option value="">${message}</option>`; selGemeenteEl.disabled = true; }
  function resetWijkSelect(message=tr("selectMunicipalityFirst")){ selWijkEl.innerHTML = `<option value="">${message}</option>`; selWijkEl.disabled = true; }
  function resetBuurtSelect(message=tr("selectWijkFirst")){ selBuurtEl.innerHTML = `<option value="">${message}</option>`; selBuurtEl.disabled = true; }

  function populateProvinces(){ const opts = selectionState.allProvinces.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam })).sort((a,b) => a.name.localeCompare(b.name, "nl")); selProvincieEl.innerHTML = `<option value="">${tr("selectProvince")}</option>`; for (const o of opts){ const opt = document.createElement("option"); opt.value = o.id; opt.textContent = `${o.name} (${o.id})`; selProvincieEl.appendChild(opt); } selProvincieEl.disabled = false; }

  async function populateMunicipalities(){
    if (!state.provinceStatcode){
      selectionState.allGemeenten = [];
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

      selectionState.allGemeenten = fc?.features || [];
      gemeenteByStatcode.clear();
      gmToProvinceStatcode.clear();

      for (const f of selectionState.allGemeenten){
        gemeenteByStatcode.set(f.properties._statcode, f);
        if (f.properties?._statcode && f.properties?._pvstatcode){
          gmToProvinceStatcode.set(f.properties._statcode, f.properties._pvstatcode);
        }
      }

      if (map.getSource("cbs-gemeente")) {
        map.getSource("cbs-gemeente").setData({
          type:"FeatureCollection",
          features: selectionState.allGemeenten
        });
      }

      const rows = selectionState.allGemeenten
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
      selectionState.allGemeenten = [];
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
    selectionState.visibleWijken = [];
    resetWijkSelect();
    if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] });
    return;
  }
  selWijkEl.innerHTML = `<option value="">${tr("loadingWijken")}</option>`;
  selWijkEl.disabled = true;
  try{
    const fc = await fetchBackendJson(`/api/areas/wijken?municipality_gmcode=${encodeURIComponent(state.gmCode)}`, 30000);
    selectionState.visibleWijken = fc?.features || [];
    if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: selectionState.visibleWijken });
    const rows = selectionState.visibleWijken.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
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
    selectionState.visibleWijken = [];
    if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] });
    resetWijkSelect(tr("loadFailedShort"));
  }
}
async function populateBuurten(){
  if (!state.gmCode || !state.wijkStatcode){
    selectionState.visibleBuurten = [];
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
    selectionState.visibleBuurten = fc?.features || [];
    if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: selectionState.visibleBuurten });
    const rows = selectionState.visibleBuurten.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam }))
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
    selectionState.visibleBuurten = [];
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

    selectionState.allGemeenten = [];
    gemeenteByStatcode.clear();
    gmToProvinceStatcode.clear();
    selectionState.visibleWijken = [];
    selectionState.visibleBuurten = [];

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
    legendController.updateInfoBox();

    if (state.provinceStatcode){
      populateMunicipalities()
        .then(() => {
          applyLayerFilters();
          legendController.updateInfoBox();
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

  function selectMunicipality(statcode, doZoom=true){ if (!statcode){ state.gemeenteStatcode = ""; state.gmCode = ""; clearBelowMunicipality(); selGemeenteEl.value = ""; selectionState.visibleWijken = []; selectionState.visibleBuurten = []; if (map.getSource("cbs-wijk")) map.getSource("cbs-wijk").setData({ type:"FeatureCollection", features: [] }); if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] }); resetWijkSelect(); resetBuurtSelect(); applyLayerFilters(); legendController.updateInfoBox(); return; } const f = gemeenteByStatcode.get(statcode); if (!f) return; const pv = gmToProvinceStatcode.get(statcode) || ""; if (pv && state.provinceStatcode !== pv){ state.provinceStatcode = pv; selProvincieEl.value = pv; populateMunicipalities(); } state.gemeenteStatcode = statcode; state.gmCode = f.properties._gmcode; clearBelowMunicipality(); selGemeenteEl.value = statcode; selectionState.visibleBuurten = []; if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] }); applyLayerFilters(); legendController.updateInfoBox(); populateWijken().then(() => { applyLayerFilters(); legendController.updateInfoBox(); }).catch(err => console.warn("populateWijken failed", err)); if (doZoom) fitToFeature(f); }
  function selectWijk(statcode, doZoom=true){ if (!statcode){ state.wijkStatcode = ""; clearBelowWijk(); selWijkEl.value = ""; selectionState.visibleBuurten = []; if (map.getSource("cbs-buurt")) map.getSource("cbs-buurt").setData({ type:"FeatureCollection", features: [] }); resetBuurtSelect(); applyLayerFilters(); legendController.updateInfoBox(); return; } state.wijkStatcode = statcode; clearBelowWijk(); selWijkEl.value = statcode; applyLayerFilters(); legendController.updateInfoBox(); populateBuurten().then(() => { applyLayerFilters(); legendController.updateInfoBox(); }).catch(err => console.warn("populateBuurten failed", err)); if (doZoom){ const f = selectionState.visibleWijken.find(x => x.properties._statcode === statcode) || selectionState.allWijken.find(x => x.properties._statcode === statcode); if (f) fitToFeature(f); } }
  function selectBuurt(statcode, doZoom=true){ state.buurtStatcode = statcode || ""; selBuurtEl.value = statcode || ""; applyLayerFilters(); legendController.updateInfoBox(); if (doZoom && statcode){ const f = selectionState.visibleBuurten.find(x => x.properties._statcode === statcode) || selectionState.allBuurten.find(x => x.properties._statcode === statcode); if (f) fitToFeature(f); } }

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

    selectionState.allProvinces = p.features || [];
    selectionState.allGemeenten = [];
    selectionState.allWijken = [];
    selectionState.allBuurten = [];
    selectionState.visibleWijken = [];
    selectionState.visibleBuurten = [];

    provinceByStatcode.clear();
    gemeenteByStatcode.clear();
    gmToProvinceStatcode.clear();

    for (const f of selectionState.allProvinces){
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
    legendController.updateInfoBox();
  }

  return {
    resetProvinceSelect, resetMunicipalitySelect, resetWijkSelect, resetBuurtSelect,
    populateProvinces, populateMunicipalities, populateWijken, populateBuurten,
    clearBelowProvince, clearBelowMunicipality, clearBelowWijk,
    selectProvince, selectMunicipality, selectWijk, selectBuurt,
    selectProvinceByFeature, selectMunicipalityByFeature, selectWijkByFeature, selectBuurtByFeature,
    loadAdminData,
  };
}
