// Network / API layer. Pure HTTP plumbing — no DOM, no i18n strings,
// no app state. Takes inputs, returns promises.

import { AUTO_RETRY_DELAYS_MS, BACKEND_BASE_URL, BAG_COLLECTIONS } from './config.js';

function waitMs(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractFilename(contentDispositionHeader){
  if (!contentDispositionHeader) return null;
  const m = /filename="([^"]+)"/.exec(contentDispositionHeader);
  return (m && m[1]) || null;
}

export async function fetchWithTimeout(url, ms=7000, init = {}){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try{ return await fetch(url, { signal: ctrl.signal, ...init }); }
  finally { clearTimeout(t); }
}

export async function fetchBackendJson(path, ms=20000){
  const url = `${BACKEND_BASE_URL}${path}`;
  const response = await fetchWithTimeout(url, ms);
  if (!response.ok) throw new Error(`Backend request failed: ${url} (${response.status})`);
  return await response.json();
}

export async function runWithConcurrencyLimit(items, limit, worker){
  const results = new Array(items.length);
  if (!items.length) return results;
  let next = 0;
  const poolSize = Math.max(1, Math.min(limit, items.length));
  async function poolWorker(){
    while (true){
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const workers = [];
  for (let i = 0; i < poolSize; i++){
    workers.push(poolWorker());
  }
  await Promise.all(workers);
  return results;
}

export async function loadWithAutoRetry({ loadFn, onRetry, delaysMs = AUTO_RETRY_DELAYS_MS }){
  const totalAttempts = delaysMs.length + 1;
  let lastError = null;
  for (let i = 0; i < totalAttempts; i++){
    try{
      const data = await loadFn();
      return { ok: true, data, attempts: i + 1 };
    }catch(err){
      lastError = err;
      if (i >= delaysMs.length) break;
      const delayMs = delaysMs[i];
      if (typeof onRetry === 'function'){
        onRetry({ attempt: i + 2, totalAttempts, delayMs, error: err });
      }
      await waitMs(delayMs);
    }
  }
  return { ok: false, error: lastError, attempts: totalAttempts };
}

export async function loadBagFeaturesForArea(key, areaFeature, level){
  const cfg = BAG_COLLECTIONS[key];
  const statcode = String(areaFeature?.properties?._statcode || '').trim();

  if (!cfg || !statcode || !level) {
    return {
      type: 'FeatureCollection',
      features: [],
      _truncated: false,
      _summaryCount: 0
    };
  }

  const params = new URLSearchParams({ level, statcode });
  const fc = await fetchBackendJson(
    `/api/bag/${encodeURIComponent(key)}?${params.toString()}`,
    60000
  );

  const features = fc?.features || [];
  const summaryCount = Number.isFinite(fc?.count) ? fc.count : features.length;

  return {
    type: 'FeatureCollection',
    features,
    _truncated: !!fc?._truncated,
    _summaryCount: summaryCount
  };
}

export async function loadBagSummaryForArea(key, areaFeature, level){
  const cfg = BAG_COLLECTIONS[key];
  const statcode = String(areaFeature?.properties?._statcode || '').trim();
  if (!cfg || !statcode || !level) return { count: null };

  // Optimistic per-type request. The backend currently only exposes
  // /api/bag/pand/summary; other types return 404 today and will
  // start returning real counts when the summary store is extended.
  // 404 → null (caller renders the "Available at wijk/buurt level"
  // placeholder). 5xx and other transient errors are thrown so the
  // existing retry/skeleton path takes over.
  const params = new URLSearchParams({ level, statcode });
  const url = `${BACKEND_BASE_URL}/api/bag/${encodeURIComponent(key)}/summary?${params.toString()}`;
  let response;
  try {
    response = await fetchWithTimeout(url, 60000);
  } catch (err) {
    throw new Error(`Backend request failed: ${url} (network)`);
  }
  if (response.status === 404){
    return { count: null };
  }
  if (!response.ok){
    throw new Error(`Backend request failed: ${url} (${response.status})`);
  }
  const summary = await response.json();
  return { count: Number.isFinite(summary?.count) ? summary.count : null };
}

export async function postReportRequest(payload, { timeoutMs = 120000 } = {}){
  const response = await fetchWithTimeout(
    `${BACKEND_BASE_URL}/api/report/generate`,
    timeoutMs,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok){
    const errText = await response.text().catch(() => '');
    throw new Error(`Report request failed: ${response.status} ${errText}`);
  }
  return {
    blob: await response.blob(),
    filename: extractFilename(response.headers.get('Content-Disposition')),
  };
}
