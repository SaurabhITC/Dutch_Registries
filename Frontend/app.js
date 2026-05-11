// Frontend application logic for the split frontend/backend dashboard.
// Administrative hierarchy and BAG data are loaded from the backend endpoints.
// External PDOK services are used directly only for basemap rendering.

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

      function tr(key){
        return locales[currentLang]?.[key] ?? locales.nl[key] ?? key;
      }

      function collectionLabel(cfg){
        if (!cfg) return '';
        if (typeof cfg.label === 'string') return cfg.label;
        return cfg.label?.[currentLang] || cfg.label?.nl || '';
      }

      function collectionPopupTitle(cfg){
        if (!cfg) return '';
        if (typeof cfg.popupTitle === 'string') return cfg.popupTitle;
        return cfg.popupTitle?.[currentLang] || cfg.popupTitle?.nl || '';
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

      function refreshBasemapPopoverTexts(){
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
        updateAllBoundaryToggleButtons();
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
        updateLegendContext();
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
          syncExpandedTitle();
        }
        if (bmBtnEl) bmBtnEl.title = tr('basemapTitle');
        refreshBasemapPopoverTexts();
        refreshSelectionLabelsOnly();
      }

      function setLanguage(lang){
        currentLang = locales[lang] ? lang : 'nl';
        try{ localStorage.setItem('dashboardLang', currentLang); }catch(_){}
        applyLanguageText();
        refreshBagView().catch(err => console.warn("BAG refresh failed", err));
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

      const DEFAULT_VIEW = { center: [5.3, 52.1], zoom: 6.5, bearing: 0, pitch: 0 };
      const NL_BOUNDS = [[3.31, 50.75], [7.23, 53.55]];
      const NL_FIT_PADDING = { top: 40, bottom: 40, left: 40, right: 60 };
      const BACKEND_BASE_URL = "";

      const PDOK_STYLE_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/styles/bestuurlijkegebieden_standaardvisualisatie__webmercatorquad?f=json";
      const LAND_FEATURES_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/landgebied/items?f=json&limit=10";
      const BRT_TILES = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png";
      const LUCHTFOTO_WMTS_CAPS = "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?request=GetCapabilities&service=WMTS";
      const WORLD_TOPO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
      const BAG_COLLECTIONS = {
        pand: {
          label: { nl:"Pand", en:"Building" },
          popupTitle: { nl:"BAG pand", en:"BAG building" },
          geometry: "polygon",
          fill: "#d9c4a6",
          line: "#8b5e3c",
          fillOpacity: 0.42
        },
        verblijfsobject: {
          label: { nl:"Verblijfsobject", en:"Residential unit" },
          popupTitle: { nl:"BAG verblijfsobject", en:"BAG residential unit" },
          geometry: "point",
          circle: "#0ea5e9",
          radius: 4.8
        },
        adres: {
          label: { nl:"Adres", en:"Address" },
          popupTitle: { nl:"BAG adres", en:"BAG address" },
          geometry: "point",
          circle: "#f97316",
          radius: 4.2
        },
        woonplaats: {
          label: { nl:"Woonplaats", en:"Place" },
          popupTitle: { nl:"BAG woonplaats", en:"BAG place" },
          geometry: "polygon",
          fill: "#bbf7d0",
          line: "#16a34a",
          fillOpacity: 0.10
        },
        standplaats: {
          label: { nl:"Standplaats", en:"Standplace" },
          popupTitle: { nl:"BAG standplaats", en:"BAG standplace" },
          geometry: "polygon",
          fill: "#fde68a",
          line: "#d97706",
          fillOpacity: 0.34
        },
        ligplaats: {
          label: { nl:"Ligplaats", en:"Mooring place" },
          popupTitle: { nl:"BAG ligplaats", en:"BAG mooring place" },
          geometry: "polygon",
          fill: "#c7d2fe",
          line: "#4f46e5",
          fillOpacity: 0.34
        }
      };
      const ALL_BAG_KEYS = Object.keys(BAG_COLLECTIONS);
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
      const AUTO_RETRY_DELAYS_MS = [1500, 4000, 8000];
      const BAG_FETCH_CONCURRENCY = 3;

      async function runWithConcurrencyLimit(items, limit, worker){
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

      // Map visualization state - declared here (top-of-file) because
      // updateLegendContext reads `activeMapVisualization` during boot via
      // applyLanguageText, which would TDZ-throw if the let lived inside
      // the Map visualization section further down the file.
      let activeMapVisualization = null;
      const savedLayerPaint = new Map();

      // Expand-chart modal state - declared here (top-of-file) for the same
      // TDZ reason as activeMapVisualization above: applyLanguageText reads
      // `expandedChartKey` synchronously during boot, before the modal
      // block further down the file is reached.
      let expandedChartKey = null;
      let expandedChartInstance = null;
      let chartModalEscHandler = null;

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
          language: currentLang,
          bbox,
        };

        try {
          const response = await fetch(`${BACKEND_BASE_URL}/api/report/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!response.ok){
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          const dispo = response.headers.get('Content-Disposition') || '';
          const m = /filename="([^"]+)"/.exec(dispo);
          const today = new Date();
          const datePart = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
          const filename = (m && m[1]) || `${(areaName || areaId || 'report').replace(/[^A-Za-z0-9_-]/g,'_')}_${datePart}.pdf`;
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


      function waitMs(ms){
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      function retryAttemptMessage(label, attempt, totalAttempts, delayMs){
        return `${tr('summaryRetryingPrefix')}${label}. ${tr('summaryRetryAttemptPrefix')}${attempt}${tr('summaryRetryAttemptSeparator')}${totalAttempts}. ${tr('summaryRetryWaitPrefix')}${Math.ceil(delayMs / 1000)}${tr('summaryRetryWaitSuffix')}`;
      }

      function retryFailedMessage(labels){
        const text = Array.isArray(labels) ? labels.join(', ') : String(labels || '');
        return `${tr('summaryRetryFailedPrefix')}${text}.`;
      }

      async function loadWithAutoRetry({ loadFn, onRetry, delaysMs = AUTO_RETRY_DELAYS_MS }){
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
      applyLanguageText();
      updateDataSummaryCard();

      function municipalityCodeFromStatcode(statcode){ const m = String(statcode || "").trim().toUpperCase().match(/^(?:GM|WK|BU)(\d{4})/); return m ? m[1] : ""; }
      function normalizeGmCode(v){ const s = String(v ?? "").trim(); return !s ? "" : (s.startsWith("-") ? s : s.padStart(4, "0")); }
      function wijkBody(statcode){ const m = String(statcode || "").match(/WK(.+)/i); return m ? m[1] : ""; }
      function prettyName(props){ return String(props?.statnaam || props?.naam || props?.name || ""); }
      function prettyStatcode(props){ return String(props?.statcode || props?.code || ""); }
      
      async function fetchWithTimeout(url, ms=7000){ const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms); try{ return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); } }
      async function fetchBackendJson(path, ms=20000){ const url = `${BACKEND_BASE_URL}${path}`; const response = await fetchWithTimeout(url, ms); if (!response.ok) throw new Error(`Backend request failed: ${url} (${response.status})`); return await response.json(); }
      
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

      async function loadBagFeaturesForArea(key, areaFeature, level){
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

      async function loadBagSummaryForArea(key, areaFeature, level){
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

      function getCurrentBagAreaFeature(){ return selectedAreaFeature(); }
      function currentBagAreaLevel(){ return selectedAreaLevel(); }

      // ===== BAG charts (bouwjaar / gebruiksdoel / oppervlakte) =====

      const bagChartInstances = new Map();

      const BOUWJAAR_BUCKETS = [
        { label: '<1900',     min: -Infinity, max: 1899 },
        { label: '1900-1909', min: 1900,      max: 1909 },
        { label: '1910-1919', min: 1910,      max: 1919 },
        { label: '1920-1929', min: 1920,      max: 1929 },
        { label: '1930-1939', min: 1930,      max: 1939 },
        { label: '1940-1949', min: 1940,      max: 1949 },
        { label: '1950-1959', min: 1950,      max: 1959 },
        { label: '1960-1969', min: 1960,      max: 1969 },
        { label: '1970-1979', min: 1970,      max: 1979 },
        { label: '1980-1989', min: 1980,      max: 1989 },
        { label: '1990-1999', min: 1990,      max: 1999 },
        { label: '2000-2009', min: 2000,      max: 2009 },
        { label: '2010-2019', min: 2010,      max: 2019 },
        { label: '2020+',     min: 2020,      max: Infinity },
      ];

      const OPPERVLAKTE_BUCKETS = [
        { label: '<50 m²',     min: -Infinity, lt: 50 },
        { label: '50-75 m²',   min: 50,        lt: 75 },
        { label: '75-100 m²',  min: 75,        lt: 100 },
        { label: '100-150 m²', min: 100,       lt: 150 },
        { label: '150-250 m²', min: 150,       lt: 250 },
        { label: '250+ m²',    min: 250,       lt: Infinity },
      ];

      const GEBRUIKSDOEL_CATEGORIES = [
        'woonfunctie',
        'winkelfunctie',
        'kantoorfunctie',
        'industriefunctie',
        'onderwijsfunctie',
        'gezondheidszorgfunctie',
        'sportfunctie',
        'logiesfunctie',
        'bijeenkomstfunctie',
        'celfunctie',
        'overige gebruiksfunctie',
      ];

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

      const CHART_SKELETON_IDS = {
        chartBouwjaar: 'chartSkeletonBouwjaar',
        chartGebruiksdoel: 'chartSkeletonGebruiksdoel',
        chartOppervlakte: 'chartSkeletonOppervlakte',
      };

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
                  return `${tr('chartAxisCount')}: ${formatNumber(value)}`;
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
                  label: (ctx) => `${tr('chartAxisCount')}: ${formatNumber(ctx.parsed.x)}`,
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

      function renderBagCharts(loadingKeys = new Set()){
        const sourceLineEl = document.getElementById('bagChartSourceLine');
        const activeKeys = activeBagKeys();
        const pandActive = activeKeys.includes('pand');
        const voActive = activeKeys.includes('verblijfsobject');
        const level = currentBagAreaLevel();
        const featureLevel = level === 'wijk' || level === 'buurt';
        const areaFeature = getCurrentBagAreaFeature();
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
          const pandFeatures = getCachedBagFeatures('pand') || [];
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
            ? (getCachedBagFeatures('verblijfsobject') || [])
            : (getCachedBagFeatures('pand') || []);
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
          const voFeatures = getCachedBagFeatures('verblijfsobject') || [];
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

      function clearAllBagCharts(){
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
        gebruiksdoel: () => activeBagKeys().includes('verblijfsobject') ? 'verblijfsobject' : 'pand',
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
                callbacks: { label: (ctx) => `${tr('chartAxisCount')}: ${formatNumber(ctx.parsed.x)}` },
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
        const features = getCachedBagFeatures(sourceKey);
        if (!features || !features.length) return null;
        if (key === 'bouwjaar') return buildExpandedBouwjaarConfig(features);
        if (key === 'gebruiksdoel') return buildExpandedGebruiksdoelConfig(features);
        if (key === 'oppervlakte') return buildExpandedOppervlakteConfig(features);
        return null;
      }

      function syncExpandedTitle(){
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

      function openChartModal(key){
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

      function closeChartModal(){
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

      function refreshExpandedChartIfOpen(){
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

      // ---------- Chart bar color helpers ----------

      function bouwjaarBarColors(labels){
        if (activeMapVisualization !== 'bouwjaar') return null;
        return labels.map(label => {
          if (label === '<1900') return VIZ_PALETTE_BOUWJAAR.preBefore1900;
          const m = String(label).match(/^(\d{4})/);
          if (!m) return VIZ_PALETTE_BOUWJAAR.preBefore1900;
          const start = Number(m[1]);
          if (start < 1945) return VIZ_PALETTE_BOUWJAAR.band1900_1944;
          if (start < 1970) return VIZ_PALETTE_BOUWJAAR.band1945_1969;
          if (start < 1990) return VIZ_PALETTE_BOUWJAAR.band1970_1989;
          if (start < 2010) return VIZ_PALETTE_BOUWJAAR.band1990_2009;
          return VIZ_PALETTE_BOUWJAAR.band2010Plus;
        });
      }

      function gebruiksdoelBarColors(entries){
        if (activeMapVisualization !== 'gebruiksdoel') return null;
        return entries.map(e => VIZ_PALETTE_GEBRUIKSDOEL[e.key] || VIZ_PALETTE_GEBRUIKSDOEL.overige);
      }

      function oppervlakteBarColors(){
        if (activeMapVisualization !== 'oppervlakte') return null;
        return [
          VIZ_PALETTE_OPPERVLAKTE.band_lt50,
          VIZ_PALETTE_OPPERVLAKTE.band_50_75,
          VIZ_PALETTE_OPPERVLAKTE.band_75_100,
          VIZ_PALETTE_OPPERVLAKTE.band_100_150,
          VIZ_PALETTE_OPPERVLAKTE.band_150_250,
          VIZ_PALETTE_OPPERVLAKTE.band_250plus,
        ];
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
        // Custom language dropdown — replaces the native <select>. Calls
        // the existing setLanguage(lang) on selection; everything else
        // (applyLanguageText / refreshBagView) is unchanged.
        (function wireLanguageDropdown(){
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
        })();
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
        const chartModalEl = document.getElementById('chartExpandModal');
        const chartModalCloseEl = document.getElementById('chartExpandClose');
        chartModalCloseEl?.addEventListener('click', closeChartModal);
        chartModalEl?.addEventListener('click', (e) => {
          if (e.target === chartModalEl) closeChartModal();
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
  
