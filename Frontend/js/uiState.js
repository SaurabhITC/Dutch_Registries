// Frontend/js/uiState.js — shared UI state containers.
//
// Plain object/Map literals only. Every consumer (app.js plus the six
// factory modules) imports these by name and mutates them by reference,
// which is why they must be containers (Map, object literals) rather
// than primitive values — ES module imports are read-only `const`
// bindings, so the IDENTITY of each export can't change, but the
// CONTENTS can.
//
// This module is a deliberate cosmetic relocation of declarations that
// previously lived inline near the top of app.js's IIFE. No factory,
// no getters, no validation — keep this file boring.

export const state = { provinceStatcode:"", gemeenteStatcode:"", gmCode:"", wijkStatcode:"", buurtStatcode:"", showGemeente:true, showWijk:true, showBuurt:true };

export const selectionState = {
  allProvinces: [], allGemeenten: [], allWijken: [], allBuurten: [],
  visibleWijken: [], visibleBuurten: [],
};

export const provinceByStatcode = new Map();
export const gemeenteByStatcode = new Map();
export const gmToProvinceStatcode = new Map();

export const resetController = { resetToNationalView: () => {} };

export const basemapRefs = { homeBtnEl: null, bmBtnEl: null, basemapPopoverEl: null };

export const legendController = {
  updateLegendContext: () => {},
  updateInfoBox: () => {},
  updateDataSummaryCard: () => {},
  updateBagLegend: () => {},
  refreshSelectionLabelsOnly: () => {},
};

export const bagSummaryStore = { html: "" };
