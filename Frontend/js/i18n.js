// i18n module — owns the language state, the locales dictionary, the
// translation lookup, the DOM-text refresh, and the language switcher
// wiring. Host app injects DOM elements + side-effect callbacks via
// `initI18n({...})`.

const locales = {
  nl: {
    pageTitle: "Nederlands Basisregistratie Dashboard",
    appTitle: "Basisregistratie Dashboard",
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
    overviewIntro: "Het Basisregistratie Dashboard is een interactief instrument voor het verkennen van Nederlandse basisregistraties op verschillende bestuurlijke niveaus. Selecteer een gebied in Nederland - van provincie tot individuele buurt - en het dashboard haalt live data op van PDOK, visualiseert die op een kaart en vat deze samen in grafieken en tellingen. Ontwikkeld als Geonovum-stageopdracht aan de Universiteit Twente.",
    navTitle: "Navigeren op de kaart",
    navBody: "Het dashboard is georganiseerd rond de Nederlandse bestuurlijke hiërarchie: Provincie - Gemeente - Wijk - Buurt. Begin door op een provincie te klikken op de kaart of er een te selecteren in het dropdown-menu in het linker paneel. De kaart zoomt in en het gemeente-dropdown wordt beschikbaar. Blijf verder inzoomen - elke selectie zoomt de kaart verder en laadt de grenzen van het volgende niveau. Je kunt ook direct op een zichtbare grens op de kaart klikken en de dropdowns volgen automatisch. Het oogicoon naast elk dropdown verbergt of toont die grenslaag voor een overzichtelijker beeld.",
    bagTitle: "BAG-data verkennen",
    bagBody: "Zodra je wijk- of buurtniveau bereikt, worden de BAG-lagen (Basisregistraties Adressen en Gebouwen) actief. Vink een combinatie aan van de zes laagcheckboxen in het linker paneel: Pand (gebouwcontouren), Verblijfsobject (woon- en bedrijfsruimten), Adres (adrespunten), Woonplaats (plaatsnaamgrenzen), Standplaats (vaste standplaatsen) en Ligplaats (ligplaatsen voor boten). Elke actieve laag verschijnt op de kaart in een eigen kleur, weergegeven in de legenda linksonder. De gegevenssamenvatting rechts wordt bijgewerkt met het totale aantal objecten per type in het geselecteerde gebied.",
    chartsTitle: "Grafieken en rapporten",
    chartsBody: "Met actieve BAG-lagen toont de samenvatting drie grafieken: bouwjaarverdeling, gebruiksdoel en oppervlakteverdeling. Klik op het vergroot-icoon bij een grafiek om deze op volledig scherm te bekijken. Op wijk- of buurtniveau met minimaal een actieve laag verschijnt een downloadknop bovenaan de samenvatting. Een klik genereert een PDF-rapport voor het geselecteerde gebied met kaarten, tellingen en grafieken voor elke actieve laag. Het genereren duurt ongeveer 10-30 seconden.",
    controlsTitle: "Kaartbediening",
    controlsBody: "De Home-knop keert terug naar het nationale overzicht en wist de selectie. De Basiskaart-knop wisselt tussen de BRT-topografische kaart en luchtfoto - gebruik de transparantieschuifregelaar om ze te mengen. Met de schakelknoppen in de legenda verberg of toon je gemeente-, wijk- en buurtgrenzen afzonderlijk. Zoom met de plus- en minknoppen of het scrollwiel en versleep de kaart om te pannen.",
    langTitle: "Taal",
    langBody: "Wissel tussen NL en EN via de kiezer rechtsboven. Alle labels, dropdowns, grafieken en de samenvatting worden direct bijgewerkt.",
    dataTitle: "Data en prestaties",
    dataBody: "Bestuurlijke grenzen komen uit de CBS gebiedsindelingen 2025 via PDOK. BAG-objecten worden live opgehaald van de PDOK BAG OGC API v2 en gecached na de eerste keer laden - het eerste bezoek aan een nieuw gebied duurt 10-40 seconden, herhaalde bezoeken zijn direct. De basiskaart wordt geleverd door PDOK BRT achtergrondkaart en Kadaster luchtfoto.",
    futureTitle: "Toekomstige ontwikkeling",
    futureBody: "Integratie van BGT (Basisregistratie Grootschalige Topografie) en BRO (Basisregistratie Ondergrond) is gepland voor toekomstige ontwikkeling.",
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
    appTitle: "Base Registries Dashboard",
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
    overviewIntro: "Basisregistratie Dashboard is an interactive tool for exploring Dutch base registries across administrative boundaries. Select any area in the Netherlands - from province down to individual neighborhood - and the dashboard fetches live data from PDOK, visualises it on a map, and summarises it in charts and counts. Built as a Geonovum internship project at the University of Twente.",
    navTitle: "Navigating the map",
    navBody: "The dashboard is organised around the Dutch administrative hierarchy: Province - Municipality (Gemeente) - District (Wijk) - Neighborhood (Buurt). Start by clicking a province on the map or selecting one from the dropdown in the left panel. The map zooms in and the municipality dropdown becomes available. Keep drilling down - each selection zooms the map further and loads the next level boundaries. You can also click any visible boundary directly on the map and the dropdowns will follow automatically. The eye icon next to each dropdown hides or shows that boundary layer if you want a cleaner view.",
    bagTitle: "Exploring BAG data",
    bagBody: "Once you reach wijk or buurt level, the BAG (Basisregistraties Adressen en Gebouwen) layers become active. Tick any combination of the six layer checkboxes in the left panel: Pand (building footprints), Verblijfsobject (residential and commercial units), Adres (address points), Woonplaats (named place boundaries), Standplaats (permanent pitch locations), and Ligplaats (boat mooring locations). Each active layer appears on the map with its own color, shown in the legend at the bottom left. The summary card on the right updates to show the total count of each object type in the selected area.",
    chartsTitle: "Charts and reports",
    chartsBody: "With BAG layers active, the summary card shows three charts - construction year distribution (Bouwjaar), intended use (Gebruiksdoel), and floor area (Oppervlakte). Click the expand icon on any chart to view it full-screen. At wijk or buurt level with at least one layer active, a download button appears at the top of the summary card. Clicking it generates a PDF report for the selected area with maps, counts, and charts for every active layer. Report generation takes around 10-30 seconds.",
    controlsTitle: "Map controls",
    controlsBody: "The Home button resets to the national Netherlands view and clears the selection. The Basemap button switches between the BRT topographic map and aerial imagery - use the transparency slider to blend them. The boundary toggle buttons in the legend let you hide or show municipality, district, and neighborhood lines independently. Zoom with the plus and minus buttons or the scroll wheel, and pan by dragging.",
    langTitle: "Language",
    langBody: "Switch between NL and EN using the selector in the top right. All labels, dropdowns, charts, and the summary card update immediately.",
    dataTitle: "Data and performance",
    dataBody: "Administrative boundaries come from CBS gebiedsindelingen 2025 via PDOK. BAG objects are fetched live from the PDOK BAG OGC API v2 and cached after the first load - the first visit to any new area takes 10-40 seconds, repeat visits are instant. The basemap is served by PDOK BRT achtergrondkaart and Kadaster luchtfoto.",
    futureTitle: "Coming soon",
    futureBody: "BGT (Basisregistratie Grootschalige Topografie) and BRO (Basisregistratie Ondergrond) integration are planned for future development.",
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
  setText('navTitle', tr('navTitle'));
  setText('navBody', tr('navBody'));
  setText('bagTitle', tr('bagTitle'));
  setText('bagBody', tr('bagBody'));
  setText('chartsTitle', tr('chartsTitle'));
  setText('chartsBody', tr('chartsBody'));
  setText('controlsTitle', tr('controlsTitle'));
  setText('controlsBody', tr('controlsBody'));
  setText('langTitle', tr('langTitle'));
  setText('langBody', tr('langBody'));
  setText('dataTitle', tr('dataTitle'));
  setText('dataBody', tr('dataBody'));
  setText('futureTitle', tr('futureTitle'));
  setText('futureBody', tr('futureBody'));
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
