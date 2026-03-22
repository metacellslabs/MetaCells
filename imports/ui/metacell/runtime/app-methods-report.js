import { getReportToolbarUiState as getReportToolbarUiStateRuntime } from './report-toolbar-runtime.js';
import {
  createReportTabElement as createReportTabElementRuntime,
  fragmentHasVisibleContent as fragmentHasVisibleContentRuntime,
  renderReportMarkdownNodes as renderReportMarkdownNodesRuntime,
  replaceMentionInTextNode as replaceMentionInTextNodeRuntime,
  replaceMentionNodes as replaceMentionNodesRuntime,
} from './report-transform-runtime.js';
import {
  activateReportTab as activateReportTabRuntime,
  applyLinkedReportInput as applyLinkedReportInputRuntime,
  createLinkedReportFileElement as createLinkedReportFileElementRuntime,
  createLinkedReportInputElement as createLinkedReportInputElementRuntime,
  createReportInternalLinkElement as createReportInternalLinkElementRuntime,
  createReportListElement as createReportListElementRuntime,
  createReportRegionTableElement as createReportRegionTableElementRuntime,
  decorateReportTabs as decorateReportTabsRuntime,
  followReportInternalLink as followReportInternalLinkRuntime,
  getReportTabStateStore as getReportTabStateStoreRuntime,
  handleReportFileShellAction as handleReportFileShellActionRuntime,
  injectLinkedInputsFromPlaceholders as injectLinkedInputsFromPlaceholdersRuntime,
  isListShortcutCell as isListShortcutCellRuntime,
  parseListItemsFromMentionValue as parseListItemsFromMentionValueRuntime,
  parseReportControlToken as parseReportControlTokenRuntime,
  readLinkedInputValue as readLinkedInputValueRuntime,
  readRegionRawValues as readRegionRawValuesRuntime,
  readRegionValues as readRegionValuesRuntime,
  refreshLinkedReportInputValue as refreshLinkedReportInputValueRuntime,
  resolveNamedMention as resolveNamedMentionRuntime,
  resolveReportInputMention as resolveReportInputMentionRuntime,
  resolveReportInternalLink as resolveReportInternalLinkRuntime,
  resolveReportMention as resolveReportMentionRuntime,
  resolveReportReference as resolveReportReferenceRuntime,
  resolveSheetCellMention as resolveSheetCellMentionRuntime,
  resolveSheetRegionMention as resolveSheetRegionMentionRuntime,
  setReportMode as setReportModeRuntime,
  setupReportControls as setupReportControlsRuntime,
} from './report-runtime.js';
import { renderReportLiveValues as renderReportLiveValuesRuntime } from './report-render-runtime.js';
import {
  buildPublishedReportUrl as buildPublishedReportUrlRuntime,
  exportCurrentReportPdf as exportCurrentReportPdfRuntime,
  publishCurrentReport as publishCurrentReportRuntime,
} from './fullscreen-runtime.js';

export function installReportMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.setupReportControls = function () {
    setupReportControlsRuntime(this);
  };

  SpreadsheetApp.prototype.getReportToolbarUiState = function () {
    return getReportToolbarUiStateRuntime(this);
  };

  SpreadsheetApp.prototype.setReportMode = function (mode) {
    setReportModeRuntime(this, mode);
  };

  SpreadsheetApp.prototype.renderReportLiveValues = function (forceRender) {
    renderReportLiveValuesRuntime(this, forceRender);
  };

  SpreadsheetApp.prototype.replaceMentionNodes = function (root) {
    replaceMentionNodesRuntime(this, root);
  };

  SpreadsheetApp.prototype.renderReportMarkdownNodes = function (root) {
    renderReportMarkdownNodesRuntime(this, root);
  };

  SpreadsheetApp.prototype.replaceMentionInTextNode = function (textNode) {
    replaceMentionInTextNodeRuntime(this, textNode);
  };

  SpreadsheetApp.prototype.createReportTabElement = function (token) {
    return createReportTabElementRuntime(this, token);
  };

  SpreadsheetApp.prototype.fragmentHasVisibleContent = function (fragment) {
    return fragmentHasVisibleContentRuntime(this, fragment);
  };

  SpreadsheetApp.prototype.getReportTabStateStore = function () {
    return getReportTabStateStoreRuntime(this);
  };

  SpreadsheetApp.prototype.activateReportTab = function (tabKey) {
    activateReportTabRuntime(this, tabKey);
  };

  SpreadsheetApp.prototype.decorateReportTabs = function (root) {
    decorateReportTabsRuntime(this, root);
  };

  SpreadsheetApp.prototype.parseReportControlToken = function (token, prefix) {
    return parseReportControlTokenRuntime(this, token, prefix);
  };

  SpreadsheetApp.prototype.resolveReportInternalLink = function (token) {
    return resolveReportInternalLinkRuntime(this, token);
  };

  SpreadsheetApp.prototype.createReportInternalLinkElement = function (token, target) {
    return createReportInternalLinkElementRuntime(this, token, target);
  };

  SpreadsheetApp.prototype.followReportInternalLink = function (link) {
    followReportInternalLinkRuntime(this, link);
  };

  SpreadsheetApp.prototype.injectLinkedInputsFromPlaceholders = function (root) {
    injectLinkedInputsFromPlaceholdersRuntime(this, root);
  };

  SpreadsheetApp.prototype.createLinkedReportInputElement = function (inputResolved) {
    return createLinkedReportInputElementRuntime(this, inputResolved);
  };

  SpreadsheetApp.prototype.createLinkedReportFileElement = function (inputResolved) {
    return createLinkedReportFileElementRuntime(this, inputResolved);
  };

  SpreadsheetApp.prototype.handleReportFileShellAction = function (shell, removeOnly) {
    handleReportFileShellActionRuntime(this, shell, removeOnly);
  };

  SpreadsheetApp.prototype.applyLinkedReportInput = function (input) {
    applyLinkedReportInputRuntime(this, input);
  };

  SpreadsheetApp.prototype.refreshLinkedReportInputValue = function (input) {
    refreshLinkedReportInputValueRuntime(this, input);
  };

  SpreadsheetApp.prototype.resolveReportInputMention = function (payload) {
    return resolveReportInputMentionRuntime(this, payload);
  };

  SpreadsheetApp.prototype.resolveReportMention = function (token) {
    return resolveReportMentionRuntime(this, token);
  };

  SpreadsheetApp.prototype.resolveReportReference = function (token) {
    return resolveReportReferenceRuntime(this, token);
  };

  SpreadsheetApp.prototype.resolveNamedMention = function (name, rawMode) {
    return resolveNamedMentionRuntime(this, name, rawMode);
  };

  SpreadsheetApp.prototype.resolveSheetCellMention = function (token, rawMode) {
    return resolveSheetCellMentionRuntime(this, token, rawMode);
  };

  SpreadsheetApp.prototype.resolveSheetRegionMention = function (token, rawMode) {
    return resolveSheetRegionMentionRuntime(this, token, rawMode);
  };

  SpreadsheetApp.prototype.readRegionValues = function (sheetId, startCellId, endCellId) {
    return readRegionValuesRuntime(this, sheetId, startCellId, endCellId);
  };

  SpreadsheetApp.prototype.readRegionRawValues = function (sheetId, startCellId, endCellId) {
    return readRegionRawValuesRuntime(this, sheetId, startCellId, endCellId);
  };

  SpreadsheetApp.prototype.createReportRegionTableElement = function (rows) {
    return createReportRegionTableElementRuntime(this, rows);
  };

  SpreadsheetApp.prototype.createReportListElement = function (items) {
    return createReportListElementRuntime(this, items);
  };

  SpreadsheetApp.prototype.isListShortcutCell = function (sheetId, cellId) {
    return isListShortcutCellRuntime(this, sheetId, cellId);
  };

  SpreadsheetApp.prototype.parseListItemsFromMentionValue = function (value) {
    return parseListItemsFromMentionValueRuntime(this, value);
  };

  SpreadsheetApp.prototype.readLinkedInputValue = function (sheetId, cellId) {
    return readLinkedInputValueRuntime(this, sheetId, cellId);
  };

  SpreadsheetApp.prototype.buildPublishedReportUrl = function () {
    return buildPublishedReportUrlRuntime(this);
  };

  SpreadsheetApp.prototype.publishCurrentReport = function () {
    return publishCurrentReportRuntime(this);
  };

  SpreadsheetApp.prototype.exportCurrentReportPdf = function () {
    exportCurrentReportPdfRuntime(this);
  };
}
