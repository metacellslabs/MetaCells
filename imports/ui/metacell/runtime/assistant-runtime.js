import { Meteor } from 'meteor/meteor';

function getAssistantDraftStorageKey(app) {
  return 'metacells:assistant:draft:' + String(app.sheetDocumentId || 'local');
}

function loadAssistantDraft(app) {
  try {
    return String(
      window.localStorage.getItem(getAssistantDraftStorageKey(app)) || '',
    );
  } catch (_error) {
    return '';
  }
}

function saveAssistantDraft(app, value) {
  try {
    window.localStorage.setItem(
      getAssistantDraftStorageKey(app),
      String(value == null ? '' : value),
    );
  } catch (_error) {}
}

function setAssistantDraftState(app, value) {
  app.assistantDraft = String(value == null ? '' : value);
  saveAssistantDraft(app, app.assistantDraft);
  renderAssistantPanel(app);
}

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer || new ArrayBuffer(0));
  var chunkSize = 0x8000;
  var binary = '';
  for (var i = 0; i < bytes.length; i += chunkSize) {
    var chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return window.btoa(binary);
}

function openAssistantFilePicker(app) {
  var panel = ensureAssistantPanel(app);
  var input = panel.querySelector("input[name='assistant-file']");
  if (!input) return;
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch (_error) {}
  input.click();
}

function uploadAssistantFile(app, file) {
  if (!file) return Promise.resolve();
  app.assistantBusy = true;
  renderAssistantPanel(app);
  return file
    .arrayBuffer()
    .then(function (buffer) {
      return Meteor.callAsync(
        'assistant.uploadFile',
        app.sheetDocumentId,
        String(file.name || 'Attached file'),
        String(file.type || ''),
        arrayBufferToBase64(buffer),
      );
    })
    .then(function (upload) {
      app.assistantUploads = (app.assistantUploads || []).concat([upload]);
      renderAssistantPanel(app);
    })
    .catch(function (error) {
      app.assistantMessages = app.assistantMessages || [];
      app.assistantMessages.push({
        role: 'assistant',
        content:
          'Upload error: ' +
          String(error && error.message ? error.message : error),
      });
      renderAssistantPanel(app);
    })
    .finally(function () {
      app.assistantBusy = false;
      renderAssistantPanel(app);
    });
}

function loadAssistantConversation(app) {
  return Meteor.callAsync('assistant.getConversation', app.sheetDocumentId)
    .then(function (result) {
      app.assistantMessages =
        result && Array.isArray(result.messages) ? result.messages : [];
      app.assistantUploads =
        result && Array.isArray(result.uploads) ? result.uploads : [];
      renderAssistantPanel(app);
    })
    .catch(function () {
      app.assistantMessages = [];
      app.assistantUploads = [];
      renderAssistantPanel(app);
    });
}

function getAssistantStatusText(app) {
  if (app.assistantBusy) return 'Working on your request';
  return '';
}

function formatAssistantMessageTime(item) {
  var raw = item && item.createdAt ? item.createdAt : '';
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_error) {
    return '';
  }
}

function refreshAssistantManifest(app) {
  return Meteor.callAsync(
    'assistant.getManifest',
    app.sheetDocumentId,
    app.getWorkbookSnapshot(),
  )
    .then(function (manifest) {
      app.assistantManifest = manifest;
      renderAssistantPanel(app);
      return manifest;
    })
    .catch(function () {});
}

function scrollAssistantMessagesToBottom(messagesWrap) {
  if (!messagesWrap) return;
  var applyScroll = function () {
    messagesWrap.scrollTop = messagesWrap.scrollHeight;
  };
  applyScroll();
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(applyScroll);
  }
}

function ensureAssistantPanel(app) {
  if (app.assistantPanel) return app.assistantPanel;
  var panel = document.querySelector('.assistant-chat-panel');
  if (!panel) return null;
  app.assistantPanel = panel;
  return panel;
}

function renderAssistantPanel(app) {
  var panel = ensureAssistantPanel(app);
  if (!panel) return;
  var messagesWrap = panel.querySelector('.assistant-chat-messages');
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
  if (messagesWrap) {
    if (
      typeof window !== 'undefined' &&
      typeof window.requestAnimationFrame === 'function'
    ) {
      window.requestAnimationFrame(function () {
        scrollAssistantMessagesToBottom(messagesWrap);
      });
    } else {
      scrollAssistantMessagesToBottom(messagesWrap);
    }
  }
}

export function getAssistantUiState(app) {
  var manifest =
    app && app.assistantManifest && typeof app.assistantManifest === 'object'
      ? app.assistantManifest
      : null;
  var providers =
    manifest && Array.isArray(manifest.providers)
      ? manifest.providers
          .map(function (provider) {
            return provider && typeof provider === 'object'
              ? {
                  id: String(provider.id || ''),
                  name: String(provider.name || provider.id || ''),
                }
              : null;
          })
          .filter(Boolean)
      : [];
  var messages = Array.isArray(app && app.assistantMessages)
    ? app.assistantMessages.map(function (item) {
        return item && typeof item === 'object'
          ? {
              role: String(item.role || ''),
              content: String(item.content || ''),
              time: formatAssistantMessageTime(item),
            }
          : null;
      }).filter(Boolean)
    : [];
  var uploads = Array.isArray(app && app.assistantUploads)
    ? app.assistantUploads.map(function (item) {
        return item && typeof item === 'object'
          ? {
              id: String(item.id || ''),
              name: String(item.name || 'Uploaded file'),
            }
          : null;
      }).filter(Boolean)
    : [];
  var activity = Array.isArray(app && app.assistantActivity)
    ? app.assistantActivity.map(function (item) {
        var toolResults = Array.isArray(item && item.toolResults)
          ? item.toolResults
              .map(function (result) {
                return result && typeof result === 'object'
                  ? {
                      name: String(result.name || ''),
                      ok: result.ok !== false,
                      error: String(result.error || ''),
                    }
                  : null;
              })
              .filter(Boolean)
          : [];
        return item && typeof item === 'object'
          ? {
              assistantMessage: String(
                item.assistantMessage || 'Tool activity',
              ),
              toolResults: toolResults,
            }
          : null;
      }).filter(Boolean)
    : [];
  return {
    open: app && app.assistantPanelOpen === true,
    busy: app && app.assistantBusy === true,
    draft: String((app && app.assistantDraft) || ''),
    statusText: getAssistantStatusText(app),
    metaText: app && app.assistantBusy ? 'Working...' : '',
    activeProviderId: String(
      (manifest && manifest.activeProviderId) || '',
    ),
    providers: providers,
    uploads: uploads,
    messages: messages,
    activity: activity,
  };
}

function syncAssistantWorkbook(app, workbook) {
  if (
    !workbook ||
    !app.storage ||
    !app.storage.storage ||
    typeof app.storage.storage.replaceAll !== 'function'
  ) {
    return;
  }
  app.storage.storage.replaceAll(workbook);
  app.tabs = app.storage.readTabs();
  if (typeof app.syncWorkbookShellTabs === 'function') {
    app.syncWorkbookShellTabs(app.tabs);
  }
  app.renderTabs();
  var nextActiveSheetId = String((workbook && workbook.activeTabId) || '');
  if (!nextActiveSheetId) {
    nextActiveSheetId = app.storage.getActiveSheetId(app.activeSheetId);
  }
  if (!nextActiveSheetId && app.tabs[0]) nextActiveSheetId = app.tabs[0].id;
  if (nextActiveSheetId && nextActiveSheetId !== app.activeSheetId) {
    app.switchToSheet(nextActiveSheetId);
    return;
  }
  app.renderCurrentSheetFromStorage();
  if (app.isReportActive()) app.renderReportLiveValues();
}

function getAssistantConversation(app) {
  return (Array.isArray(app.assistantMessages) ? app.assistantMessages : []).map(
    function (item) {
      return {
        role: String((item && item.role) || ''),
        content: String((item && item.content) || ''),
      };
    },
  );
}

function submitAssistantPrompt(app, nextValue) {
  var value = String(
    typeof nextValue === 'undefined' ? app.assistantDraft || '' : nextValue,
  ).trim();
  if (!value || app.assistantBusy) return;
  app.assistantBusy = true;
  app.assistantMessages = app.assistantMessages || [];
  app.assistantActivity = app.assistantActivity || [];
  app.assistantMessages.push({ role: 'user', content: value });
  app.assistantDraft = '';
  saveAssistantDraft(app, '');
  renderAssistantPanel(app);
  Meteor.callAsync('assistant.chat', {
    sheetDocumentId: app.sheetDocumentId,
    workbookSnapshot: app.getWorkbookSnapshot(),
    message: value,
  })
    .then(function (result) {
      app.assistantManifest = result && result.manifest ? result.manifest : app.assistantManifest;
      app.assistantUploads =
        result && Array.isArray(result.uploads)
          ? result.uploads
          : app.assistantUploads || [];
      app.assistantMessages =
        result && Array.isArray(result.conversation)
          ? result.conversation
          : getAssistantConversation(app).concat([
              {
                role: 'assistant',
                content: String((result && result.message) || '(no response)'),
              },
            ]);
      if (result && Array.isArray(result.activity) && result.activity.length) {
        app.assistantActivity = app.assistantActivity.concat(result.activity);
      }
  if (result && result.workbook) {
        syncAssistantWorkbook(app, result.workbook);
      }
      renderAssistantPanel(app);
    })
    .catch(function (error) {
      app.assistantMessages.push({
        role: 'assistant',
        content:
          'Assistant error: ' +
          String(error && error.message ? error.message : error),
      });
      renderAssistantPanel(app);
    })
    .finally(function () {
      app.assistantBusy = false;
      renderAssistantPanel(app);
    });
}

export function setupAssistantPanel(app) {
  var panel = ensureAssistantPanel(app);
  if (!panel) return;
  app.assistantMessages = [];
  app.assistantActivity = [];
  app.assistantUploads = [];
  app.assistantBusy = false;
  app.assistantPanelOpen = false;
  app.assistantDraft = loadAssistantDraft(app);
  loadAssistantConversation(app);
  refreshAssistantManifest(app);
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
}

export function toggleAssistantPanel(app) {
  var panel = ensureAssistantPanel(app);
  if (!panel) return;
  if (!app.assistantPanelOpen) {
    app.assistantPanelOpen = true;
    renderAssistantPanel(app);
    var textarea = panel.querySelector("textarea[name='message']");
    if (textarea && typeof textarea.focus === 'function') textarea.focus();
    if (app && typeof app.publishUiState === 'function') app.publishUiState();
    return;
  }
  hideAssistantPanel(app);
}

export function hideAssistantPanel(app) {
  if (!app.assistantPanel) return;
  app.assistantPanelOpen = false;
  if (app && typeof app.publishUiState === 'function') app.publishUiState();
}

export function updateAssistantDraft(app, value) {
  setAssistantDraftState(app, value);
}

export function submitAssistantDraft(app, value) {
  return submitAssistantPrompt(app, value);
}

export function clearAssistantConversation(app) {
  Meteor.callAsync('assistant.clearConversation', app.sheetDocumentId).catch(
    function () {},
  );
  app.assistantMessages = [];
  app.assistantActivity = [];
  app.assistantUploads = [];
  renderAssistantPanel(app);
}

export function setAssistantProvider(app, providerId) {
  var normalizedProviderId = String(providerId || '');
  if (!normalizedProviderId) return Promise.resolve();
  app.assistantBusy = true;
  renderAssistantPanel(app);
  return Meteor.callAsync('settings.setActiveAIProvider', normalizedProviderId)
    .then(function () {
      return refreshAssistantManifest(app);
    })
    .catch(function (error) {
      app.assistantMessages = app.assistantMessages || [];
      app.assistantMessages.push({
        role: 'assistant',
        content:
          'Provider switch error: ' +
          String(error && error.message ? error.message : error),
        createdAt: new Date().toISOString(),
      });
    })
    .finally(function () {
      app.assistantBusy = false;
      renderAssistantPanel(app);
    });
}

export function removeAssistantUpload(app, uploadId) {
  var normalizedUploadId = String(uploadId || '');
  if (!normalizedUploadId) return Promise.resolve();
  return Meteor.callAsync(
    'assistant.removeUpload',
    app.sheetDocumentId,
    normalizedUploadId,
  )
    .then(function (result) {
      app.assistantUploads =
        result && Array.isArray(result.uploads) ? result.uploads : [];
      renderAssistantPanel(app);
    })
    .catch(function () {});
}

export function uploadAssistantFileFromPicker(app, file) {
  return uploadAssistantFile(app, file);
}
