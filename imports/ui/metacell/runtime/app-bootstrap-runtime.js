import { initializeSpreadsheetAppState as initializeSpreadsheetAppStateRuntime } from './app-bootstrap-init-runtime.js';
import { setupSpreadsheetAppBehavior as setupSpreadsheetAppBehaviorRuntime } from './app-bootstrap-setup-runtime.js';

export function initializeSpreadsheetAppRuntime(app, opts) {
  initializeSpreadsheetAppStateRuntime(app, opts);
}

export function setupSpreadsheetAppRuntime(app) {
  setupSpreadsheetAppBehaviorRuntime(app);
}
