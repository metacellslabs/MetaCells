import {
  clearAssistantConversation as clearAssistantConversationRuntime,
  getAssistantUiState as getAssistantUiStateRuntime,
  hideAssistantPanel as hideAssistantPanelRuntime,
  removeAssistantUpload as removeAssistantUploadRuntime,
  setAssistantProvider as setAssistantProviderRuntime,
  setupAssistantPanel as setupAssistantPanelRuntime,
  submitAssistantDraft as submitAssistantDraftRuntime,
  toggleAssistantPanel as toggleAssistantPanelRuntime,
  updateAssistantDraft as updateAssistantDraftRuntime,
  uploadAssistantFileFromPicker as uploadAssistantFileFromPickerRuntime,
} from './assistant-runtime.js';
import {
  getFormulaTrackerUiState as getFormulaTrackerUiStateRuntime,
  hideFormulaTrackerPanel as hideFormulaTrackerPanelRuntime,
  refreshFormulaTrackerPanel as refreshFormulaTrackerPanelRuntime,
  setupFormulaTrackerPanel as setupFormulaTrackerPanelRuntime,
  toggleFormulaTrackerPanel as toggleFormulaTrackerPanelRuntime,
} from './formula-tracker-runtime.js';

export function installAssistantMethods(SpreadsheetApp) {
  SpreadsheetApp.prototype.setupAssistantPanel = function () {
    setupAssistantPanelRuntime(this);
  };

  SpreadsheetApp.prototype.setupFormulaTrackerPanel = function () {
    setupFormulaTrackerPanelRuntime(this);
  };

  SpreadsheetApp.prototype.toggleAssistantPanel = function () {
    toggleAssistantPanelRuntime(this);
    this.refreshFormulaTrackerPanel();
  };

  SpreadsheetApp.prototype.hideAssistantPanel = function () {
    hideAssistantPanelRuntime(this);
    this.refreshFormulaTrackerPanel();
  };

  SpreadsheetApp.prototype.updateAssistantDraft = function (value) {
    updateAssistantDraftRuntime(this, value);
  };

  SpreadsheetApp.prototype.submitAssistantDraft = function (value) {
    return submitAssistantDraftRuntime(this, value);
  };

  SpreadsheetApp.prototype.clearAssistantConversation = function () {
    clearAssistantConversationRuntime(this);
  };

  SpreadsheetApp.prototype.setAssistantProvider = function (providerId) {
    return setAssistantProviderRuntime(this, providerId);
  };

  SpreadsheetApp.prototype.removeAssistantUpload = function (uploadId) {
    return removeAssistantUploadRuntime(this, uploadId);
  };

  SpreadsheetApp.prototype.uploadAssistantFile = function (file) {
    return uploadAssistantFileFromPickerRuntime(this, file);
  };

  SpreadsheetApp.prototype.getAssistantUiState = function () {
    return getAssistantUiStateRuntime(this);
  };

  SpreadsheetApp.prototype.toggleFormulaTrackerPanel = function () {
    toggleFormulaTrackerPanelRuntime(this);
  };

  SpreadsheetApp.prototype.hideFormulaTrackerPanel = function () {
    hideFormulaTrackerPanelRuntime(this);
  };

  SpreadsheetApp.prototype.refreshFormulaTrackerPanel = function () {
    refreshFormulaTrackerPanelRuntime(this);
  };

  SpreadsheetApp.prototype.getFormulaTrackerUiState = function () {
    return getFormulaTrackerUiStateRuntime(this);
  };
}
