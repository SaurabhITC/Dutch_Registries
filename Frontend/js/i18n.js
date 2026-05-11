// i18n module — owns the language state, the locales dictionary, the
// translation lookup, the DOM-text refresh, and the language switcher
// wiring. Host app injects DOM elements + side-effect callbacks via
// `initI18n({...})`.

const locales = {
  nl: {
    pageTitle: "Nederlands Basisregistratie Dashboard",
    appTitle: "Nederlands Basisregistratie Dashboard",
    languageLabel: "Taal",
    languageAriaLabel: "Taal",
    sideHead: "Bedieningspaneel",
    areaSelectionTitle: "Gebiedsselectie",
    labelProvincie: "Provincie",
    labelGemeente: "Gemeente",
    labelWijk: "Wijk",
    labelBuurt: "Buurt",
    areaHint: "Begin met een provincie. Selecteer daarna een gemeente, dan een wijk en daarna een buurt. Je kunt ook direct op zichtbare grenzen op de kaart klikken.",
    registriesTitle: "Registraties",
    bagAccordionTitle: "BAG",
    bagNamePand: "Pand",
    bagNameVerblijfsobject: "Verblijfsobject",
    bagNameAdres: "Adres",
    bagNameWoonplaats: "Woonplaats",
    bagNameStandplaats: "Standplaats",
    bagNameLigplaats: "Ligplaats",
    bagNameOpenbareRuimte: "Openbare ruimte",
    bagNameNummeraanduiding: "Nummeraanduiding",
    legendBag: "BAG objecten",
    bagPopupDefaultTitle: "Object",
    bagSummaryTitle: "Gegevenssamenvatting",
    bagSummaryBadge: "gegevens",
    bagSummaryChooseArea: "Kies een gebied en schakel BAG in.",
    bagSummaryNoSelection: "Kies eerst een provincie, gemeente, wijk of buurt.",
    bagSummaryLoading: "BAG-samenvatting laden…",
    bagSummaryUnavailable: "Geen resultaten beschikbaar voor deze selectie.",
    bagSummaryArea: "Gebied",
    bagSummaryLevel: "Niveau",
    bagSummaryProvince: "Provincie",
    bagSummaryMunicipality: "Gemeente",
    bagSummaryWijk: "Wijk",
    bagSummaryBuurt: "Buurt",
    bagSummaryPanden: "Panden",
    bagSummaryUse: "Gebruik",
    bagSummaryYearClasses: "Bouwjaarklassen",
    bagSummaryVerblijfsobjecten: "Totaal verblijfsobjecten",
    bagSummaryAvgVo: "Gemiddeld per pand",
    bagSummaryBouwjaar: "Bouwjaar",
    bagSummaryStatus: "Statusverdeling",
    bagSummaryGeconstateerd: "Geconstateerd",
    bagSummaryPartial: "Deze samenvatting is gedeeltelijk en kan onvolledig zijn.",
    bagSummaryUnknown: "onbekend",
    descBro: "Ondergrond / grondwatergebruik & onderzoeken",
    legendTitle: "Legenda",
    legendBoundaryGroup: "Grenzen",
    legendDataGroup: "Gegevenslagen",
    legendNational: "Nationale grens",
    legendProvince: "Provinciegrens",
    legendMunicipality: "Gemeentegrens (CBS)",
    legendWijk: "Wijkgrens (CBS)",
    legendBuurt: "Buurtgrens (CBS)",
    overviewBtnTitle: "Overzicht",
    overviewDialogLabel: "Overzichtsdialoog",
    overviewTitle: "Overzicht",
    overviewClose: "Sluiten",
    overviewIntro: "Dashboardprototype voor het verkennen van Nederlandse basisregistraties via administratieve selecties.",
    howToTitle: "Gebruik",
    howTo1: "Begin met het selecteren van een <b>provincie</b> in de lijst, of klik op een provincie op de kaart.",
    howTo2: "Na het selecteren van een provincie worden de gemeenten binnen die provincie beschikbaar.",
    howTo3: "Na het selecteren van een gemeente worden de wijken beschikbaar. Na het selecteren van een wijk worden de buurten beschikbaar.",
    howTo4: "Gebruik <b>Home</b> om terug te keren naar het nationale overzicht en de hiërarchie te wissen. Gebruik <b>Basiskaart</b> om de achtergrond te wisselen.",
    layersTitle: "Administratieve lagen",
    layers1: "Provincie-, gemeente-, wijk- en buurtgrenzen in deze versie worden geladen uit de CBS 2025-hiërarchie.",
    layers2: "Nationale en provinciale referentiegrenzen uit de PDOK/Kadaster-basisstijl blijven daaronder zichtbaar.",
    homeTitle: "Home (standaardweergave)",
    basemapTitle: "Basiskaart",
    basemapHeader: "Basiskaart",
    basemapBrt: "PDOK BRT Achtergrondkaart",
    basemapLuchtfoto: "PDOK Luchtfoto (Actueel)",
    basemapNone: "Geen basiskaart (wit)",
    transparency: "Transparantie",
    selectProvince: "- Selecteer een provincie -",
    allMunicipalities: "- Alle gemeenten in provincie -",
    allWijken: "- Alle wijken in gemeente -",
    allBuurten: "- Alle buurten in wijk -",
    loadingProvinces: "Provincies laden…",
    loadingWijken: "Wijken laden…",
    loadingBuurten: "Buurten laden…",
    selectProvinceFirst: "Selecteer eerst een provincie",
    selectMunicipalityFirst: "Selecteer eerst een gemeente",
    selectWijkFirst: "Selecteer eerst een wijk",
    noMunicipalitiesFound: "Geen gemeenten gevonden",
    noWijkFound: "Geen wijk gevonden",
    noBuurtFound: "Geen buurt gevonden",
    loadFailedProvinces: "Provincies laden mislukt",
    loadFailedMunicipalities: "Gemeenten laden mislukt",
    loadFailedShort: "Laden mislukt",
    infoProvince: "Provincie",
    infoMunicipality: "Gemeente",
    infoWijk: "Wijk",
    infoBuurt: "Buurt",
    showLayerSuffix: "tonen",
    hideLayerSuffix: "verbergen",
    visibleSuffix: "zichtbaar",
    hiddenSuffix: "verborgen",
    bagSummaryActiveBagLayers: "Actieve BAG-lagen",
    bagSummaryLoadedBagObjects: "Geladen BAG-objecten",
    bagSummaryMapAndSummaryLoading: "Kaartlaag en samenvatting laden…",
    bagSummaryOnlyLoading: "Samenvatting laden…",
    bagSummaryShownOnMap: "BAG wordt op de kaart getoond voor dit detailniveau.",
    bagSummaryOnlySummaryAtLevelPrefix: "Op ",
    bagSummaryOnlySummaryAtLevelSuffix: "niveau wordt alleen de samenvatting getoond.",
    summaryNoObjectsLoaded: "Geen objecten geladen.",
    partialLoadNotePrefix: "Let op: gedeeltelijk geladen voor ",
    summaryLoadFailed: "Laden mislukt.",
    summaryLoadFailedShort: "Laden mislukt",
    summaryRetryingPrefix: "Laden mislukt. Automatisch opnieuw proberen voor ",
    summaryRetryAttemptPrefix: "Poging ",
    summaryRetryAttemptSeparator: " van ",
    summaryRetryWaitPrefix: "Nieuwe poging over ",
    summaryRetryWaitSuffix: " sec.",
    summaryRetryFailedPrefix: "Automatisch opnieuw proberen is mislukt voor ",
    bagSummaryEmptyState: "Selecteer een gebied om gegevens te zien.",
    bagSummaryAvailableAtWijkBuurt: "Beschikbaar op wijk-/buurtniveau",
    bagSummaryLoadingStatic: "Gegevens laden, even geduld…",
    vizBtnInactive: "Toon op kaart",
    vizBtnActive: "Wordt op kaart getoond - klik om te stoppen",
    vizBtnDisabledHint: "Schakel de relevante BAG-laag in",
    vizLegendTitleBouwjaar: "Bouwjaar op kaart",
    vizLegendTitleGebruiksdoel: "Gebruiksdoel op kaart",
    vizLegendTitleOppervlakte: "Oppervlakte op kaart",
    vizLegendUnknown: "Onbekend",
    vizLegendNoData: "Geen gegevens",
    vizLegendOverige: "Overige",
    chartTitleBouwjaar: "Bouwjaar",
    chartTitleGebruiksdoel: "Gebruiksdoel",
    chartTitleOppervlakte: "Oppervlakte verblijfsobjecten",
    chartExpand: "Diagram vergroten",
    chartModalClose: "Sluiten",
    chartAxisCount: "Aantal",
    chartNoteSelectWijkBuurt: "Selecteer een wijk of buurt om grafieken te zien.",
    chartSourceLine: "Bron: Kadaster BAG OGC API v2 + CBS Wijk- en Buurtkaart",
    gebruiksdoelWoonfunctie: "Woonfunctie",
    gebruiksdoelWinkelfunctie: "Winkelfunctie",
    gebruiksdoelKantoorfunctie: "Kantoorfunctie",
    gebruiksdoelIndustriefunctie: "Industriefunctie",
    gebruiksdoelOnderwijsfunctie: "Onderwijsfunctie",
    gebruiksdoelGezondheidszorgfunctie: "Gezondheidszorgfunctie",
    gebruiksdoelSportfunctie: "Sportfunctie",
    gebruiksdoelLogiesfunctie: "Logiesfunctie",
    gebruiksdoelBijeenkomstfunctie: "Bijeenkomstfunctie",
    gebruiksdoelCelfunctie: "Celfunctie",
    gebruiksdoelOverigeGebruiksfunctie: "Overige gebruiksfunctie",
    reportDownload: "Rapport downloaden",
    reportDownloadInProgress: "Rapport wordt gegenereerd…",
    reportDownloadFailed: "Rapport genereren mislukt. Probeer het opnieuw.",
    formatLocale: "nl-NL"
  },
  en: {
    pageTitle: "Dutch Base Registries Dashboard",
    appTitle: "Dutch Base Registries Dashboard",
    languageLabel: "Language",
    languageAriaLabel: "Language",
    sideHead: "Control panel",
    areaSelectionTitle: "Area selection",
    labelProvincie: "Province",
    labelGemeente: "Municipality",
    labelWijk: "District",
    labelBuurt: "Neighborhood",
    areaHint: "Start with a province. Then select a municipality, then a district, and then a neighborhood. You can also click directly on visible boundaries on the map.",
    registriesTitle: "Registries",
    bagAccordionTitle: "BAG",
    bagNamePand: "Building",
    bagNameVerblijfsobject: "Residential unit",
    bagNameAdres: "Address",
    bagNameWoonplaats: "Place",
    bagNameStandplaats: "Standplace",
    bagNameLigplaats: "Mooring place",
    bagNameOpenbareRuimte: "Public space",
    bagNameNummeraanduiding: "Address number",
    legendBag: "BAG objects",
    bagPopupDefaultTitle: "Object",
    bagSummaryTitle: "Data summary",
    bagSummaryBadge: "data",
    bagSummaryChooseArea: "Choose an area and enable BAG.",
    bagSummaryNoSelection: "First choose a province, municipality, district, or neighborhood.",
    bagSummaryLoading: "Loading BAG summary…",
    bagSummaryUnavailable: "No results available for this selection.",
    bagSummaryArea: "Area",
    bagSummaryLevel: "Level",
    bagSummaryProvince: "Province",
    bagSummaryMunicipality: "Municipality",
    bagSummaryWijk: "District",
    bagSummaryBuurt: "Neighborhood",
    bagSummaryPanden: "Buildings",
    bagSummaryUse: "Use",
    bagSummaryYearClasses: "Construction year classes",
    bagSummaryVerblijfsobjecten: "Total residential units",
    bagSummaryAvgVo: "Average per building",
    bagSummaryBouwjaar: "Construction year",
    bagSummaryStatus: "Status distribution",
    bagSummaryGeconstateerd: "Observed",
    bagSummaryPartial: "This summary is partial and may be incomplete.",
    bagSummaryUnknown: "unknown",
    descBro: "Subsurface / groundwater use & investigations",
    legendTitle: "Legend",
    legendBoundaryGroup: "Boundaries",
    legendDataGroup: "Data layers",
    legendNational: "National boundary",
    legendProvince: "Province boundary",
    legendMunicipality: "Municipality boundary (CBS)",
    legendWijk: "District boundary (CBS)",
    legendBuurt: "Neighborhood boundary (CBS)",
    overviewBtnTitle: "Overview",
    overviewDialogLabel: "Overview dialog",
    overviewTitle: "Overview",
    overviewClose: "Close",
    overviewIntro: "Dashboard prototype for exploring Dutch base registries through administrative selections.",
    howToTitle: "How to use",
    howTo1: "Start by selecting a <b>province</b> from the list, or click a province on the map.",
    howTo2: "After selecting a province, the municipalities within that province become available.",
    howTo3: "After selecting a municipality, the districts become available. After selecting a district, the neighborhoods become available.",
    howTo4: "Use <b>Home</b> to return to the national overview and clear the hierarchy. Use <b>Basemap</b> to switch the background.",
    layersTitle: "Administrative layers",
    layers1: "Province, municipality, district, and neighborhood boundaries in this version are loaded from the CBS 2025 hierarchy.",
    layers2: "National and provincial reference boundaries from the PDOK/Kadaster base style remain visible underneath.",
    homeTitle: "Home (default view)",
    basemapTitle: "Basemap",
    basemapHeader: "Basemap",
    basemapBrt: "PDOK BRT background map",
    basemapLuchtfoto: "PDOK aerial imagery (current)",
    basemapNone: "No basemap (white)",
    transparency: "Transparency",
    selectProvince: "- Select a province -",
    allMunicipalities: "- All municipalities in province -",
    allWijken: "- All districts in municipality -",
    allBuurten: "- All neighborhoods in district -",
    loadingProvinces: "Loading provinces…",
    loadingWijken: "Loading districts…",
    loadingBuurten: "Loading neighborhoods…",
    selectProvinceFirst: "Select a province first",
    selectMunicipalityFirst: "Select a municipality first",
    selectWijkFirst: "Select a district first",
    noMunicipalitiesFound: "No municipalities found",
    noWijkFound: "No districts found",
    noBuurtFound: "No neighborhoods found",
    loadFailedProvinces: "Failed to load provinces",
    loadFailedMunicipalities: "Failed to load municipalities",
    loadFailedShort: "Loading failed",
    infoProvince: "Province",
    infoMunicipality: "Municipality",
    infoWijk: "District",
    infoBuurt: "Neighborhood",
    showLayerSuffix: "show",
    hideLayerSuffix: "hide",
    visibleSuffix: "visible",
    hiddenSuffix: "hidden",
    bagSummaryActiveBagLayers: "Active BAG layers",
    bagSummaryLoadedBagObjects: "Loaded BAG objects",
    bagSummaryMapAndSummaryLoading: "Loading map layer and summary…",
    bagSummaryOnlyLoading: "Loading summary…",
    bagSummaryShownOnMap: "BAG is shown on the map at this detail level.",
    bagSummaryOnlySummaryAtLevelPrefix: "At ",
    bagSummaryOnlySummaryAtLevelSuffix: " level only the summary is shown.",
    summaryNoObjectsLoaded: "No objects loaded.",
    partialLoadNotePrefix: "Note: partially loaded for ",
    bagSummaryEmptyState: "Select an area to see data.",
    bagSummaryAvailableAtWijkBuurt: "Available at wijk/buurt level",
    bagSummaryLoadingStatic: "Loading data, please wait…",
    vizBtnInactive: "Visualize on map",
    vizBtnActive: "Showing on map - click to stop",
    vizBtnDisabledHint: "Enable the relevant BAG layer first",
    vizLegendTitleBouwjaar: "Year of construction on map",
    vizLegendTitleGebruiksdoel: "Function / use on map",
    vizLegendTitleOppervlakte: "Surface area on map",
    vizLegendUnknown: "Unknown",
    vizLegendNoData: "No data",
    vizLegendOverige: "Other",
    chartTitleBouwjaar: "Year of construction",
    chartTitleGebruiksdoel: "Function / use",
    chartTitleOppervlakte: "Surface area of residential units",
    chartExpand: "Expand chart",
    chartModalClose: "Close",
    chartAxisCount: "Count",
    chartNoteSelectWijkBuurt: "Select a wijk or buurt to see charts.",
    chartSourceLine: "Source: Kadaster BAG OGC API v2 + CBS Wijk- en Buurtkaart",
    gebruiksdoelWoonfunctie: "Residential",
    gebruiksdoelWinkelfunctie: "Retail",
    gebruiksdoelKantoorfunctie: "Office",
    gebruiksdoelIndustriefunctie: "Industrial",
    gebruiksdoelOnderwijsfunctie: "Education",
    gebruiksdoelGezondheidszorgfunctie: "Healthcare",
    gebruiksdoelSportfunctie: "Sport",
    gebruiksdoelLogiesfunctie: "Lodging",
    gebruiksdoelBijeenkomstfunctie: "Assembly",
    gebruiksdoelCelfunctie: "Detention",
    gebruiksdoelOverigeGebruiksfunctie: "Other use",
    reportDownload: "Download report",
    reportDownloadInProgress: "Generating report…",
    reportDownloadFailed: "Report generation failed. Please try again.",
    formatLocale: "en-GB"
  }
};

let currentLang = (() => {
  try{
    const saved = localStorage.getItem('dashboardLang');
    return saved === 'en' ? 'en' : 'nl';
  }catch(_){
    return 'nl';
  }
})();

let _hooks = {};

export function tr(key){
  return locales[currentLang]?.[key] ?? locales.nl[key] ?? key;
}

export function getCurrentLang(){
  return currentLang;
}

function refreshBasemapPopoverTexts(){
  const basemapPopoverEl = _hooks.getMutableRefs?.().basemapPopoverEl;
  if (!basemapPopoverEl) return;
  const title = basemapPopoverEl.querySelector('.bmTitle');
  const labels = basemapPopoverEl.querySelectorAll('.bmOption span');
  const transLabel = basemapPopoverEl.querySelector('.bmSliderHead span');
  if (title) title.textContent = tr('basemapHeader');
  if (labels[0]) labels[0].textContent = tr('basemapBrt');
  if (labels[1]) labels[1].textContent = tr('basemapLuchtfoto');
  if (labels[2]) labels[2].textContent = tr('basemapNone');
  if (transLabel) transLabel.textContent = tr('transparency');
}

function applyLanguageText(){
  const { els = {}, setText, setHtml } = _hooks;
  const refs = _hooks.getMutableRefs?.() ?? {};
  const { languageButtonEl, languageValueEl, languageMenuEl, bagSummaryBodyEl, overviewModal, overviewBtn } = els;
  const { homeBtnEl, bmBtnEl, expandedChartKey } = refs;

  document.documentElement.lang = currentLang;
  document.title = tr('pageTitle');
  if (languageButtonEl) {
    languageButtonEl.setAttribute('aria-label', tr('languageAriaLabel'));
  }
  if (languageValueEl) {
    languageValueEl.textContent = currentLang.toUpperCase();
  }
  if (languageMenuEl) {
    for (const opt of languageMenuEl.querySelectorAll('[role="option"]')) {
      opt.setAttribute('aria-selected', opt.dataset.lang === currentLang ? 'true' : 'false');
    }
  }
  setText('appTitle', tr('appTitle'));
  setText('sideHeadText', tr('sideHead'));
  setText('areaSelectionTitle', tr('areaSelectionTitle'));
  setText('labelProvincie', tr('labelProvincie'));
  setText('labelGemeente', tr('labelGemeente'));
  setText('labelWijk', tr('labelWijk'));
  setText('labelBuurt', tr('labelBuurt'));
  _hooks.updateAllBoundaryToggleButtons?.();
  setText('areaHint', tr('areaHint'));
  setText('registriesTitle', tr('registriesTitle'));
  setText('bagAccordionTitle', tr('bagAccordionTitle'));
  setText('bagNamePand', tr('bagNamePand'));
  setText('bagNameVerblijfsobject', tr('bagNameVerblijfsobject'));
  setText('bagNameAdres', tr('bagNameAdres'));
  setText('bagNameWoonplaats', tr('bagNameWoonplaats'));
  setText('bagNameStandplaats', tr('bagNameStandplaats'));
  setText('bagNameLigplaats', tr('bagNameLigplaats'));
  setText('bagNameOpenbareRuimte', tr('bagNameOpenbareRuimte'));
  setText('bagNameNummeraanduiding', tr('bagNameNummeraanduiding'));
  setText('descBro', tr('descBro'));
  setText('legendTitleText', tr('legendTitle'));
  setText('legendBoundaryGroup', tr('legendBoundaryGroup'));
  setText('legendDataGroup', tr('legendDataGroup'));
  setText('legendNational', tr('legendNational'));
  setText('legendProvince', tr('legendProvince'));
  setText('legendMunicipality', tr('legendMunicipality'));
  setText('legendWijk', tr('legendWijk'));
  setText('legendBuurt', tr('legendBuurt'));
  setText('legendBag', tr('legendBag'));
  _hooks.updateLegendContext?.();
  setText('bagSummaryTitle', tr('bagSummaryTitle'));
  setText('bagSummaryBadge', tr('bagSummaryBadge'));
  const reportBtnEl = document.getElementById('reportDownloadBtn');
  if (reportBtnEl){
    reportBtnEl.setAttribute('aria-label', tr('reportDownload'));
    reportBtnEl.title = tr('reportDownload');
  }
  if (bagSummaryBodyEl && !bagSummaryBodyEl.dataset.dynamic) bagSummaryBodyEl.textContent = tr('bagSummaryChooseArea');
  overviewModal?.setAttribute('aria-label', tr('overviewDialogLabel'));
  if (overviewBtn) overviewBtn.title = tr('overviewBtnTitle');
  setText('overviewTitle', tr('overviewTitle'));
  setText('overviewClose', tr('overviewClose'));
  setText('overviewIntro', tr('overviewIntro'));
  setText('howToTitle', tr('howToTitle'));
  setHtml('howTo1', tr('howTo1'));
  setHtml('howTo2', tr('howTo2'));
  setHtml('howTo3', tr('howTo3'));
  setHtml('howTo4', tr('howTo4'));
  setText('layersTitle', tr('layersTitle'));
  setText('layers1', tr('layers1'));
  setText('layers2', tr('layers2'));
  if (homeBtnEl) homeBtnEl.title = tr('homeTitle');
  document.querySelectorAll('.chartExpandBtn').forEach(btn => {
    btn.setAttribute('aria-label', tr('chartExpand'));
    btn.title = tr('chartExpand');
  });
  const chartCloseEl = document.getElementById('chartExpandClose');
  if (chartCloseEl){
    chartCloseEl.setAttribute('aria-label', tr('chartModalClose'));
    chartCloseEl.title = tr('chartModalClose');
  }
  if (expandedChartKey){
    _hooks.syncExpandedTitle?.();
  }
  if (bmBtnEl) bmBtnEl.title = tr('basemapTitle');
  refreshBasemapPopoverTexts();
  _hooks.refreshSelectionLabelsOnly?.();
}

function setLanguage(lang){
  currentLang = locales[lang] ? lang : 'nl';
  try{ localStorage.setItem('dashboardLang', currentLang); }catch(_){}
  applyLanguageText();
  _hooks.onLanguageChange?.();
}

function wireLanguageSwitcher(){
  const { els = {} } = _hooks;
  const { languageButtonEl, languageMenuEl } = els;
  if (!(languageButtonEl && languageMenuEl)) return;

  const items = () => Array.from(languageMenuEl.querySelectorAll('[role="option"]'));
  const isOpen = () => languageButtonEl.getAttribute('aria-expanded') === 'true';

  const open = () => {
    languageButtonEl.setAttribute('aria-expanded', 'true');
    languageMenuEl.removeAttribute('hidden');
    const arr = items();
    const sel = arr.find(li => li.getAttribute('aria-selected') === 'true') || arr[0];
    sel?.focus();
  };
  const close = ({ restoreFocus = true } = {}) => {
    languageButtonEl.setAttribute('aria-expanded', 'false');
    languageMenuEl.setAttribute('hidden', '');
    if (restoreFocus) languageButtonEl.focus();
  };
  const select = (lang) => {
    if (!locales[lang]) return;
    setLanguage(lang);
    close();
  };
  const moveFocus = (delta) => {
    const arr = items();
    const idx = arr.indexOf(document.activeElement);
    const next = (idx === -1 ? 0 : (idx + delta + arr.length) % arr.length);
    arr[next]?.focus();
  };

  languageButtonEl.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen() ? close() : open();
  });
  languageButtonEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      if (!isOpen()) open();
    }
  });

  languageMenuEl.addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]');
    if (!li) return;
    e.stopPropagation();
    select(li.dataset.lang);
  });
  languageMenuEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown'){ e.preventDefault(); moveFocus(1); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); moveFocus(-1); }
    else if (e.key === 'Home'){ e.preventDefault(); items()[0]?.focus(); }
    else if (e.key === 'End'){ e.preventDefault(); items().slice(-1)[0]?.focus(); }
    else if (e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      const li = document.activeElement?.closest?.('[role="option"]');
      if (li) select(li.dataset.lang);
    }
    else if (e.key === 'Escape'){ e.preventDefault(); close(); }
    else if (e.key === 'Tab'){ close({ restoreFocus: false }); }
  });

  document.addEventListener('click', (e) => {
    if (!isOpen()) return;
    if (!languageButtonEl.contains(e.target) && !languageMenuEl.contains(e.target)){
      close({ restoreFocus: false });
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()){
      e.preventDefault();
      close();
    }
  });
}

export function initI18n(hooks){
  _hooks = hooks || {};
  applyLanguageText();
  wireLanguageSwitcher();
}
