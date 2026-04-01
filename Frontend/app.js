// Frontend application logic for the split frontend/backend dashboard.
// Administrative hierarchy data is loaded from the backend endpoints.
// External PDOK APIs are still used where needed for basemap and registry data.

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
      const languageSelectEl = document.getElementById("languageSelect");
      const bagTogglePandEl = document.getElementById("toggleBagPand");
      const bagToggleVerblijfsobjectEl = document.getElementById("toggleBagVerblijfsobject");
      const bagToggleAdresEl = document.getElementById("toggleBagAdres");
      const bagToggleWoonplaatsEl = document.getElementById("toggleBagWoonplaats");
      const bagToggleStandplaatsEl = document.getElementById("toggleBagStandplaats");
      const bagToggleLigplaatsEl = document.getElementById("toggleBagLigplaats");
      const bgtToggleWegdeelEl = document.getElementById("toggleBgtWegdeel");
      const bgtToggleWaterdeelEl = document.getElementById("toggleBgtWaterdeel");
      const bgtToggleBegroeidEl = document.getElementById("toggleBgtBegroeid");
      const bgtToggleOnbegroeidEl = document.getElementById("toggleBgtOnbegroeid");
      const bgtToggleSpoorEl = document.getElementById("toggleBgtSpoor");

      const bagToggleEls = {
        pand: bagTogglePandEl,
        verblijfsobject: bagToggleVerblijfsobjectEl,
        adres: bagToggleAdresEl,
        woonplaats: bagToggleWoonplaatsEl,
        standplaats: bagToggleStandplaatsEl,
        ligplaats: bagToggleLigplaatsEl
      };

      const bgtToggleEls = {
        wegdeel: bgtToggleWegdeelEl,
        waterdeel: bgtToggleWaterdeelEl,
        begroeidterreindeel: bgtToggleBegroeidEl,
        onbegroeidterreindeel: bgtToggleOnbegroeidEl,
        spoor: bgtToggleSpoorEl
      };

      const bagAccordionEl = document.getElementById("bagAccordion");
      const bagAccordionToggleEl = document.getElementById("bagAccordionToggle");
      const bagAccordionPanelEl = document.getElementById("bagAccordionPanel");
      const bgtAccordionEl = document.getElementById("bgtAccordion");
      const bgtAccordionToggleEl = document.getElementById("bgtAccordionToggle");
      const bgtAccordionPanelEl = document.getElementById("bgtAccordionPanel");
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
      function syncBgtAccordion(animate=false){ syncAccordion(bgtAccordionEl, bgtAccordionToggleEl, bgtAccordionPanelEl, animate); }
      function toggleBagAccordion(){ toggleAccordion(bagAccordionEl, bagAccordionToggleEl, bagAccordionPanelEl); }
      function toggleBgtAccordion(){ toggleAccordion(bgtAccordionEl, bgtAccordionToggleEl, bgtAccordionPanelEl); }
      const legendEl = document.querySelector(".legend");
      const legendBoundarySectionEl = document.getElementById("legendBoundarySection");
      const legendNationalRowEl = document.getElementById("legendNationalRow");
      const legendProvinceRowEl = document.getElementById("legendProvinceRow");
      const legendMunicipalityRowEl = document.getElementById("legendMunicipalityRow");
      const legendWijkRowEl = document.getElementById("legendWijkRow");
      const legendBuurtRowEl = document.getElementById("legendBuurtRow");
      const legendDataSectionEl = document.getElementById("legendDataSection");
      const legendBagRowEl = document.getElementById("legendBagRow");
      const legendBgtRowEl = document.getElementById("legendBgtRow");
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
          bgtAccordionTitle: "BGT",
          bagNamePand: "Pand",
          bagNameVerblijfsobject: "Verblijfsobject",
          bagNameAdres: "Adres",
          bagNameWoonplaats: "Woonplaats",
          bagNameStandplaats: "Standplaats",
          bagNameLigplaats: "Ligplaats",
          bagNameOpenbareRuimte: "Openbare ruimte",
          bagNameNummeraanduiding: "Nummeraanduiding",
          bgtNameWegdeel: "Wegdeel",
          bgtNameWaterdeel: "Waterdeel",
          bgtNameBegroeid: "Begroeid terreindeel",
          bgtNameOnbegroeid: "Onbegroeid terreindeel",
          bgtNameSpoor: "Spoor",
          bgtHint: "BGT wordt als featurelaag geladen. Op provincie- en gemeentelijk niveau wordt alleen een samenvatting getoond; op wijk- en buurtniveau ook de kaartlaag.",
          legendBag: "BAG objecten",
          legendBgt: "BGT objecten",
          bagPopupDefaultTitle: "Object",
          bagSummaryTitle: "Gegevenssamenvatting",
          bagSummaryBadge: "gegevens",
          bagSummaryChooseArea: "Kies een gebied en schakel BAG of BGT in.",
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
          descBro: "Ondergrond / grondwatergebruik & onderzoeken (vergrendeld)",
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
          overviewIntro: "Dashboardprototype voor het verkennen van Nederlandse basisregistraties (BGT, BAG, BRO) via administratieve selecties.",
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
          selectProvince: "— Selecteer een provincie —",
          allMunicipalities: "— Alle gemeenten in provincie —",
          allWijken: "— Alle wijken in gemeente —",
          allBuurten: "— Alle buurten in wijk —",
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
          bgtSummaryActiveLayers: "Actieve BGT-lagen",
          bgtSummaryMapAndSummaryLoading: "Kaartlaag en samenvatting laden…",
          bgtSummaryOnlyLoading: "Samenvatting laden…",
          bgtSummaryObjects: "BGT-objecten",
          bgtSummaryShownOnMap: "BGT wordt op de kaart getoond voor dit detailniveau.",
          bgtSummaryOnlySummaryAtLevelPrefix: "Op ",
          bgtSummaryOnlySummaryAtLevelSuffix: "niveau wordt alleen de samenvatting getoond.",
          partialLoadNotePrefix: "Let op: gedeeltelijk geladen voor ",
          summaryLoadFailed: "Laden mislukt.",
          summaryLoadFailedShort: "Laden mislukt",
          summaryRetryingPrefix: "Laden mislukt. Automatisch opnieuw proberen voor ",
          summaryRetryAttemptPrefix: "Poging ",
          summaryRetryAttemptSeparator: " van ",
          summaryRetryWaitPrefix: "Nieuwe poging over ",
          summaryRetryWaitSuffix: " sec.",
          summaryRetryFailedPrefix: "Automatisch opnieuw proberen is mislukt voor ",
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
          bgtAccordionTitle: "BGT",
          bagNamePand: "Building",
          bagNameVerblijfsobject: "Residential unit",
          bagNameAdres: "Address",
          bagNameWoonplaats: "Place",
          bagNameStandplaats: "Standplace",
          bagNameLigplaats: "Mooring place",
          bagNameOpenbareRuimte: "Public space",
          bagNameNummeraanduiding: "Address number",
          bgtNameWegdeel: "Road segment",
          bgtNameWaterdeel: "Water body",
          bgtNameBegroeid: "Vegetated terrain part",
          bgtNameOnbegroeid: "Non-vegetated terrain part",
          bgtNameSpoor: "Railway",
          bgtHint: "BGT is loaded as a feature layer. At province and municipality level only a summary is shown; at district and neighborhood level the map layer is shown as well.",
          legendBag: "BAG objects",
          legendBgt: "BGT objects",
          bagPopupDefaultTitle: "Object",
          bagSummaryTitle: "Data summary",
          bagSummaryBadge: "data",
          bagSummaryChooseArea: "Choose an area and enable BAG or BGT.",
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
          descBro: "Subsurface / groundwater use & investigations (locked)",
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
          overviewIntro: "Dashboard prototype for exploring Dutch base registries (BGT, BAG, BRO) through administrative selections.",
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
          selectProvince: "— Select a province —",
          allMunicipalities: "— All municipalities in province —",
          allWijken: "— All districts in municipality —",
          allBuurten: "— All neighborhoods in district —",
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
          bgtSummaryActiveLayers: "Active BGT layers",
          bgtSummaryMapAndSummaryLoading: "Loading map layer and summary…",
          bgtSummaryOnlyLoading: "Loading summary…",
          bgtSummaryObjects: "BGT objects",
          bgtSummaryShownOnMap: "BGT is shown on the map at this detail level.",
          bgtSummaryOnlySummaryAtLevelPrefix: "At ",
          bgtSummaryOnlySummaryAtLevelSuffix: " level only the summary is shown.",
          partialLoadNotePrefix: "Note: partially loaded for ",
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

      function refreshSelectionUi(){
        if (allProvinces.length){
          populateProvinces();
          selProvincieEl.value = state.provinceStatcode || "";
        } else {
          resetProvinceSelect(tr("loadingProvinces"));
        }
        if (state.provinceStatcode){
          populateMunicipalities();
          selGemeenteEl.value = state.gemeenteStatcode || "";
        } else {
          resetMunicipalitySelect(tr("selectProvinceFirst"));
        }
        if (state.gmCode){
          populateWijken();
          selWijkEl.value = state.wijkStatcode || "";
        } else {
          resetWijkSelect(tr("selectMunicipalityFirst"));
        }
        if (state.gmCode && state.wijkStatcode){
          populateBuurten();
          selBuurtEl.value = state.buurtStatcode || "";
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
        if (languageSelectEl) {
          languageSelectEl.value = currentLang;
          languageSelectEl.setAttribute('aria-label', tr('languageAriaLabel'));
        }
        setText('languageLabel', tr('languageLabel'));
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
        setText('bgtAccordionTitle', tr('bgtAccordionTitle'));
        setText('bagNamePand', tr('bagNamePand'));
        setText('bagNameVerblijfsobject', tr('bagNameVerblijfsobject'));
        setText('bagNameAdres', tr('bagNameAdres'));
        setText('bagNameWoonplaats', tr('bagNameWoonplaats'));
        setText('bagNameStandplaats', tr('bagNameStandplaats'));
        setText('bagNameLigplaats', tr('bagNameLigplaats'));
        setText('bagNameOpenbareRuimte', tr('bagNameOpenbareRuimte'));
        setText('bagNameNummeraanduiding', tr('bagNameNummeraanduiding'));
        setText('bgtNameWegdeel', tr('bgtNameWegdeel'));
        setText('bgtNameWaterdeel', tr('bgtNameWaterdeel'));
        setText('bgtNameBegroeid', tr('bgtNameBegroeid'));
        setText('bgtNameOnbegroeid', tr('bgtNameOnbegroeid'));
        setText('bgtNameSpoor', tr('bgtNameSpoor'));
        setText('bgtHint', tr('bgtHint'));
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
        setText('legendBgt', tr('legendBgt'));
        updateLegendContext();
        setText('bagSummaryTitle', tr('bagSummaryTitle'));
        setText('bagSummaryBadge', tr('bagSummaryBadge'));
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
        if (bmBtnEl) bmBtnEl.title = tr('basemapTitle');
        refreshBasemapPopoverTexts();
        refreshSelectionUi();
      }

      function setLanguage(lang){
        currentLang = locales[lang] ? lang : 'nl';
        try{ localStorage.setItem('dashboardLang', currentLang); }catch(_){}
        applyLanguageText();
        refreshBagView().catch(err => console.warn("BAG refresh failed", err));
        refreshBgtView().catch(err => console.warn("BGT refresh failed", err));
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
      const YEARCODE = 2025;
      const BACKEND_BASE_URL = "http://127.0.0.1:8000";
      const PDOK_STYLE_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/styles/bestuurlijkegebieden_standaardvisualisatie__webmercatorquad?f=json";
      const LAND_FEATURES_URL = "https://api.pdok.nl/kadaster/brk-bestuurlijke-gebieden/ogc/v1/collections/landgebied/items?f=json&limit=10";
      const BRT_TILES = "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png";
      const LUCHTFOTO_WMTS_CAPS = "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0?request=GetCapabilities&service=WMTS";
      const WORLD_TOPO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
      const CBS_PROVINCIE_URL = `https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1/collections/provincie_gegeneraliseerd/items?f=json&limit=1000&jaarcode=${YEARCODE}`;
      const CBS_GEMEENTE_URL = `https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1/collections/gemeente_gegeneraliseerd/items?f=json&limit=1000&jaarcode=${YEARCODE}`;
      const CBS_WIJK_URL = `https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1/collections/wijk_gegeneraliseerd/items?f=json&limit=1000&jaarcode=${YEARCODE}`;
      const CBS_BUURT_URL = `https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1/collections/buurt_gegeneraliseerd/items?f=json&limit=1000&jaarcode=${YEARCODE}`;
      const BAG_COLLECTIONS = {
        pand: {
          label: { nl:"Pand", en:"Building" },
          popupTitle: { nl:"BAG pand", en:"BAG building" },
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 4000, municipality: 6000, wijk: 9000, buurt: 12000 },
          fill: "#d9c4a6",
          line: "#8b5e3c",
          fillOpacity: 0.42
        },
        verblijfsobject: {
          label: { nl:"Verblijfsobject", en:"Residential unit" },
          popupTitle: { nl:"BAG verblijfsobject", en:"BAG residential unit" },
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?f=json&limit=1000",
          geometry: "point",
          caps: { province: 4000, municipality: 6000, wijk: 9000, buurt: 12000 },
          circle: "#0ea5e9",
          radius: 4.8
        },
        adres: {
          label: { nl:"Adres", en:"Address" },
          popupTitle: { nl:"BAG adres", en:"BAG address" },
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/adres/items?f=json&limit=1000",
          geometry: "point",
          caps: { province: 4000, municipality: 6000, wijk: 9000, buurt: 12000 },
          circle: "#f97316",
          radius: 4.2
        },
        woonplaats: {
          label: { nl:"Woonplaats", en:"Place" },
          popupTitle: { nl:"BAG woonplaats", en:"BAG place" },
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/woonplaats/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3000, municipality: 4000, wijk: 5000, buurt: 5000 },
          fill: "#bbf7d0",
          line: "#16a34a",
          fillOpacity: 0.10
        },
        standplaats: {
          label: { nl:"Standplaats", en:"Standplace" },
          popupTitle: { nl:"BAG standplaats", en:"BAG standplace" },
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/standplaats/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3000, municipality: 5000, wijk: 7000, buurt: 9000 },
          fill: "#fde68a",
          line: "#d97706",
          fillOpacity: 0.34
        },
        ligplaats: {
          label: { nl:"Ligplaats", en:"Mooring place" },
          popupTitle: { nl:"BAG ligplaats", en:"BAG mooring place" },
          url: "https://api.pdok.nl/kadaster/bag/ogc/v2/collections/ligplaats/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3000, municipality: 5000, wijk: 7000, buurt: 9000 },
          fill: "#c7d2fe",
          line: "#4f46e5",
          fillOpacity: 0.34
        }
      };
      const ALL_BAG_KEYS = Object.keys(BAG_COLLECTIONS);
      const BGT_COLLECTIONS = {
        wegdeel: {
          label: { nl:"Wegdeel", en:"Road segment" },
          popupTitle: { nl:"BGT wegdeel", en:"BGT road segment" },
          url: "https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3500, municipality: 5000, wijk: 9000, buurt: 12000 },
          fill: "#cbd5e1",
          line: "#475569",
          fillOpacity: 0.36
        },
        waterdeel: {
          label: { nl:"Waterdeel", en:"Water body" },
          popupTitle: { nl:"BGT waterdeel", en:"BGT water body" },
          url: "https://api.pdok.nl/lv/bgt/ogc/v1/collections/waterdeel/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3500, municipality: 5000, wijk: 9000, buurt: 12000 },
          fill: "#93c5fd",
          line: "#2563eb",
          fillOpacity: 0.34
        },
        begroeidterreindeel: {
          label: { nl:"Begroeid terreindeel", en:"Vegetated terrain part" },
          popupTitle: { nl:"BGT begroeid terreindeel", en:"BGT vegetated terrain part" },
          url: "https://api.pdok.nl/lv/bgt/ogc/v1/collections/begroeidterreindeel/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3500, municipality: 5000, wijk: 9000, buurt: 12000 },
          fill: "#86efac",
          line: "#16a34a",
          fillOpacity: 0.30
        },
        onbegroeidterreindeel: {
          label: { nl:"Onbegroeid terreindeel", en:"Non-vegetated terrain part" },
          popupTitle: { nl:"BGT onbegroeid terreindeel", en:"BGT non-vegetated terrain part" },
          url: "https://api.pdok.nl/lv/bgt/ogc/v1/collections/onbegroeidterreindeel/items?f=json&limit=1000",
          geometry: "polygon",
          caps: { province: 3500, municipality: 5000, wijk: 9000, buurt: 12000 },
          fill: "#f5deb3",
          line: "#b45309",
          fillOpacity: 0.30
        },
        spoor: {
          label: { nl:"Spoor", en:"Railway" },
          popupTitle: { nl:"BGT spoor", en:"BGT railway" },
          url: "https://api.pdok.nl/lv/bgt/ogc/v1/collections/spoor/items?f=json&limit=1000",
          geometry: "line",
          caps: { province: 2500, municipality: 3500, wijk: 7000, buurt: 9000 },
          line: "#be123c",
          lineWidth: 1.8
        }
      };
      const ALL_BGT_KEYS = Object.keys(BGT_COLLECTIONS);

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
      let bgtFeatureRequestId = 0;
      const bagFeatureCache = new Map();
      const bgtFeatureCache = new Map();
      let bagSummarySectionHtml = "";
      let bgtSummarySectionHtml = "";
      const AUTO_RETRY_DELAYS_MS = [1500, 4000, 8000];

      function registrySummarySectionHtml(registryName, innerHtml){
        return `
          <div class="summaryMetricLabel" style="margin:0 0 8px 0;">${escapeHtml(registryName)}</div>
          ${innerHtml}
        `;
      }

      function updateDataSummaryCard(){
        if (!(bagSummaryCardEl && bagSummaryBodyEl)) return;
        const sections = [bagSummarySectionHtml, bgtSummarySectionHtml].filter(Boolean);
        if (!sections.length){
          bagSummaryCardEl.style.display = 'none';
          delete bagSummaryBodyEl.dataset.dynamic;
          bagSummaryBodyEl.textContent = tr('bagSummaryChooseArea');
          return;
        }
        bagSummaryCardEl.style.display = 'block';
        bagSummaryBodyEl.dataset.dynamic = '1';
        bagSummaryBodyEl.innerHTML = sections.join('<div style="height:1px;background:rgba(15,23,42,0.08);margin:12px 0;"></div>');
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

      function municipalityCodeFromStatcode(statcode){ const m = String(statcode || "").trim().toUpperCase().match(/^(?:GM|WK|BU)(\d{4})/); return m ? m[1] : ""; }
      function normalizeGmCode(v){ const s = String(v ?? "").trim(); return !s ? "" : (s.startsWith("-") ? s : s.padStart(4, "0")); }
      function wijkBody(statcode){ const m = String(statcode || "").match(/WK(.+)/i); return m ? m[1] : ""; }
      function prettyName(props){ return String(props?.statnaam || props?.naam || props?.name || ""); }
      function prettyStatcode(props){ return String(props?.statcode || props?.code || ""); }
      function preprocessFeatures(fc, kind){
        const out = { type: "FeatureCollection", features: [] };
        for (const f of (fc?.features || [])){
          const p = f.properties || {};
          const statcode = prettyStatcode(p);
          p._kind = kind; p._statcode = statcode; p._statnaam = prettyName(p);
          p._gmcode = municipalityCodeFromStatcode(statcode) || normalizeGmCode(p.gm_code);
          p._wijkbody = wijkBody(statcode); p._pvstatcode = ""; out.features.push(f);
        }
        return out;
      }
      async function fetchWithTimeout(url, ms=7000){ const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms); try{ return await fetch(url, { signal: ctrl.signal }); } finally { clearTimeout(t); } }
      async function fetchBackendJson(path, ms=20000){ const url = `${BACKEND_BASE_URL}${path}`; const response = await fetchWithTimeout(url, ms); if (!response.ok) throw new Error(`Backend request failed: ${url} (${response.status})`); return await response.json(); }
      async function fetchAllFeatures(startUrl, maxCount=Infinity){
        const all = []; let next = startUrl; let truncated = false;
        while (next){
          const r = await fetchWithTimeout(next, 20000); if (!r.ok) throw new Error(`Failed to load ${next}: ${r.status}`);
          const fc = await r.json(); const batch = fc?.features || [];
          if (all.length + batch.length > maxCount){ all.push(...batch.slice(0, Math.max(0, maxCount - all.length))); truncated = true; break; }
          all.push(...batch); next = null;
          for (const l of (fc.links || [])){ if (l.rel === "next" && l.href){ next = l.href; break; } }
          if (all.length >= maxCount){ truncated = true; break; }
        }
        return { type: "FeatureCollection", features: all, _truncated: truncated };
      }
      function geojsonBounds(feature){
        let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
        function scanCoords(coords){ if (!coords) return; if (typeof coords[0] === "number" && typeof coords[1] === "number"){ const x = coords[0], y = coords[1]; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; return; } for (const c of coords) scanCoords(c); }
        function scanGeom(geom){ if (!geom) return; if (geom.type === "GeometryCollection"){ for (const g of (geom.geometries || [])) scanGeom(g); return; } scanCoords(geom.coordinates); }
        scanGeom(feature?.geometry); return isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
      }
      function pointInRing(point, ring){ const x = point[0], y = point[1]; let inside = false; for (let i=0, j=ring.length-1; i<ring.length; j=i++){ const xi=ring[i][0], yi=ring[i][1], xj=ring[j][0], yj=ring[j][1]; const intersect=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi); if (intersect) inside=!inside; } return inside; }
      function pointInPolygon(point, polyCoords){ if (!polyCoords?.length || !pointInRing(point, polyCoords[0])) return false; for (let i=1; i<polyCoords.length; i++){ if (pointInRing(point, polyCoords[i])) return false; } return true; }
      function pointInGeometry(point, geom){ if (!geom) return false; if (geom.type === "Polygon") return pointInPolygon(point, geom.coordinates); if (geom.type === "MultiPolygon") return (geom.coordinates || []).some(poly => pointInPolygon(point, poly)); if (geom.type === "GeometryCollection") return (geom.geometries || []).some(g => pointInGeometry(point, g)); return false; }
      function featureProbePoint(feature){ const b = geojsonBounds(feature); return b ? [(b[0][0]+b[1][0])/2, (b[0][1]+b[1][1])/2] : null; }
      function assignProvinceLinks(){
        gmToProvinceStatcode.clear();
        for (const g of allGemeenten){
          const probe = featureProbePoint(g); let pv = "";
          if (probe){ for (const p of allProvinces){ if (pointInGeometry(probe, p.geometry)){ pv = p.properties?._statcode || ""; break; } } }
          g.properties._pvstatcode = pv; gmToProvinceStatcode.set(g.properties._statcode, pv);
        }
        for (const w of allWijken){ w.properties._pvstatcode = gmToProvinceStatcode.get(`GM${w.properties._gmcode}`) || ""; }
        for (const b of allBuurten){ b.properties._pvstatcode = gmToProvinceStatcode.get(`GM${b.properties._gmcode}`) || ""; }
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
      class HomeBasemapControl{ onAdd(map){ this.map = map; this._open = false; const container = document.createElement("div"); container.className = "maplibregl-ctrl maplibregl-ctrl-group customCtrl"; const homeBtn = document.createElement("button"); homeBtn.type = "button"; homeBtn.title = tr("homeTitle"); homeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`; homeBtn.addEventListener("click", (e)=>{ e.stopPropagation(); resetToNationalView(); map.easeTo({ ...DEFAULT_VIEW, duration: 800 }); }); const bmBtn = document.createElement("button"); bmBtn.type = "button"; bmBtn.title = tr("basemapTitle"); bmBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity="0.9"/><path d="M3 16l9 5 9-5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity="0.75"/></svg>`; const pop = document.createElement("div"); pop.className = "bmPopover"; pop.innerHTML = `<div class="bmTitle">${tr("basemapHeader")}</div><label class="bmOption"><input type="radio" name="basemap" value="brt" checked /><span>${tr("basemapBrt")}</span></label><label class="bmOption"><input type="radio" name="basemap" value="luchtfoto" /><span>${tr("basemapLuchtfoto")}</span></label><label class="bmOption"><input type="radio" name="basemap" value="none" /><span>${tr("basemapNone")}</span></label><div class="bmDivider"></div><div class="bmSliderWrap"><div class="bmSliderHead"><span>${tr("transparency")}</span><span class="bmValue" id="bmOpacityValue">50%</span></div><input class="bmRange" id="bmOpacityRange" type="range" min="0" max="100" step="1" value="50" /></div>`; homeBtnEl = homeBtn; bmBtnEl = bmBtn; basemapPopoverEl = pop; const opacityRange = pop.querySelector("#bmOpacityRange"); const opacityValue = pop.querySelector("#bmOpacityValue"); const syncOpacityLabel = () => { if (opacityValue) opacityValue.textContent = `${Math.round(currentBasemapOpacity * 100)}%`; if (opacityRange) opacityRange.value = String(Math.round(currentBasemapOpacity * 100)); }; syncOpacityLabel(); const openPopover = open => { this._open = !!open; pop.classList.toggle("open", this._open); }; bmBtn.addEventListener("click", e => { e.stopPropagation(); openPopover(!this._open); }); pop.addEventListener("change", async e => { const t = e.target; if (!t) return; if (t.name === "basemap"){ const mode = pop.querySelector('input[name="basemap"]:checked')?.value || "brt"; if (mode === "luchtfoto"){ try{ await ensureLuchtfotoLayer(); } catch(err){ console.warn(err); pop.querySelector('input[value="brt"]').checked = true; } } setBasemap(pop.querySelector('input[name="basemap"]:checked')?.value || "brt"); } }); opacityRange?.addEventListener("input", e => { currentBasemapOpacity = Number(e.target.value || 50) / 100; syncOpacityLabel(); applyBasemapOpacity(); }); this._docClick = e => { if (!this._open) return; if (!container.contains(e.target)) openPopover(false); }; this._docKey = e => { if (e.key === "Escape") openPopover(false); }; document.addEventListener("click", this._docClick); document.addEventListener("keydown", this._docKey); container.appendChild(homeBtn); container.appendChild(bmBtn); container.appendChild(pop); this._container = container; return container; } onRemove(){ if (this._container?.parentNode) this._container.parentNode.removeChild(this._container); document.removeEventListener("click", this._docClick); document.removeEventListener("keydown", this._docKey); this.map = undefined; } }
      const map = new maplibregl.Map({ container: "map", style: PDOK_STYLE_URL, center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, bearing: DEFAULT_VIEW.bearing, pitch: DEFAULT_VIEW.pitch, attributionControl: true }); map.addControl(new maplibregl.NavigationControl(), "top-right"); map.addControl(new HomeBasemapControl(), "top-right");
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

      function firstCoordFromGeometry(geom){
        if (!geom) return null;
        if (geom.type === 'Point') return geom.coordinates || null;
        if (geom.type === 'MultiPoint') return geom.coordinates?.[0] || null;
        if (geom.type === 'LineString') return geom.coordinates?.[0] || null;
        if (geom.type === 'MultiLineString') return geom.coordinates?.[0]?.[0] || null;
        if (geom.type === 'Polygon') return geom.coordinates?.[0]?.[0] || null;
        if (geom.type === 'MultiPolygon') return geom.coordinates?.[0]?.[0]?.[0] || null;
        if (geom.type === 'GeometryCollection'){
          for (const g of (geom.geometries || [])){
            const c = firstCoordFromGeometry(g);
            if (c) return c;
          }
        }
        return null;
      }

      function bagFeatureProbePoint(feature){
        return featureProbePoint(feature) || firstCoordFromGeometry(feature?.geometry);
      }

      function bboxStringForFeature(feature){
        const b = geojsonBounds(feature);
        return b ? `${b[0][0]},${b[0][1]},${b[1][0]},${b[1][1]}` : '';
      }

      async function fetchFeaturesAllPages(startUrl){
        const all = [];
        let next = startUrl;
        while (next){
          const r = await fetchWithTimeout(next, 20000);
          if (!r.ok) throw new Error(`Failed to load ${next}: ${r.status}`);
          const fc = await r.json();
          all.push(...(fc?.features || []));
          next = null;
          for (const l of (fc.links || [])){
            if (l.rel === 'next' && l.href){
              next = l.href;
              break;
            }
          }
        }
        return { type:'FeatureCollection', features: all, _truncated: false };
      }

      function turfFeature(input){
        if (!input) return null;
        if (input.type === 'Feature') return input;
        if (input.type && input.coordinates) return { type:'Feature', properties:{}, geometry: input };
        return null;
      }

      function geometryTypeOfFeature(feature){
        return String(feature?.geometry?.type || '');
      }

      function safeBooleanPointInPolygon(pointFeature, areaFeature){
        try{
          if (typeof turf !== 'undefined' && turf?.booleanPointInPolygon){
            return !!turf.booleanPointInPolygon(turfFeature(pointFeature), turfFeature(areaFeature));
          }
        }catch(_){ }
        const probe = firstCoordFromGeometry(pointFeature?.geometry || pointFeature);
        return probe ? pointInGeometry(probe, areaFeature?.geometry) : false;
      }

      function safeBooleanIntersects(featureA, featureB){
        try{
          if (typeof turf !== 'undefined' && turf?.booleanIntersects){
            return !!turf.booleanIntersects(turfFeature(featureA), turfFeature(featureB));
          }
        }catch(_){ }
        const probe = bagFeatureProbePoint(featureA);
        return probe ? pointInGeometry(probe, featureB?.geometry) : false;
      }

      function pointFeatureInsideArea(feature, areaFeature){
        const geomType = geometryTypeOfFeature(feature);
        if (geomType === 'Point') return safeBooleanPointInPolygon(feature, areaFeature);
        if (geomType === 'MultiPoint'){
          return (feature?.geometry?.coordinates || []).some(coords => safeBooleanPointInPolygon({
            type:'Feature',
            properties:{},
            geometry:{ type:'Point', coordinates: coords }
          }, areaFeature));
        }
        const probe = bagFeatureProbePoint(feature);
        return probe ? pointInGeometry(probe, areaFeature?.geometry) : false;
      }

      function featureIntersectsArea(feature, areaFeature){
        return safeBooleanIntersects(feature, areaFeature);
      }

      function featureMatchesAreaGeometry(feature, areaFeature, geometryHint=''){
        if (!areaFeature?.geometry || !feature?.geometry) return false;
        const geomType = geometryTypeOfFeature(feature);
        const hint = String(geometryHint || '').toLowerCase();
        if (hint === 'point' || geomType === 'Point' || geomType === 'MultiPoint'){
          return pointFeatureInsideArea(feature, areaFeature);
        }
        return featureIntersectsArea(feature, areaFeature);
      }

      function candidateAreasForSummaryLevel(level){
        if (level === 'province') return allProvinces.slice();
        if (level === 'municipality'){
          return state.provinceStatcode
            ? allGemeenten.filter(f => f.properties._pvstatcode === state.provinceStatcode)
            : allGemeenten.slice();
        }
        if (level === 'wijk'){
          return visibleWijken.length ? visibleWijken.slice() : allWijken.slice();
        }
        if (level === 'buurt'){
          return visibleBuurten.length ? visibleBuurten.slice() : allBuurten.slice();
        }
        return [];
      }

      function overlapAreaForFeatures(featureA, featureB){
        const polyTypes = new Set(['Polygon', 'MultiPolygon']);
        if (!polyTypes.has(geometryTypeOfFeature(featureA)) || !polyTypes.has(geometryTypeOfFeature(featureB))) return 0;
        try{
          if (typeof turf !== 'undefined' && turf?.intersect && turf?.featureCollection && turf?.area){
            const inter = turf.intersect(turf.featureCollection([turfFeature(featureA), turfFeature(featureB)]));
            return inter ? Number(turf.area(inter)) || 0 : 0;
          }
        }catch(_){ }
        return 0;
      }

      function dominantOverlapAreaFeature(feature, candidates){
        let best = null;
        let bestArea = 0;
        for (const candidate of (candidates || [])){
          const area = overlapAreaForFeatures(feature, candidate);
          if (area > bestArea + 1e-9){
            bestArea = area;
            best = candidate;
          }
        }
        if (!best){
          for (const candidate of (candidates || [])){
            if (featureIntersectsArea(feature, candidate)) return candidate;
          }
        }
        return best;
      }

      function bagFeatureMatchesAreaForMap(feature, areaFeature, key){
        const cfg = BAG_COLLECTIONS[key];
        return featureMatchesAreaGeometry(feature, areaFeature, cfg?.geometry);
      }

      function bagFeatureMatchesAreaForSummary(feature, areaFeature, level, key){
        const cfg = BAG_COLLECTIONS[key];
        if (!cfg || !areaFeature?.geometry) return false;
        if (cfg.geometry === 'point') return pointFeatureInsideArea(feature, areaFeature);
        const candidates = candidateAreasForSummaryLevel(level);
        if (!candidates.length) return featureIntersectsArea(feature, areaFeature);
        const dominant = dominantOverlapAreaFeature(feature, candidates);
        if (!dominant) return featureIntersectsArea(feature, areaFeature);
        return String(dominant.properties?._statcode || '') === String(areaFeature.properties?._statcode || '');
      }

      function filterBagFeaturesToArea(fc, areaFeature, key){
        if (!areaFeature?.geometry) return [];
        return (fc?.features || []).filter(f => bagFeatureMatchesAreaForMap(f, areaFeature, key));
      }

      function isCurrentBgtFeature(feature){
        const props = feature?.properties || {};
        return !String(props.eind_registratie ?? '').trim() && !String(props.termination_date ?? '').trim();
      }

      function filterBgtFeaturesToArea(fc, areaFeature, key){
        if (!areaFeature?.geometry) return [];
        const cfg = key ? BGT_COLLECTIONS[key] : null;
        return (fc?.features || []).filter(f => {
          if (!isCurrentBgtFeature(f)) return false;
          return featureMatchesAreaGeometry(f, areaFeature, cfg?.geometry);
        });
      }

      function getCurrentBagAreaFeature(){
        if (state.buurtStatcode) return allBuurten.find(x => x.properties._statcode === state.buurtStatcode) || null;
        if (state.wijkStatcode) return allWijken.find(x => x.properties._statcode === state.wijkStatcode) || null;
        if (state.gemeenteStatcode) return gemeenteByStatcode.get(state.gemeenteStatcode) || null;
        if (state.provinceStatcode) return provinceByStatcode.get(state.provinceStatcode) || null;
        return null;
      }

      function currentBagAreaLevel(){
        if (state.buurtStatcode) return 'buurt';
        if (state.wijkStatcode) return 'wijk';
        if (state.gemeenteStatcode) return 'municipality';
        if (state.provinceStatcode) return 'province';
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
        return [...allBgtRenderableLayerIds(), ...allBagRenderableLayerIds()];
      }

      function bagKeyFromLayerId(layerId){
        const m = String(layerId || '').match(/^bag-(.+?)-(fill|line|circle)$/);
        return m ? m[1] : '';
      }

      function bgtKeyFromLayerId(layerId){
        const m = String(layerId || '').match(/^bgt-(.+?)-(fill|line)$/);
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

      function popupValueHtml(value){
        if (value === undefined) return undefined;
        if (value === null) return 'null';

        if (typeof value === 'string'){
          const trimmed = value.trim();
          if (/^https?:\/\//i.test(trimmed)){
            const href = escapeHtml(trimmed);
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline;">Link</a>`;
          }
          return escapeHtml(value);
        }

        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'){
          return escapeHtml(String(value));
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
        const bgtKey = bgtKeyFromLayerId(feature?.layer?.id);
        const cfg = bagKey ? BAG_COLLECTIONS[bagKey] : BGT_COLLECTIONS[bgtKey];
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
            <div class="summaryNote">${escapeHtml(statusMessage || (showMap ? tr('bagSummaryMapAndSummaryLoading') : tr('bagSummaryOnlyLoading')))}</div>
          </div>
        `);
        updateDataSummaryCard();
      }

      function renderBagLayerSummary(rows, areaFeature, level, partialKeys, showMap, extraNote=''){
        if (!areaFeature) return;

        const areaLabel = `${prettyName(areaFeature.properties)} (${areaFeature.properties?._statcode || ''})`;
        const rowHtml = rows.map(row => {
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

        if (!showMap || !keysForLabel.length){
          if (legendBagRowEl) legendBagRowEl.style.display = 'none';
          updateLegendContext();
          return;
        }

        setText('legendBag', `BAG ${keysForLabel.map(key => collectionLabel(BAG_COLLECTIONS[key])).join(' / ')}`);
        if (legendBagRowEl) legendBagRowEl.style.display = 'flex';
        updateLegendContext();
      }

      function updateBgtLegend(activeKeys, countsByKey = {}, showMap = false){
        const visibleKeys = activeKeys.filter(key => (countsByKey[key] || 0) > 0);
        const keysForLabel = visibleKeys.length ? visibleKeys : activeKeys;

        if (!showMap || !keysForLabel.length){
          if (legendBgtRowEl) legendBgtRowEl.style.display = 'none';
          updateLegendContext();
          return;
        }

        setText('legendBgt', `BGT ${keysForLabel.map(key => collectionLabel(BGT_COLLECTIONS[key])).join(' / ')}`);
        if (legendBgtRowEl) legendBgtRowEl.style.display = 'flex';
        updateLegendContext();
      }

      function bagCacheKey(key, level, statcode){
        return `${key}:${level}:${statcode}`;
      }

      function bgtCacheKey(key, level, statcode){
        return `${key}:${level}:${statcode}`;
      }

      async function loadBagFeaturesForArea(key, areaFeature, level){
        const cfg = BAG_COLLECTIONS[key];
        const statcode = String(areaFeature?.properties?._statcode || '').trim();
        if (!cfg || !statcode || !level) return { type:'FeatureCollection', features: [], _truncated:false, _summaryCount: 0 };

        if (key === 'pand'){
          const params = new URLSearchParams({ level, statcode });
          const fc = await fetchBackendJson(`/api/bag/pand?${params.toString()}`, 60000);
          return {
            type:'FeatureCollection',
            features: fc.features || [],
            _truncated: !!fc._truncated,
            _summaryCount: Number.isFinite(fc.count) ? fc.count : ((fc.features || []).length)
          };
        }

        const bbox = bboxStringForFeature(areaFeature);
        if (!bbox) return { type:'FeatureCollection', features: [], _truncated:false, _summaryCount: 0 };

        const fc = await fetchFeaturesAllPages(`${cfg.url}&bbox=${encodeURIComponent(bbox)}`);
        const mapFeatures = filterBagFeaturesToArea(fc, areaFeature, key);
        const summaryCount = (cfg.geometry === 'point')
          ? mapFeatures.length
          : mapFeatures.reduce((count, feature) => count + (bagFeatureMatchesAreaForSummary(feature, areaFeature, level, key) ? 1 : 0), 0);

        return {
          type:'FeatureCollection',
          features: mapFeatures,
          _truncated: false,
          _summaryCount: summaryCount
        };
      }

      async function loadBgtFeaturesForArea(key, areaFeature, level){
        const cfg = BGT_COLLECTIONS[key];
        const bbox = bboxStringForFeature(areaFeature);
        if (!bbox || !cfg) return { type:'FeatureCollection', features: [], _truncated:false };

        const fc = await fetchFeaturesAllPages(`${cfg.url}&bbox=${encodeURIComponent(bbox)}`);
        const filtered = filterBgtFeaturesToArea(fc, areaFeature, key);

        return {
          type:'FeatureCollection',
          features: filtered,
          _truncated: false
        };
      }

      function getCurrentBagAreaFeature(){ return selectedAreaFeature(); }
      function currentBagAreaLevel(){ return selectedAreaLevel(); }
      function getCurrentBgtAreaFeature(){ return selectedAreaFeature(); }
      function currentBgtAreaLevel(){ return selectedAreaLevel(); }

      function activeBgtKeys(){
        return ALL_BGT_KEYS.filter(key => !!bgtToggleEls[key]?.checked);
      }

      function bgtSourceId(key){ return `bgt-${key}-features`; }
      function bgtLayerIdsForKey(key){
        const cfg = BGT_COLLECTIONS[key];
        if (!cfg) return [];
        if (cfg.geometry === 'line') return [`bgt-${key}-line`];
        return [`bgt-${key}-fill`, `bgt-${key}-line`];
      }
      function allBgtRenderableLayerIds(){
        return ALL_BGT_KEYS.flatMap(key => bgtLayerIdsForKey(key)).filter(id => map.getLayer(id));
      }
      function setBgtKeyData(key, fc){
        const source = map.getSource(bgtSourceId(key));
        if (source) source.setData(fc || { type:'FeatureCollection', features: [] });
      }
      function setBgtKeyVisibility(key, visible){
        for (const id of bgtLayerIdsForKey(key)){
          if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      }
      function clearAllBgtLayers(){
        for (const key of ALL_BGT_KEYS){
          setBgtKeyData(key, { type:'FeatureCollection', features: [] });
          setBgtKeyVisibility(key, false);
        }
      }
      function ensureBgtFeatureLayers(){
        for (const [key, cfg] of Object.entries(BGT_COLLECTIONS)){
          const sourceId = bgtSourceId(key);
          if (!map.getSource(sourceId)){
            map.addSource(sourceId, { type:'geojson', data:{ type:'FeatureCollection', features: [] } });
          }
          if (cfg.geometry === 'line'){
            const lineId = `bgt-${key}-line`;
            if (!map.getLayer(lineId)){
              map.addLayer({
                id: lineId,
                type: 'line',
                source: sourceId,
                layout: { visibility: 'none', 'line-join':'round', 'line-cap':'round' },
                paint: {
                  'line-color': cfg.line,
                  'line-opacity': 0.92,
                  'line-width': ['interpolate', ['linear'], ['zoom'], 10, Math.max(1.0, (cfg.lineWidth || 1.8) - 0.5), 13, cfg.lineWidth || 1.8, 16, (cfg.lineWidth || 1.8) + 0.8]
                }
              }, 'cbs-provincie-hit');
            }
          } else {
            const fillId = `bgt-${key}-fill`;
            const lineId = `bgt-${key}-line`;
            if (!map.getLayer(fillId)){
              map.addLayer({
                id: fillId,
                type: 'fill',
                source: sourceId,
                layout: { visibility: 'none' },
                paint: {
                  'fill-color': cfg.fill,
                  'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, Math.max(0.08, cfg.fillOpacity - 0.08), 13, cfg.fillOpacity, 16, Math.min(0.62, cfg.fillOpacity + 0.08)]
                }
              }, 'cbs-provincie-hit');
            }
            if (!map.getLayer(lineId)){
              map.addLayer({
                id: lineId,
                type: 'line',
                source: sourceId,
                layout: { visibility: 'none' },
                paint: {
                  'line-color': cfg.line,
                  'line-opacity': 0.9,
                  'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.45, 13, 0.9, 16, 1.4]
                }
              }, 'cbs-provincie-hit');
            }
          }
        }
      }

      function renderBgtSummaryMessage(message){
        bgtSummarySectionHtml = registrySummarySectionHtml('BGT', `<div class="summaryNote">${escapeHtml(message)}</div>`);
        updateDataSummaryCard();
      }

      function renderBgtLayerSummarySkeleton(level, activeKeys, showMap, statusMessage=''){
        const rows = activeKeys.slice(0, 5).map(() => `
          <div class="summarySkeletonRow">
            <span class="summarySkeletonBar" style="width:136px;"></span>
            <span class="summarySkeletonBar" style="width:52px;"></span>
          </div>
        `).join('');

        bgtSummarySectionHtml = registrySummarySectionHtml('BGT', `
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
              <div class="summaryMetricLabel">${escapeHtml(tr('bgtSummaryActiveLayers'))}</div>
              <div class="summarySkeletonStack">${rows}</div>
            </div>
            <div class="summaryNote">${escapeHtml(statusMessage || (showMap ? tr('bgtSummaryMapAndSummaryLoading') : tr('bgtSummaryOnlyLoading')))}</div>
          </div>
        `);
        updateDataSummaryCard();
      }

      function renderBgtLayerSummary(rows, areaFeature, level, partialKeys, showMap, extraNote=''){
        if (!areaFeature) return;
        const areaLabel = `${prettyName(areaFeature.properties)} (${areaFeature.properties?._statcode || ''})`;
        const rowHtml = rows.map(row => {
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
          ? `<div class="summaryNote">${escapeHtml(tr('bgtSummaryShownOnMap'))}</div>`
          : `<div class="summaryNote">${escapeHtml(tr('bgtSummaryOnlySummaryAtLevelPrefix'))}${escapeHtml(bagLevelLabel(level).toLowerCase())}${escapeHtml(tr('bgtSummaryOnlySummaryAtLevelSuffix'))}</div>`;

        bgtSummarySectionHtml = registrySummarySectionHtml('BGT', `
          <div class="summaryRow">
            <span>${escapeHtml(tr('bagSummaryArea'))}</span>
            <strong>${escapeHtml(areaLabel)}</strong>
          </div>
          <div class="summaryRow">
            <span>${escapeHtml(tr('bagSummaryLevel'))}</span>
            <strong>${escapeHtml(bagLevelLabel(level))}</strong>
          </div>
          <div class="summaryList" style="margin-top:10px;">
            <div class="summaryMetricLabel">${escapeHtml(tr('bgtSummaryObjects'))}</div>
            ${rowHtml || `<div class="summaryNote">${escapeHtml(tr('summaryNoObjectsLoaded'))}</div>`}
          </div>
          ${modeNote}
          ${partialNote}
          ${extraNoteHtml}
        `);
        updateDataSummaryCard();
      }


      async function refreshBagView(){
        const activeKeys = activeBagKeys();
        const reqId = ++bagFeatureRequestId;
        closeBagPopup();

        if (!activeKeys.length){
          clearAllBagLayers();
          bagSummarySectionHtml = '';
          updateBagLegend([], {}, false);
          updateDataSummaryCard();
          return;
        }

        const areaFeature = getCurrentBagAreaFeature();
        const level = currentBagAreaLevel();
        const showMap = level === 'wijk' || level === 'buurt';

        if (!areaFeature){
          clearAllBagLayers();
          updateBagLegend([], {}, false);
          renderBagSummaryMessage(tr('bagSummaryNoSelection'));
          return;
        }

        renderBagLayerSummarySkeleton(level, activeKeys, showMap);

        const rows = [];
        const countsByKey = {};
        const partialKeys = [];
        const failedKeys = [];

        for (const key of ALL_BAG_KEYS){
          const isActive = activeKeys.includes(key);

          if (!isActive){
            setBagKeyData(key, { type:'FeatureCollection', features: [] });
            setBagKeyVisibility(key, false);
            continue;
          }

          const cacheKey = bagCacheKey(key, level, areaFeature.properties?._statcode || '');
          let fc = bagFeatureCache.get(cacheKey);
          const label = collectionLabel(BAG_COLLECTIONS[key]);

          if (!fc){
            if (showMap){
              setBagKeyData(key, { type:'FeatureCollection', features: [] });
              setBagKeyVisibility(key, false);
            }

            const attemptResult = await loadWithAutoRetry({
              loadFn: () => loadBagFeaturesForArea(key, areaFeature, level),
              onRetry: ({ attempt, totalAttempts, delayMs, error }) => {
                console.warn(`BAG load failed for ${key}; retrying`, error);
                if (reqId !== bagFeatureRequestId) return;
                renderBagLayerSummarySkeleton(level, activeKeys, showMap, retryAttemptMessage(label, attempt, totalAttempts, delayMs));
              }
            });

            if (reqId !== bagFeatureRequestId) return;

            if (attemptResult.ok){
              fc = attemptResult.data;
              bagFeatureCache.set(cacheKey, fc);
            } else {
              console.warn(`BAG load failed for ${key}`, attemptResult.error);
              failedKeys.push(label);
              rows.push({ label, error: true });
              countsByKey[key] = 0;
              setBagKeyData(key, { type:'FeatureCollection', features: [] });
              setBagKeyVisibility(key, false);
              continue;
            }
          }

          if (reqId !== bagFeatureRequestId) return;

          setBagKeyData(key, fc);

          const count = Number.isFinite(fc._summaryCount) ? fc._summaryCount : (fc.features || []).length;
          countsByKey[key] = count;
          setBagKeyVisibility(key, showMap && (fc.features || []).length > 0);

          rows.push({ label, count });
          if (fc._truncated) partialKeys.push(label);
        }

        if (reqId !== bagFeatureRequestId) return;
        updateBagLegend(activeKeys, countsByKey, showMap);
        renderBagLayerSummary(rows, areaFeature, level, partialKeys, showMap, failedKeys.length ? retryFailedMessage(failedKeys) : '');
      }


      async function refreshBgtView(){
        const activeKeys = activeBgtKeys();
        const reqId = ++bgtFeatureRequestId;
        closeBagPopup();

        if (!activeKeys.length){
          clearAllBgtLayers();
          bgtSummarySectionHtml = '';
          updateBgtLegend([], {}, false);
          updateDataSummaryCard();
          return;
        }

        const areaFeature = getCurrentBgtAreaFeature();
        const level = currentBgtAreaLevel();

        if (!areaFeature){
          clearAllBgtLayers();
          updateBgtLegend([], {}, false);
          renderBgtSummaryMessage(tr('bagSummaryNoSelection'));
          return;
        }

        const showMap = level === 'wijk' || level === 'buurt';
        renderBgtLayerSummarySkeleton(level, activeKeys, showMap);

        const rows = [];
        const countsByKey = {};
        const partialKeys = [];
        const failedKeys = [];

        for (const key of ALL_BGT_KEYS){
          const isActive = activeKeys.includes(key);
          if (!isActive){
            setBgtKeyData(key, { type:'FeatureCollection', features: [] });
            setBgtKeyVisibility(key, false);
            continue;
          }

          const cacheKey = bgtCacheKey(key, level, areaFeature.properties?._statcode || '');
          let fc = bgtFeatureCache.get(cacheKey);
          const label = collectionLabel(BGT_COLLECTIONS[key]);

          if (!fc){
            if (showMap){
              setBgtKeyData(key, { type:'FeatureCollection', features: [] });
              setBgtKeyVisibility(key, false);
            }

            const attemptResult = await loadWithAutoRetry({
              loadFn: () => loadBgtFeaturesForArea(key, areaFeature, level),
              onRetry: ({ attempt, totalAttempts, delayMs, error }) => {
                console.warn(`BGT load failed for ${key}; retrying`, error);
                if (reqId !== bgtFeatureRequestId) return;
                renderBgtLayerSummarySkeleton(level, activeKeys, showMap, retryAttemptMessage(label, attempt, totalAttempts, delayMs));
              }
            });

            if (reqId !== bgtFeatureRequestId) return;

            if (attemptResult.ok){
              fc = attemptResult.data;
              bgtFeatureCache.set(cacheKey, fc);
            } else {
              console.warn(`BGT load failed for ${key}`, attemptResult.error);
              failedKeys.push(label);
              rows.push({ label, error: true });
              countsByKey[key] = 0;
              setBgtKeyData(key, { type:'FeatureCollection', features: [] });
              setBgtKeyVisibility(key, false);
              continue;
            }
          }

          if (reqId !== bgtFeatureRequestId) return;

          setBgtKeyData(key, fc);
          const count = (fc.features || []).length;
          countsByKey[key] = count;
          setBgtKeyVisibility(key, showMap && count > 0);
          rows.push({ label, count });
          if (fc._truncated) partialKeys.push(label);
        }

        if (reqId !== bgtFeatureRequestId) return;
        updateBgtLegend(activeKeys, countsByKey, showMap);
        renderBgtLayerSummary(rows, areaFeature, level, partialKeys, showMap, failedKeys.length ? retryFailedMessage(failedKeys) : '');
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
        const bagVisible = !!legendBagRowEl && legendBagRowEl.style.display !== 'none';
        const bgtVisible = !!legendBgtRowEl && legendBgtRowEl.style.display !== 'none';
        if (legendDataSectionEl) legendDataSectionEl.style.display = (bagVisible || bgtVisible) ? 'block' : 'none';
        if (legendEl) legendEl.style.display = (showNational || showProvince || showMunicipality || showWijk || showBuurt || bagVisible || bgtVisible) ? 'block' : 'none';
      }

      function updateInfoBox(){ const lines = []; if (state.provinceStatcode){ const pf = provinceByStatcode.get(state.provinceStatcode); if (pf) lines.push(`${tr("infoProvince")}: ${prettyName(pf.properties)} (${state.provinceStatcode})`); } if (state.gemeenteStatcode){ const gf = gemeenteByStatcode.get(state.gemeenteStatcode); if (gf) lines.push(`${tr("infoMunicipality")}: ${prettyName(gf.properties)} (${state.gemeenteStatcode})`); } if (state.wijkStatcode){ const wf = allWijken.find(f => f.properties?._statcode === state.wijkStatcode); if (wf) lines.push(`${tr("infoWijk")}: ${prettyName(wf.properties)} (${state.wijkStatcode})`); } if (state.buurtStatcode){ const bf = allBuurten.find(f => f.properties?._statcode === state.buurtStatcode); if (bf) lines.push(`${tr("infoBuurt")}: ${prettyName(bf.properties)} (${state.buurtStatcode})`); } selInfoEl.innerHTML = lines.join("<br>"); }
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
        refreshBgtView().catch(err => console.warn("BGT refresh failed", err));
      }
      function fitToFeature(feature){ const b = geojsonBounds(feature); if (b) map.fitBounds(b, { padding: 70, duration: 800 }); }
      function populateProvinces(){ const opts = allProvinces.map(f => ({ id: f.properties._statcode, name: f.properties._statnaam })).sort((a,b) => a.name.localeCompare(b.name, "nl")); selProvincieEl.innerHTML = `<option value="">${tr("selectProvince")}</option>`; for (const o of opts){ const opt = document.createElement("option"); opt.value = o.id; opt.textContent = `${o.name} (${o.id})`; selProvincieEl.appendChild(opt); } selProvincieEl.disabled = false; }
      function populateMunicipalities(){ if (!state.provinceStatcode){ resetMunicipalitySelect(); return; } const opts = allGemeenten.filter(f => f.properties._pvstatcode === state.provinceStatcode).map(f => ({ id: f.properties._statcode, name: f.properties._statnaam })).sort((a,b) => a.name.localeCompare(b.name, "nl")); if (!opts.length){ resetMunicipalitySelect(tr("noMunicipalitiesFound")); return; } selGemeenteEl.innerHTML = `<option value="">${tr("allMunicipalities")}</option>`; for (const o of opts){ const opt = document.createElement("option"); opt.value = o.id; opt.textContent = `${o.name} (${o.id})`; selGemeenteEl.appendChild(opt); } selGemeenteEl.disabled = false; }
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
      function selectProvince(statcode, doZoom=true){ state.provinceStatcode = statcode || ""; selProvincieEl.value = state.provinceStatcode; clearBelowProvince(); if (state.provinceStatcode) populateMunicipalities(); else resetMunicipalitySelect(); applyLayerFilters(); updateInfoBox(); if (doZoom && state.provinceStatcode){ const f = provinceByStatcode.get(state.provinceStatcode); if (f) fitToFeature(f); } }
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

        const areaData = await fetchBackendJson("/api/areas/all");

        const p = areaData.provincies;
        const g = areaData.gemeenten;
        const w = areaData.wijken;
        const b = areaData.buurten;

        allProvinces = p.features || [];
        allGemeenten = g.features || [];
        allWijken = w.features || [];
        allBuurten = b.features || [];
        visibleWijken = [];
        visibleBuurten = [];
        provinceByStatcode.clear();
        gemeenteByStatcode.clear();
        for (const f of allProvinces) provinceByStatcode.set(f.properties._statcode, f);
        for (const f of allGemeenten) gemeenteByStatcode.set(f.properties._statcode, f);
        assignProvinceLinks();
        map.getSource("cbs-provincie").setData(p);
        map.getSource("cbs-gemeente").setData(g);
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
      map.on("load", async ()=>{ ensureWhiteBackground(); const beforeId = firstNonBackgroundLayerId(); try{ await ensureBrtLayer(beforeId); await addOutsideNlMask(beforeId); await addWorldCountryOutlines(beforeId); }catch(err){ console.warn(err); } setBasemap("brt"); hideBrkMunicipalityLayers(); addAdminSourcesAndLayers(); ensureBagFeatureLayers(); updateAllBoundaryToggleButtons(); applyBoundaryLayerVisibility(); enforceBoundaryStackOrder(); try{ await loadAdminData(); enforceBoundaryStackOrder(); }catch(err){ console.error(err); selProvincieEl.innerHTML = `<option value="">${tr("loadFailedProvinces")}</option>`; selGemeenteEl.innerHTML = `<option value="">${tr("loadFailedMunicipalities")}</option>`; resetWijkSelect(tr("loadFailedShort")); resetBuurtSelect(tr("loadFailedShort")); }
        ensureBgtFeatureLayers();
        resetToNationalView = () => { state.provinceStatcode = ""; state.gemeenteStatcode = ""; state.gmCode = ""; state.wijkStatcode = ""; state.buurtStatcode = ""; selProvincieEl.value = ""; selGemeenteEl.value = ""; selWijkEl.value = ""; selBuurtEl.value = ""; resetMunicipalitySelect(); resetWijkSelect(); resetBuurtSelect(); applyLayerFilters(); updateInfoBox(); closeBagPopup(); };
        selProvincieEl.addEventListener("change", ()=> selectProvince(selProvincieEl.value, true));
        selGemeenteEl.addEventListener("change", ()=> selectMunicipality(selGemeenteEl.value, true));
        selWijkEl.addEventListener("change", ()=> { if (!state.gemeenteStatcode) return; selectWijk(selWijkEl.value, true); });
        selBuurtEl.addEventListener("change", ()=> { if (!state.wijkStatcode) return; selectBuurt(selBuurtEl.value, true); });
        languageSelectEl?.addEventListener("change", ()=> setLanguage(languageSelectEl.value));
        toggleGemeenteLayerEl?.addEventListener("click", ()=> setBoundaryLayerVisible('gemeente', !boundaryLayerVisible('gemeente')));
        toggleWijkLayerEl?.addEventListener("click", ()=> setBoundaryLayerVisible('wijk', !boundaryLayerVisible('wijk')));
        toggleBuurtLayerEl?.addEventListener("click", ()=> setBoundaryLayerVisible('buurt', !boundaryLayerVisible('buurt')));
        Object.values(bagToggleEls).forEach(el => {
          el?.addEventListener("change", () => {
            refreshBagView().catch(err => console.warn("BAG refresh failed", err));
          });
        });
        Object.values(bgtToggleEls).forEach(el => {
          el?.addEventListener("change", () => {
            refreshBgtView().catch(err => console.warn("BGT refresh failed", err));
          });
        });
        map.on("click", e => { const dataFeature = queryDataFeature(e.point); if (dataFeature){ openBagPopup(dataFeature, e.lngLat); return; } const buurt = featureUnderPointer(e.point, "cbs-buurt-hit"); if (buurt){ closeBagPopup(); return selectBuurtByFeature(buurt, true); } const wijk = featureUnderPointer(e.point, "cbs-wijk-hit"); if (wijk){ closeBagPopup(); return selectWijkByFeature(wijk, true); } const gemeente = featureUnderPointer(e.point, "cbs-gemeente-hit"); if (gemeente){ closeBagPopup(); return selectMunicipalityByFeature(gemeente, true); } const provincie = featureUnderPointer(e.point, "cbs-provincie-hit"); if (provincie){ closeBagPopup(); return selectProvinceByFeature(provincie, true); } closeBagPopup(); });
        syncBagAccordion(false);
        syncBgtAccordion(false);
        bagAccordionToggleEl?.addEventListener("click", toggleBagAccordion);
        bgtAccordionToggleEl?.addEventListener("click", toggleBgtAccordion);
        window.addEventListener("resize", ()=> { syncBagAccordion(false); syncBgtAccordion(false); });
        map.on("mousemove", e => { const hit = queryDataFeature(e.point) || featureUnderPointer(e.point, "cbs-buurt-hit") || featureUnderPointer(e.point, "cbs-wijk-hit") || featureUnderPointer(e.point, "cbs-gemeente-hit") || featureUnderPointer(e.point, "cbs-provincie-hit"); map.getCanvas().style.cursor = hit ? "pointer" : ""; });
      });
      map.on("error", e => console.error("MapLibre error:", e?.error || e));
    })();
  
