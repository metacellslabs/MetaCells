import {
  bindCellInputEditingEvents,
  bindOverlayEditingInputEvents,
} from './editing-input-runtime.js';
import { bindCellFocusProxyEvents } from './keyboard-focus-proxy-runtime.js';
import {
  bindDelegatedCellShellEvents,
  bindCellActionEvents,
  bindCellFillHandleEvents,
  bindCellShellEvents,
} from './keyboard-cell-shell-runtime.js';

export function bindGridInputEvents(app) {
  bindOverlayEditingInputEvents(app);
  bindDelegatedCellShellEvents(app);
  var iterate =
    typeof app.forEachInput === 'function'
      ? app.forEachInput.bind(app)
      : function (callback) {
          (app.inputs || []).forEach(callback);
        };
  iterate((input) => {
    bindCellInputEditingEvents(app, input);
    bindCellFocusProxyEvents(app, input);
    if (app.disableDelegatedGridShellEvents) {
      bindCellShellEvents(app, input);
      bindCellActionEvents(app, input);
      bindCellFillHandleEvents(app, input);
    }
  }, { includeDetached: true });
}
