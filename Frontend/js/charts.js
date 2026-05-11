// BAG charts module. Owns the Chart.js instances, the inline-panel charts
// (bouwjaar / gebruiksdoel / oppervlakte), and the expanded-chart modal.
// Host (app.js) injects state-reading hooks via `initCharts({...})`.

import { tr } from './i18n.js';
import {
  BOUWJAAR_BUCKETS,
  GEBRUIKSDOEL_CATEGORIES,
  OPPERVLAKTE_BUCKETS,
} from './config.js';

let _hooks = {};

const bagChartInstances = new Map();

let expandedChartKey = null;
let expandedChartInstance = null;
let chartModalEscHandler = null;

const GEBRUIKSDOEL_TR_KEY = {
  'woonfunctie':              'gebruiksdoelWoonfunctie',
  'winkelfunctie':            'gebruiksdoelWinkelfunctie',
  'kantoorfunctie':           'gebruiksdoelKantoorfunctie',
  'industriefunctie':         'gebruiksdoelIndustriefunctie',
  'onderwijsfunctie':         'gebruiksdoelOnderwijsfunctie',
  'gezondheidszorgfunctie':   'gebruiksdoelGezondheidszorgfunctie',
  'sportfunctie':             'gebruiksdoelSportfunctie',
  'logiesfunctie':            'gebruiksdoelLogiesfunctie',
  'bijeenkomstfunctie':       'gebruiksdoelBijeenkomstfunctie',
  'celfunctie':               'gebruiksdoelCelfunctie',
  'overige gebruiksfunctie':  'gebruiksdoelOverigeGebruiksfunctie',
};

const MIN_FEATURES_FOR_CHART = 10;

const CHART_SKELETON_IDS = {
  chartBouwjaar: 'chartSkeletonBouwjaar',
  chartGebruiksdoel: 'chartSkeletonGebruiksdoel',
  chartOppervlakte: 'chartSkeletonOppervlakte',
};

function bagChartCssVar(name, fallback){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }catch(_){ return fallback; }
}

function destroyBagChart(canvasId){
  const inst = bagChartInstances.get(canvasId);
  if (inst){
    try{ inst.destroy(); }catch(_){ }
    bagChartInstances.delete(canvasId);
  }
}

function showChartSkeleton(canvasId){
  destroyBagChart(canvasId);
  const canvas = document.getElementById(canvasId);
  if (canvas) canvas.style.visibility = 'hidden';
  const skel = document.getElementById(CHART_SKELETON_IDS[canvasId]);
  if (skel) skel.style.display = '';
}

function hideChartSkeleton(canvasId){
  const canvas = document.getElementById(canvasId);
  if (canvas) canvas.style.visibility = '';
  const skel = document.getElementById(CHART_SKELETON_IDS[canvasId]);
  if (skel) skel.style.display = 'none';
}

function aggregateBouwjaar(features){
  const counts = BOUWJAAR_BUCKETS.map(() => 0);
  for (const f of features){
    const raw = f?.properties?.bouwjaar;
    const year = Number(raw);
    if (!Number.isFinite(year) || year < 1) continue;
    for (let i = 0; i < BOUWJAAR_BUCKETS.length; i++){
      const b = BOUWJAAR_BUCKETS[i];
      if (year >= b.min && year <= b.max){
        counts[i]++;
        break;
      }
    }
  }
  return { labels: BOUWJAAR_BUCKETS.map(b => b.label), counts };
}

function aggregateGebruiksdoel(features){
  const counts = Object.create(null);
  for (const c of GEBRUIKSDOEL_CATEGORIES) counts[c] = 0;
  for (const f of features){
    const raw = f?.properties?.gebruiksdoel;
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const tokens = raw.split(',');
    for (let i = 0; i < tokens.length; i++){
      const tok = tokens[i].trim().toLowerCase();
      if (!tok) continue;
      if (tok in counts) counts[tok]++;
    }
  }
  const entries = GEBRUIKSDOEL_CATEGORIES
    .map(c => ({ key: c, count: counts[c] }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.count - a.count);
  return entries;
}

function aggregateOppervlakte(features){
  const counts = OPPERVLAKTE_BUCKETS.map(() => 0);
  for (const f of features){
    const raw = f?.properties?.oppervlakte;
    const v = Number(raw);
    if (!Number.isFinite(v) || v <= 0) continue;
    for (let i = 0; i < OPPERVLAKTE_BUCKETS.length; i++){
      const b = OPPERVLAKTE_BUCKETS[i];
      if (v >= b.min && v < b.lt){
        counts[i]++;
        break;
      }
    }
  }
  return { labels: OPPERVLAKTE_BUCKETS.map(b => b.label), counts };
}

function timedAggregate(name, fn){
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const result = fn();
  const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const elapsed = t1 - t0;
  if (elapsed > 150) console.warn(`BAG chart aggregation (${name}) took ${elapsed.toFixed(0)}ms`);
  return result;
}

function setChartSectionVisible(sectionId, visible){
  const el = document.getElementById(sectionId);
  if (el) el.style.display = visible ? '' : 'none';
}

function setChartCanvasVisible(canvasId, visible){
  const el = document.getElementById(canvasId);
  if (!el) return;
  const wrap = el.parentElement;
  if (wrap) wrap.style.display = visible ? '' : 'none';
}

function setChartHeading(headingId, key){
  const el = document.getElementById(headingId);
  if (el) el.textContent = tr(key);
}

function setChartNote(noteId, text){
  const el = document.getElementById(noteId);
  if (!el) return;
  if (text){
    el.textContent = text;
    el.style.display = '';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

function commonChartOptions(){
  const muted = bagChartCssVar('--muted', 'rgba(15,23,42,0.62)');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const value = ctx.parsed?.y ?? ctx.parsed?.x ?? ctx.parsed;
            return `${tr('chartAxisCount')}: ${_hooks.formatNumber(value)}`;
          }
        }
      },
    },
    scales: {
      x: {
        ticks: { color: muted, font: { size: 10 } },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: muted, font: { size: 10 }, precision: 0 },
        grid: { color: 'rgba(15,23,42,0.06)' },
      },
    },
  };
}

function bouwjaarBarColors(labels){
  if (_hooks.getActiveMapVisualization() !== 'bouwjaar') return null;
  const palette = _hooks.getPalettes().bouwjaar;
  return labels.map(label => {
    if (label === '<1900') return palette.preBefore1900;
    const m = String(label).match(/^(\d{4})/);
    if (!m) return palette.preBefore1900;
    const start = Number(m[1]);
    if (start < 1945) return palette.band1900_1944;
    if (start < 1970) return palette.band1945_1969;
    if (start < 1990) return palette.band1970_1989;
    if (start < 2010) return palette.band1990_2009;
    return palette.band2010Plus;
  });
}

function gebruiksdoelBarColors(entries){
  if (_hooks.getActiveMapVisualization() !== 'gebruiksdoel') return null;
  const palette = _hooks.getPalettes().gebruiksdoel;
  return entries.map(e => palette[e.key] || palette.overige);
}

function oppervlakteBarColors(){
  if (_hooks.getActiveMapVisualization() !== 'oppervlakte') return null;
  const palette = _hooks.getPalettes().oppervlakte;
  return [
    palette.band_lt50,
    palette.band_50_75,
    palette.band_75_100,
    palette.band_100_150,
    palette.band_150_250,
    palette.band_250plus,
  ];
}

function renderBouwjaarChart(features){
  const sectionId = 'chartSectionBouwjaar';
  const canvasId = 'chartBouwjaar';
  const headingId = 'chartTitleBouwjaar';
  const noteId = 'chartNoteBouwjaar';
  setChartHeading(headingId, 'chartTitleBouwjaar');
  destroyBagChart(canvasId);
  hideChartSkeleton(canvasId);
  if (!features || features.length < MIN_FEATURES_FOR_CHART){
    setChartSectionVisible(sectionId, false);
    return false;
  }
  const { labels, counts } = timedAggregate('bouwjaar', () => aggregateBouwjaar(features));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0){
    setChartSectionVisible(sectionId, false);
    return false;
  }
  setChartSectionVisible(sectionId, true);
  setChartCanvasVisible(canvasId, true);
  setChartNote(noteId, '');
  if (typeof Chart === 'undefined') return false;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return false;
  const color = bagChartCssVar('--accent', '#0ea5e9');
  const barColors = bouwjaarBarColors(labels) || color;
  const opts = commonChartOptions();
  opts.scales.x.ticks.maxRotation = 60;
  opts.scales.x.ticks.minRotation = 60;
  opts.scales.x.ticks.autoSkip = false;
  const inst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: counts, backgroundColor: barColors, borderRadius: 3, maxBarThickness: 22 }],
    },
    options: opts,
  });
  bagChartInstances.set(canvasId, inst);
  return true;
}

function renderGebruiksdoelChart(features){
  const sectionId = 'chartSectionGebruiksdoel';
  const canvasId = 'chartGebruiksdoel';
  const headingId = 'chartTitleGebruiksdoel';
  const noteId = 'chartNoteGebruiksdoel';
  setChartHeading(headingId, 'chartTitleGebruiksdoel');
  destroyBagChart(canvasId);
  hideChartSkeleton(canvasId);
  if (!features || features.length < MIN_FEATURES_FOR_CHART){
    setChartSectionVisible(sectionId, false);
    return false;
  }
  const entries = timedAggregate('gebruiksdoel', () => aggregateGebruiksdoel(features));
  if (!entries.length){
    setChartSectionVisible(sectionId, false);
    return false;
  }
  setChartSectionVisible(sectionId, true);
  setChartCanvasVisible(canvasId, true);
  setChartNote(noteId, '');
  if (typeof Chart === 'undefined') return false;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return false;
  const color = bagChartCssVar('--accent', '#0ea5e9');
  const muted = bagChartCssVar('--muted', 'rgba(15,23,42,0.62)');
  const labels = entries.map(e => tr(GEBRUIKSDOEL_TR_KEY[e.key] || e.key));
  const counts = entries.map(e => e.count);
  const barColors = gebruiksdoelBarColors(entries) || color;
  const inst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: counts, backgroundColor: barColors, borderRadius: 3, maxBarThickness: 18 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${tr('chartAxisCount')}: ${_hooks.formatNumber(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: muted, font: { size: 10 }, precision: 0 },
          grid: { color: 'rgba(15,23,42,0.06)' },
        },
        y: {
          ticks: { color: muted, font: { size: 10 }, autoSkip: false },
          grid: { display: false },
        },
      },
    },
  });
  bagChartInstances.set(canvasId, inst);
  return true;
}

function renderOppervlakteChart(features){
  const sectionId = 'chartSectionOppervlakte';
  const canvasId = 'chartOppervlakte';
  const headingId = 'chartTitleOppervlakte';
  const noteId = 'chartNoteOppervlakte';
  setChartHeading(headingId, 'chartTitleOppervlakte');
  destroyBagChart(canvasId);
  hideChartSkeleton(canvasId);
  if (!features || features.length < MIN_FEATURES_FOR_CHART){
    setChartSectionVisible(sectionId, false);
    return false;
  }
  const { labels, counts } = timedAggregate('oppervlakte', () => aggregateOppervlakte(features));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0){
    setChartSectionVisible(sectionId, false);
    return false;
  }
  setChartSectionVisible(sectionId, true);
  setChartCanvasVisible(canvasId, true);
  setChartNote(noteId, '');
  if (typeof Chart === 'undefined') return false;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return false;
  const color = bagChartCssVar('--accent', '#0ea5e9');
  const barColors = oppervlakteBarColors() || color;
  const opts = commonChartOptions();
  opts.scales.x.ticks.autoSkip = false;
  const inst = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: counts, backgroundColor: barColors, borderRadius: 3, maxBarThickness: 36 }],
    },
    options: opts,
  });
  bagChartInstances.set(canvasId, inst);
  return true;
}

function showChartUnavailable(sectionId, canvasId, headingId, headingKey, noteId){
  destroyBagChart(canvasId);
  setChartHeading(headingId, headingKey);
  setChartSectionVisible(sectionId, true);
  setChartCanvasVisible(canvasId, false);
  setChartNote(noteId, tr('chartNoteSelectWijkBuurt'));
}

function hideChartSection(sectionId, canvasId){
  destroyBagChart(canvasId);
  setChartSectionVisible(sectionId, false);
}

function showChartSkeletonState(sectionId, canvasId, headingId, headingKey, noteId){
  setChartHeading(headingId, headingKey);
  setChartSectionVisible(sectionId, true);
  setChartCanvasVisible(canvasId, true);
  setChartNote(noteId, '');
  showChartSkeleton(canvasId);
}

export function renderBagCharts(loadingKeys = new Set()){
  const sourceLineEl = document.getElementById('bagChartSourceLine');
  const activeKeys = _hooks.getActiveBagKeys();
  const pandActive = activeKeys.includes('pand');
  const voActive = activeKeys.includes('verblijfsobject');
  const level = _hooks.getCurrentBagAreaLevel();
  const featureLevel = level === 'wijk' || level === 'buurt';
  const areaFeature = _hooks.getCurrentBagAreaFeature();
  const anyChartLayerActive = pandActive || voActive;

  if (!anyChartLayerActive || !areaFeature){
    hideChartSection('chartSectionBouwjaar', 'chartBouwjaar');
    hideChartSection('chartSectionGebruiksdoel', 'chartGebruiksdoel');
    hideChartSection('chartSectionOppervlakte', 'chartOppervlakte');
    if (sourceLineEl) sourceLineEl.style.display = 'none';
    return;
  }

  // Chart 1: bouwjaar from pand
  if (!pandActive){
    hideChartSection('chartSectionBouwjaar', 'chartBouwjaar');
  } else if (loadingKeys.has('pand')){
    showChartSkeletonState('chartSectionBouwjaar', 'chartBouwjaar', 'chartTitleBouwjaar', 'chartTitleBouwjaar', 'chartNoteBouwjaar');
  } else if (!featureLevel){
    hideChartSection('chartSectionBouwjaar', 'chartBouwjaar');
  } else {
    const pandFeatures = _hooks.getCachedBagFeatures('pand') || [];
    renderBouwjaarChart(pandFeatures);
  }

  // Chart 2: gebruiksdoel from VO (preferred) or pand fallback
  const chart2SourceLoading = voActive
    ? loadingKeys.has('verblijfsobject')
    : loadingKeys.has('pand');
  if (!pandActive && !voActive){
    hideChartSection('chartSectionGebruiksdoel', 'chartGebruiksdoel');
  } else if (chart2SourceLoading){
    showChartSkeletonState('chartSectionGebruiksdoel', 'chartGebruiksdoel', 'chartTitleGebruiksdoel', 'chartTitleGebruiksdoel', 'chartNoteGebruiksdoel');
  } else if (!featureLevel){
    hideChartSection('chartSectionGebruiksdoel', 'chartGebruiksdoel');
  } else {
    const sourceFeatures = voActive
      ? (_hooks.getCachedBagFeatures('verblijfsobject') || [])
      : (_hooks.getCachedBagFeatures('pand') || []);
    renderGebruiksdoelChart(sourceFeatures);
  }

  // Chart 3: oppervlakte from VO
  if (!voActive){
    hideChartSection('chartSectionOppervlakte', 'chartOppervlakte');
  } else if (loadingKeys.has('verblijfsobject')){
    showChartSkeletonState('chartSectionOppervlakte', 'chartOppervlakte', 'chartTitleOppervlakte', 'chartTitleOppervlakte', 'chartNoteOppervlakte');
  } else if (!featureLevel){
    hideChartSection('chartSectionOppervlakte', 'chartOppervlakte');
  } else {
    const voFeatures = _hooks.getCachedBagFeatures('verblijfsobject') || [];
    renderOppervlakteChart(voFeatures);
  }

  if (sourceLineEl){
    const anyChartSectionVisible = ['chartSectionBouwjaar', 'chartSectionGebruiksdoel', 'chartSectionOppervlakte']
      .some(id => {
        const el = document.getElementById(id);
        return el && el.style.display !== 'none';
      });
    if (anyChartSectionVisible){
      sourceLineEl.textContent = tr('chartSourceLine');
      sourceLineEl.style.display = '';
    } else {
      sourceLineEl.style.display = 'none';
    }
  }
}

export function clearAllBagCharts(){
  hideChartSection('chartSectionBouwjaar', 'chartBouwjaar');
  hideChartSection('chartSectionGebruiksdoel', 'chartGebruiksdoel');
  hideChartSection('chartSectionOppervlakte', 'chartOppervlakte');
  const sourceLineEl = document.getElementById('bagChartSourceLine');
  if (sourceLineEl) sourceLineEl.style.display = 'none';
}

// ---------- Expand-chart modal ----------
const CHART_KEY_TO_PANEL_CANVAS = {
  bouwjaar: 'chartBouwjaar',
  gebruiksdoel: 'chartGebruiksdoel',
  oppervlakte: 'chartOppervlakte',
};
const CHART_KEY_TO_TITLE_KEY = {
  bouwjaar: 'chartTitleBouwjaar',
  gebruiksdoel: 'chartTitleGebruiksdoel',
  oppervlakte: 'chartTitleOppervlakte',
};
const CHART_KEY_TO_PANEL_SKELETON = {
  bouwjaar: 'chartSkeletonBouwjaar',
  gebruiksdoel: 'chartSkeletonGebruiksdoel',
  oppervlakte: 'chartSkeletonOppervlakte',
};
const CHART_KEY_TO_SOURCE_BAG_KEY = {
  bouwjaar: () => 'pand',
  gebruiksdoel: () => _hooks.getActiveBagKeys().includes('verblijfsobject') ? 'verblijfsobject' : 'pand',
  oppervlakte: () => 'verblijfsobject',
};

function destroyExpandedChart(){
  if (expandedChartInstance){
    try{ expandedChartInstance.destroy(); }catch(_){}
    expandedChartInstance = null;
  }
}

function panelSkeletonVisible(key){
  const el = document.getElementById(CHART_KEY_TO_PANEL_SKELETON[key]);
  return !!(el && el.style.display !== 'none');
}

function buildExpandedBouwjaarConfig(features){
  const { labels, counts } = aggregateBouwjaar(features);
  if (counts.reduce((a, b) => a + b, 0) === 0) return null;
  const color = bagChartCssVar('--accent', '#0ea5e9');
  const barColors = bouwjaarBarColors(labels) || color;
  const opts = commonChartOptions();
  opts.scales.x.ticks.maxRotation = 60;
  opts.scales.x.ticks.minRotation = 60;
  opts.scales.x.ticks.autoSkip = false;
  opts.animation = { duration: 0 };
  return {
    type: 'bar',
    data: { labels, datasets: [{ data: counts, backgroundColor: barColors, borderRadius: 3, maxBarThickness: 60 }] },
    options: opts,
  };
}

function buildExpandedGebruiksdoelConfig(features){
  const entries = aggregateGebruiksdoel(features);
  if (!entries.length) return null;
  const color = bagChartCssVar('--accent', '#0ea5e9');
  const muted = bagChartCssVar('--muted', 'rgba(15,23,42,0.62)');
  const labels = entries.map(e => tr(GEBRUIKSDOEL_TR_KEY[e.key] || e.key));
  const counts = entries.map(e => e.count);
  const barColors = gebruiksdoelBarColors(entries) || color;
  return {
    type: 'bar',
    data: { labels, datasets: [{ data: counts, backgroundColor: barColors, borderRadius: 3, maxBarThickness: 36 }] },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${tr('chartAxisCount')}: ${_hooks.formatNumber(ctx.parsed.x)}` },
        },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: muted, font: { size: 11 }, precision: 0 }, grid: { color: 'rgba(15,23,42,0.06)' } },
        y: { ticks: { color: muted, font: { size: 11 }, autoSkip: false }, grid: { display: false } },
      },
    },
  };
}

function buildExpandedOppervlakteConfig(features){
  const { labels, counts } = aggregateOppervlakte(features);
  if (counts.reduce((a, b) => a + b, 0) === 0) return null;
  const color = bagChartCssVar('--accent', '#0ea5e9');
  const barColors = oppervlakteBarColors() || color;
  const opts = commonChartOptions();
  opts.scales.x.ticks.autoSkip = false;
  opts.animation = { duration: 0 };
  return {
    type: 'bar',
    data: { labels, datasets: [{ data: counts, backgroundColor: barColors, borderRadius: 3, maxBarThickness: 80 }] },
    options: opts,
  };
}

function buildExpandedConfig(key){
  const sourceKey = CHART_KEY_TO_SOURCE_BAG_KEY[key]?.();
  if (!sourceKey) return null;
  const features = _hooks.getCachedBagFeatures(sourceKey);
  if (!features || !features.length) return null;
  if (key === 'bouwjaar') return buildExpandedBouwjaarConfig(features);
  if (key === 'gebruiksdoel') return buildExpandedGebruiksdoelConfig(features);
  if (key === 'oppervlakte') return buildExpandedOppervlakteConfig(features);
  return null;
}

export function syncExpandedTitle(){
  const titleEl = document.getElementById('chartExpandTitle');
  if (titleEl && expandedChartKey){
    titleEl.textContent = tr(CHART_KEY_TO_TITLE_KEY[expandedChartKey]);
  }
}

function showExpandedSkeleton(show){
  const skel = document.getElementById('chartExpandSkeleton');
  const canvas = document.getElementById('chartExpandCanvas');
  if (skel) skel.style.display = show ? '' : 'none';
  if (canvas) canvas.style.visibility = show ? 'hidden' : '';
}

export function openChartModal(key){
  if (!CHART_KEY_TO_PANEL_CANVAS[key]) return;
  const modalEl = document.getElementById('chartExpandModal');
  const canvas = document.getElementById('chartExpandCanvas');
  if (!modalEl || !canvas) return;
  if (expandedChartKey && expandedChartKey !== key){
    destroyExpandedChart();
  }
  expandedChartKey = key;
  syncExpandedTitle();
  modalEl.classList.add('is-open');
  modalEl.setAttribute('aria-hidden', 'false');

  const renderInModal = () => {
    destroyExpandedChart();
    if (panelSkeletonVisible(key)){
      showExpandedSkeleton(true);
      return;
    }
    const cfg = buildExpandedConfig(key);
    if (!cfg){
      showExpandedSkeleton(true);
      return;
    }
    showExpandedSkeleton(false);
    if (typeof Chart === 'undefined') return;
    expandedChartInstance = new Chart(canvas.getContext('2d'), cfg);
  };

  // Defer one frame so the modal layout settles before Chart sizes itself.
  requestAnimationFrame(() => {
    if (expandedChartKey !== key) return;
    renderInModal();
  });

  if (!chartModalEscHandler){
    chartModalEscHandler = (e) => {
      if (e.key === 'Escape') closeChartModal();
    };
    document.addEventListener('keydown', chartModalEscHandler);
  }
}

export function closeChartModal(){
  const modalEl = document.getElementById('chartExpandModal');
  if (!modalEl || !modalEl.classList.contains('is-open')) {
    expandedChartKey = null;
    destroyExpandedChart();
    return;
  }
  destroyExpandedChart();
  modalEl.classList.remove('is-open');
  modalEl.setAttribute('aria-hidden', 'true');
  expandedChartKey = null;
  if (chartModalEscHandler){
    document.removeEventListener('keydown', chartModalEscHandler);
    chartModalEscHandler = null;
  }
}

export function refreshExpandedChartIfOpen(){
  if (!expandedChartKey) return;
  const modalEl = document.getElementById('chartExpandModal');
  if (!modalEl?.classList.contains('is-open')) return;
  const canvas = document.getElementById('chartExpandCanvas');
  if (!canvas) return;
  destroyExpandedChart();
  if (panelSkeletonVisible(expandedChartKey)){
    showExpandedSkeleton(true);
    return;
  }
  const cfg = buildExpandedConfig(expandedChartKey);
  if (!cfg){
    showExpandedSkeleton(true);
    return;
  }
  showExpandedSkeleton(false);
  if (typeof Chart === 'undefined') return;
  expandedChartInstance = new Chart(canvas.getContext('2d'), cfg);
}

export function getExpandedChartKey(){
  return expandedChartKey;
}

function wireChartEvents(){
  const chartModalEl = document.getElementById('chartExpandModal');
  const chartModalCloseEl = document.getElementById('chartExpandClose');
  chartModalCloseEl?.addEventListener('click', closeChartModal);
  chartModalEl?.addEventListener('click', (e) => {
    if (e.target === chartModalEl) closeChartModal();
  });
}

export function initCharts(hooks){
  _hooks = hooks || {};
  wireChartEvents();
}
