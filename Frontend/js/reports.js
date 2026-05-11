// Frontend/js/reports.js — PDF report UI helpers.
//
// `buildReportRequestBody` and `triggerPdfDownload` are pure helpers — they
// take everything they need as parameters. The `createReportUi` factory
// captures a `deps` bundle from app.js and returns the two functions wired
// for the live page (button visibility + the click handler). No imports:
// i18n.tr, api.postReportRequest, getCurrentLang, and the state/Maps come
// in via deps so this module has no hidden coupling.

export function buildReportRequestBody(opts){
  const {
    areaFeature, level, state,
    gemeenteByStatcode, provinceByStatcode,
    activeBagKeys, getCurrentLang, geojsonBounds,
  } = opts;

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

  return {
    area_type: level,
    area_id: areaId,
    area_name: areaName,
    parent_municipality: municipalityName,
    parent_province: provinceName,
    layers: activeBagKeys(),
    language: getCurrentLang(),
    bbox,
  };
}

export function triggerPdfDownload({ blob, serverFilename, areaName, areaId }){
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
}

export function createReportUi(deps){
  const {
    tr, postReportRequest,
    selectedAreaLevel, selectedAreaFeature,
    activeBagKeys, state,
    gemeenteByStatcode, provinceByStatcode,
    getCurrentLang, geojsonBounds,
  } = deps;

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

    const body = buildReportRequestBody({
      areaFeature, level,
      state, gemeenteByStatcode, provinceByStatcode,
      activeBagKeys, getCurrentLang, geojsonBounds,
    });
    const areaId = body.area_id;
    const areaName = body.area_name;

    try {
      const { blob, filename: serverFilename } = await postReportRequest(body);
      triggerPdfDownload({ blob, serverFilename, areaName, areaId });
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

  return { updateReportButtonVisibility, generateReport };
}
