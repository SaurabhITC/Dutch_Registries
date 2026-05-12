// Frontend/js/bagLayers.js — BAG map-source/layer infrastructure.
//
// The `createBagLayers` factory takes the live MapLibre `map`, the
// `bagToggleEls` checkbox-map, and the `tr` translator from app.js. It
// returns a bundle of helpers that own everything to do with the BAG
// per-layer GeoJSON sources, style layers, visibility, and the small
// id/label utilities that hang off them. The factory keeps all helpers
// as nested function declarations so they can reference one another
// freely without `this.` plumbing.

import { ALL_BAG_KEYS, BAG_COLLECTIONS } from './config.js';

export function createBagLayers({ map, bagToggleEls, tr }){
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

  // Apply a MapLibre filter to the pand layers so only features whose
  // 'status' is in `allowedStatuses` are drawn. Pass null to remove the
  // filter entirely (show everything). Other BAG layers are untouched —
  // status semantics differ across BAG object types (VBO statuses use
  // 'Verblijfsobject in gebruik' etc.) so this filter is pand-specific.
  function setPandStatusFilter(allowedStatuses){
    const layerIds = bagLayerIdsForKey('pand');
    for (const id of layerIds){
      if (!map.getLayer(id)) continue;
      if (allowedStatuses === null){
        map.setFilter(id, null);
        continue;
      }
      // MapLibre 'in' expression: ['in', value, ['literal', array]]
      // Returns true when the feature's status is in the allowed list.
      // Features with missing status fall through to ['has', 'status']
      // being false → we explicitly include them when in_use is allowed
      // (treat unknown as in_use, matching config.js comment).
      map.setFilter(id, [
        'any',
        ['in', ['get', 'status'], ['literal', allowedStatuses]],
        ['!', ['has', 'status']],
      ]);
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

  function bagCacheKey(key, level, statcode){
    return `${key}:${level}:${statcode}`;
  }

  return {
    activeBagKeys,
    bagSourceId,
    bagLayerIdsForKey,
    allBagRenderableLayerIds,
    allDataRenderableLayerIds,
    bagKeyFromLayerId,
    setBagKeyData,
    setBagKeyVisibility,
    setPandStatusFilter,
    clearAllBagLayers,
    ensureBagFeatureLayers,
    bagCacheKey,
    bagLevelLabel,
  };
}
