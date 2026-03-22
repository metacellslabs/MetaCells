import {
  finishWorkbookCrossSheetPickAndReturnToSource,
  isWorkbookCrossSheetPickProxyActive,
  onWorkbookTabButtonClick,
  restoreWorkbookCrossSheetPickEditor,
  shouldStartWorkbookCrossSheetPick,
  startWorkbookCrossSheetPick,
  syncWorkbookCrossSheetPickSourceValue,
} from './workbook-shell-runtime.js';

export function onTabButtonClick(app, tabId) {
  onWorkbookTabButtonClick(app, tabId);
}

export function shouldStartCrossTabMention(app, tabId) {
  return shouldStartWorkbookCrossSheetPick(app, tabId);
}

export var startCrossTabMention = startWorkbookCrossSheetPick;

export var restoreCrossTabMentionEditor = restoreWorkbookCrossSheetPickEditor;

export var syncCrossTabMentionSourceValue =
  syncWorkbookCrossSheetPickSourceValue;

export var isCrossTabMentionProxyActive = isWorkbookCrossSheetPickProxyActive;

export var finishCrossTabMentionAndReturnToSource =
  finishWorkbookCrossSheetPickAndReturnToSource;
