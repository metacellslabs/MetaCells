import { useEffect, useRef, useState } from "react";
import { Meteor } from "meteor/meteor";
import { useTracker } from "meteor/react-meteor-data";
import { mountSpreadsheetApp } from "../metacell/runtime/index.js";
import { HelpOverlay } from "../help/HelpOverlay.jsx";
import {
  AppSettings,
  DEFAULT_DEEPSEEK_PROVIDER,
  DEFAULT_LM_STUDIO_PROVIDER,
  DEFAULT_SETTINGS_ID,
} from "../../api/settings/index.js";
import { decodeWorkbookDocument } from "../../api/sheets/workbook-codec.js";
import { Sheets } from "../../api/sheets/index.js";
import { createSheetDocStorage } from "../metacell/sheetDocStorage.js";

function HomePage() {
  useEffect(() => {
    document.body.classList.add("route-home");
    document.body.classList.remove("route-sheet");

    return () => {
      document.body.classList.remove("route-home");
    };
  }, []);

  const { isLoading, sheets } = useTracker(() => {
    const handle = Meteor.subscribe("sheets.list");

    return {
      isLoading: !handle.ready(),
      sheets: Sheets.find({}, { sort: { updatedAt: -1, createdAt: -1 } }).fetch(),
    };
  });

  const [isCreating, setIsCreating] = useState(false);
  const [deletingSheetId, setDeletingSheetId] = useState("");

  const handleCreateSheet = () => {
    if (isCreating) return;
    setIsCreating(true);

    Meteor.callAsync("sheets.create")
      .then((sheetId) => {
        setIsCreating(false);
        window.location.assign(`/metacell/${sheetId}`);
      })
      .catch((error) => {
        setIsCreating(false);
        window.alert(error.reason || error.message || "Failed to create metacell");
      });
  };

  const handleDeleteSheet = (sheetId, sheetName) => {
    if (deletingSheetId) return;
    const confirmed = window.confirm(`Delete metacell "${sheetName}"?`);
    if (!confirmed) return;

    setDeletingSheetId(sheetId);
    Meteor.callAsync("sheets.remove", sheetId)
      .then(() => setDeletingSheetId(""))
      .catch((error) => {
        setDeletingSheetId("");
        window.alert(error.reason || error.message || "Failed to delete metacell");
      });
  };

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-brand">
            <img className="home-brand-logo" src="/logo.png" alt="MetaCells" />
          </div>
          <h1>Cells that work for you.</h1>
          <p className="home-subtitle">
            Create smart spreadsheets where cells can think, calculate, and help complete tasks automatically. Built-in AI agents can analyze data, generate content, and perform tasks right inside your sheet.
          </p>
          <div className="home-actions">
            <button type="button" className="home-create-button" onClick={handleCreateSheet} disabled={isCreating}>
              {isCreating ? "Creating..." : "Add metacell"}
            </button>
            <a className="home-secondary-link" href="/settings">Settings</a>
            <span className="home-meta">
              {isLoading ? "Loading metacells..." : `${sheets.length} metacell${sheets.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>
      </section>

      <section className="home-card">
        <div className="home-section-head">
          <h2>Your metacells</h2>
        </div>

        {!isLoading && !sheets.length ? (
          <div className="home-empty-card">
            <p className="home-empty">No metacells yet.</p>
            <p className="home-empty-note">Start with a blank metacell and the app will create a persistent document for it.</p>
          </div>
        ) : null}

        {!isLoading && sheets.length ? (
          <div className="sheet-list">
            {sheets.map((sheet) => (
              <div key={sheet._id} className="sheet-list-item">
                <a className="sheet-list-link" href={`/metacell/${sheet._id}`}>
                  <div className="sheet-list-copy">
                    <span className="sheet-list-name">{sheet.name}</span>
                  </div>
                  <div className="sheet-list-meta">
                    <span className="sheet-list-date">
                      {sheet.updatedAt ? new Date(sheet.updatedAt).toLocaleString() : ""}
                    </span>
                    <span className="sheet-list-arrow">Open</span>
                  </div>
                </a>
                <button
                  type="button"
                  className="sheet-list-delete"
                  onClick={() => handleDeleteSheet(sheet._id, sheet.name)}
                  disabled={deletingSheetId === sheet._id}
                  aria-label={`Delete ${sheet.name}`}
                >
                  {deletingSheetId === sheet._id ? "..." : "×"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SettingsPage() {
  const SETTINGS_TABS = [
    { id: "ai", label: "AI Providers" },
    { id: "channels", label: "Channels" },
    { id: "general", label: "General" },
    { id: "advanced", label: "Advanced" },
  ];
  const [activeSettingsTab, setActiveSettingsTab] = useState("ai");
  const [activeProviderId, setActiveProviderId] = useState(DEFAULT_DEEPSEEK_PROVIDER.id);
  const [deepseekUrl, setDeepseekUrl] = useState(DEFAULT_DEEPSEEK_PROVIDER.baseUrl);
  const [deepseekModel, setDeepseekModel] = useState(DEFAULT_DEEPSEEK_PROVIDER.model);
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [lmStudioUrl, setLmStudioUrl] = useState(DEFAULT_LM_STUDIO_PROVIDER.baseUrl);
  const [lmStudioModel, setLmStudioModel] = useState(DEFAULT_LM_STUDIO_PROVIDER.model);
  const [isSavingProvider, setIsSavingProvider] = useState(false);
  const [isSavingActiveProvider, setIsSavingActiveProvider] = useState(false);
  const [addingChannel, setAddingChannel] = useState("");

  useEffect(() => {
    document.body.classList.add("route-home");
    document.body.classList.remove("route-sheet");

    return () => {
      document.body.classList.remove("route-home");
    };
  }, []);

  const { isLoading, settings } = useTracker(() => {
    const handle = Meteor.subscribe("settings.default");

    return {
      isLoading: !handle.ready(),
      settings: AppSettings.findOne(DEFAULT_SETTINGS_ID),
    };
  }, []);

  useEffect(() => {
    const providers = Array.isArray(settings && settings.aiProviders) ? settings.aiProviders : [];
    const deepseek = providers.find((item) => item && item.type === "deepseek");
    const lmStudio = providers.find((item) => item && item.type === "lm_studio");
    setActiveProviderId((settings && settings.activeAIProviderId) || DEFAULT_DEEPSEEK_PROVIDER.id);
    setDeepseekUrl((deepseek && deepseek.baseUrl) || DEFAULT_DEEPSEEK_PROVIDER.baseUrl);
    setDeepseekModel((deepseek && deepseek.model) || DEFAULT_DEEPSEEK_PROVIDER.model);
    setDeepseekApiKey((deepseek && deepseek.apiKey) || "");
    setLmStudioUrl((lmStudio && lmStudio.baseUrl) || DEFAULT_LM_STUDIO_PROVIDER.baseUrl);
    setLmStudioModel((lmStudio && lmStudio.model) || DEFAULT_LM_STUDIO_PROVIDER.model);
  }, [settings && settings.updatedAt ? new Date(settings.updatedAt).getTime() : 0]);

  const handleSaveProvider = (provider) => {
    if (isSavingProvider) return;

    setIsSavingProvider(true);
    Meteor.callAsync("settings.upsertAIProvider", provider)
      .then(() => setIsSavingProvider(false))
      .catch((error) => {
        setIsSavingProvider(false);
        window.alert(error.reason || error.message || "Failed to save AI provider");
      });
  };

  const handleSaveActiveProvider = () => {
    if (isSavingActiveProvider || !activeProviderId) return;
    setIsSavingActiveProvider(true);
    Meteor.callAsync("settings.setActiveAIProvider", activeProviderId)
      .then(() => setIsSavingActiveProvider(false))
      .catch((error) => {
        setIsSavingActiveProvider(false);
        window.alert(error.reason || error.message || "Failed to set active AI provider");
      });
  };

  const handleAddChannel = (type) => {
    if (addingChannel) return;
    setAddingChannel(type);
    Meteor.callAsync("settings.addCommunicationChannel", type)
      .then(() => setAddingChannel(""))
      .catch((error) => {
        setAddingChannel("");
        window.alert(error.reason || error.message || "Failed to add communication channel");
      });
  };

  const aiProviders = Array.isArray(settings && settings.aiProviders) ? settings.aiProviders : [];
  const communicationChannels = Array.isArray(settings && settings.communicationChannels)
    ? settings.communicationChannels
    : [];
  const activeProviderLabel = activeProviderId === DEFAULT_LM_STUDIO_PROVIDER.id ? "LM Studio" : "DeepSeek";
  const configuredChannelsCount = communicationChannels.length;
  const deepseekConfigured = Boolean(String(deepseekApiKey || "").trim());
  const renderSettingsPanel = () => {
    if (activeSettingsTab === "channels") {
      return (
        <>
          <div className="home-section-head">
            <h2>Communication Channels</h2>
          </div>
          <div className="settings-section-copy">
            <p>Connect outbound channels that MetaCells can use for communication workflows later.</p>
          </div>
          <div className="settings-channel-actions">
            <button type="button" onClick={() => handleAddChannel("gmail")} disabled={addingChannel === "gmail"}>
              {addingChannel === "gmail" ? "Connecting..." : "Connect Gmail"}
            </button>
            <button type="button" onClick={() => handleAddChannel("whatsapp")} disabled={addingChannel === "whatsapp"}>
              {addingChannel === "whatsapp" ? "Connecting..." : "Connect WhatsApp"}
            </button>
          </div>

          {!communicationChannels.length ? (
            <p className="home-empty-note">No communication channels added yet.</p>
          ) : (
            <div className="settings-channel-list">
              {communicationChannels.map((channel) => (
                <div key={channel.id} className="settings-channel-item">
                  <strong>{channel.label}</strong>
                  <span className="settings-status">{channel.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    if (activeSettingsTab === "general") {
      return (
        <>
          <div className="home-section-head">
            <h2>General</h2>
          </div>
          <div className="settings-section-copy">
            <p>Overview of the current AI and communication setup stored in Mongo.</p>
          </div>
          <div className="settings-kv-list">
            <div className="settings-kv-item">
              <span className="settings-label">Default AI provider</span>
              <strong>{activeProviderLabel}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">Configured providers</span>
              <strong>{aiProviders.length}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">Connected channels</span>
              <strong>{configuredChannelsCount}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">DeepSeek API key</span>
              <strong>{deepseekConfigured ? "Configured" : "Missing"}</strong>
            </div>
          </div>
        </>
      );
    }

    if (activeSettingsTab === "advanced") {
      return (
        <>
          <div className="home-section-head">
            <h2>Advanced</h2>
          </div>
          <div className="settings-section-copy">
            <p>Raw provider diagnostics and saved endpoints for debugging server-side AI calls.</p>
          </div>
          <div className="settings-kv-list">
            <div className="settings-kv-item">
              <span className="settings-label">DeepSeek URL</span>
              <strong>{deepseekUrl || "Not set"}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">DeepSeek model</span>
              <strong>{deepseekModel || "Not set"}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">LM Studio URL</span>
              <strong>{lmStudioUrl || "Not set"}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">LM Studio model override</span>
              <strong>{lmStudioModel || "Auto-detect"}</strong>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="home-section-head">
          <h2>AI Providers</h2>
        </div>
        <div className="settings-section-copy">
          <p>Current provider configuration is stored in Mongo and used by server-side AI requests.</p>
        </div>

        <div className="settings-provider-card">
          <div className="settings-provider-head">
            <strong>Default provider</strong>
            <span className="settings-status">{isLoading ? "Loading..." : "Saved in DB"}</span>
          </div>
          <label className="settings-label" htmlFor="active-provider-id">Active AI provider</label>
          <select
            id="active-provider-id"
            className="settings-input"
            value={activeProviderId}
            onChange={(event) => setActiveProviderId(event.target.value)}
          >
            <option value={DEFAULT_DEEPSEEK_PROVIDER.id}>DeepSeek</option>
            <option value={DEFAULT_LM_STUDIO_PROVIDER.id}>LM Studio</option>
          </select>
          <div className="settings-actions">
            <button type="button" onClick={handleSaveActiveProvider} disabled={isSavingActiveProvider || isLoading}>
              {isSavingActiveProvider ? "Saving..." : "Set default provider"}
            </button>
            <span className="settings-meta">Current: {activeProviderLabel}</span>
          </div>
        </div>

        <div className="settings-provider-card">
          <div className="settings-provider-head">
            <strong>DeepSeek</strong>
            <span className="settings-status">
              {activeProviderId === DEFAULT_DEEPSEEK_PROVIDER.id ? "Default" : "Available"}
            </span>
          </div>
          <label className="settings-label" htmlFor="deepseek-url">Base URL</label>
          <input
            id="deepseek-url"
            className="settings-input"
            type="text"
            value={deepseekUrl}
            onChange={(event) => setDeepseekUrl(event.target.value)}
            placeholder="https://api.deepseek.com"
          />
          <label className="settings-label" htmlFor="deepseek-model">Model</label>
          <input
            id="deepseek-model"
            className="settings-input"
            type="text"
            value={deepseekModel}
            onChange={(event) => setDeepseekModel(event.target.value)}
            placeholder="deepseek-chat"
          />
          <label className="settings-label" htmlFor="deepseek-api-key">API key</label>
          <input
            id="deepseek-api-key"
            className="settings-input"
            type="password"
            value={deepseekApiKey}
            onChange={(event) => setDeepseekApiKey(event.target.value)}
            placeholder="sk-..."
          />
          <div className="settings-actions">
            <button
              type="button"
              onClick={() =>
                handleSaveProvider({
                  ...DEFAULT_DEEPSEEK_PROVIDER,
                  baseUrl: String(deepseekUrl || "").trim(),
                  model: String(deepseekModel || "").trim(),
                  apiKey: String(deepseekApiKey || "").trim(),
                })}
              disabled={isSavingProvider || isLoading}
            >
              {isSavingProvider ? "Saving..." : "Save provider"}
            </button>
          </div>
        </div>

        <div className="settings-provider-card">
          <div className="settings-provider-head">
            <strong>LM Studio</strong>
            <span className="settings-status">
              {activeProviderId === DEFAULT_LM_STUDIO_PROVIDER.id ? "Default" : isLoading ? "Loading..." : "Saved in DB"}
            </span>
          </div>
          <label className="settings-label" htmlFor="lm-studio-url">Base URL</label>
          <input
            id="lm-studio-url"
            className="settings-input"
            type="text"
            value={lmStudioUrl}
            onChange={(event) => setLmStudioUrl(event.target.value)}
            placeholder="http://127.0.0.1:1234/v1"
          />
          <label className="settings-label" htmlFor="lm-studio-model">Model override</label>
          <input
            id="lm-studio-model"
            className="settings-input"
            type="text"
            value={lmStudioModel}
            onChange={(event) => setLmStudioModel(event.target.value)}
            placeholder="Leave empty to auto-detect"
          />
          <div className="settings-actions">
            <button
              type="button"
              onClick={() =>
                handleSaveProvider({
                  ...DEFAULT_LM_STUDIO_PROVIDER,
                  baseUrl: String(lmStudioUrl || "").trim(),
                  model: String(lmStudioModel || "").trim(),
                })}
              disabled={isSavingProvider || isLoading}
            >
              {isSavingProvider ? "Saving..." : "Save provider"}
            </button>
            <span className="settings-meta">
              {aiProviders.length} provider{aiProviders.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </>
    );
  };

  return (
    <main className="home-page settings-page">
      <section className="home-hero settings-hero">
        <div className="home-hero-copy">
          <div className="home-brand">
            <img className="home-brand-logo" src="/logo.png" alt="Settings" />
          </div>
          <h1>Settings</h1>
          <p className="home-subtitle">Manage AI providers and communication channel connections.</p>
          <div className="home-actions">
            <a className="home-secondary-link" href="/">Back to metacells</a>
          </div>
        </div>
      </section>

      <section className="home-card settings-card settings-layout">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSettingsTab === tab.id}
              className={`settings-tab-button${activeSettingsTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-panel" role="tabpanel">
          {renderSettingsPanel()}
        </div>
      </section>
    </main>
  );
}

function SheetPage({ sheetId, initialTabId, onOpenHelp }) {
  const appRef = useRef(null);
  const storageRef = useRef(null);
  const lastStorageJsonRef = useRef("");
  const [workbookName, setWorkbookName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    document.body.classList.add("route-sheet");
    document.body.classList.remove("route-home");

    return () => {
      document.body.classList.remove("route-sheet");
    };
  }, []);

  const { isLoading, sheet } = useTracker(() => {
    const handle = Meteor.subscribe("sheets.one", sheetId);

    return {
      isLoading: !handle.ready(),
      sheet: Sheets.findOne(sheetId),
    };
  }, [sheetId]);
  const sheetWorkbookJson = !isLoading && sheet ? JSON.stringify(decodeWorkbookDocument(sheet.workbook || {})) : "";

  useEffect(() => {
    if (!sheet) return;
    setWorkbookName(String(sheet.name || ""));
  }, [sheet && sheet.name]);

  const commitWorkbookRename = () => {
    if (!sheet || isRenaming) return;
    const nextName = String(workbookName || "").trim();
    const currentName = String(sheet.name || "");

    if (!nextName) {
      setWorkbookName(currentName);
      return;
    }

    if (nextName === currentName) return;

    setIsRenaming(true);
    Meteor.callAsync("sheets.rename", sheetId, nextName)
      .then(() => {
        setIsRenaming(false);
      })
      .catch((error) => {
        setIsRenaming(false);
        setWorkbookName(currentName);
        window.alert(error.reason || error.message || "Failed to rename metacell");
      });
  };

  useEffect(() => {
    if (isLoading || !sheet || appRef.current) return;

    const workbook = sheetWorkbookJson ? JSON.parse(sheetWorkbookJson) : {};
    storageRef.current = createSheetDocStorage(sheetId, workbook);
    lastStorageJsonRef.current = sheetWorkbookJson;
    appRef.current = mountSpreadsheetApp({
      storage: storageRef.current,
      sheetDocumentId: sheetId,
      initialSheetId: initialTabId,
      onActiveSheetChange: (nextTabId) => {
        const nextPath = nextTabId
          ? `/metacell/${encodeURIComponent(sheetId)}/${encodeURIComponent(nextTabId)}`
          : `/metacell/${encodeURIComponent(sheetId)}`;
        if (window.location.pathname !== nextPath) {
          window.history.replaceState({}, "", nextPath);
        }
      },
    });

    return () => {
      if (appRef.current && typeof appRef.current.destroy === "function") {
        appRef.current.destroy();
      }
      appRef.current = null;
      storageRef.current = null;
      lastStorageJsonRef.current = "";
    };
  }, [isLoading, sheetId]);

  useEffect(() => {
    if (!appRef.current || !initialTabId) return;
    if (typeof appRef.current.switchToSheet !== "function") return;
    if (typeof appRef.current.activeSheetId === "string" && appRef.current.activeSheetId === initialTabId) return;
    appRef.current.switchToSheet(initialTabId);
  }, [initialTabId]);

  useEffect(() => {
    if (isLoading || !sheet || !appRef.current || !storageRef.current) return;

    const nextWorkbookJson = sheetWorkbookJson;
    if (nextWorkbookJson === lastStorageJsonRef.current) return;
    if (typeof appRef.current.hasPendingLocalEdit === "function" && appRef.current.hasPendingLocalEdit()) return;

    lastStorageJsonRef.current = nextWorkbookJson;
    storageRef.current.replaceAll(nextWorkbookJson ? JSON.parse(nextWorkbookJson) : {});
    appRef.current.computeAll();
  }, [isLoading, sheet, sheetWorkbookJson]);

  if (isLoading) {
    return <main className="sheet-loading">Loading metacell...</main>;
  }

  if (!sheet) {
    return (
      <main className="sheet-loading">
        <p>Metacell not found.</p>
        <a href="/">Back to metacells</a>
      </main>
    );
  }

  return (
    <div className="sheet-page-shell">
      <div className="formula-bar">
        <a className="formula-home-link" href="/" aria-label="Home">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 10.5 12 4l8 6.5" />
            <path d="M7.5 9.5V20h9V9.5" />
          </svg>
        </a>
        <input
          id="workbook-name-input"
          type="text"
          value={workbookName}
          onChange={(event) => setWorkbookName(event.target.value)}
          onBlur={commitWorkbookRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setWorkbookName(String(sheet.name || ""));
              event.currentTarget.blur();
            }
          }}
          placeholder="Metacell name"
          disabled={isRenaming}
        />
        <input id="cell-name-input" type="text" placeholder="A1 or @name" />
        <select id="named-cell-jump" defaultValue="">
          <option value=""></option>
        </select>
        <label htmlFor="formula-input">fx</label>
        <input id="formula-input" type="text" placeholder="Edit active cell formula/value" />
        <button id="attach-file" type="button" aria-label="Attach file" title="Attach file">📎</button>
        <input id="attach-file-input" type="file" hidden />
        <span id="calc-progress" className="calc-progress" aria-live="polite"></span>
        <label htmlFor="ai-mode">AI</label>
        <select id="ai-mode" defaultValue="auto">
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
        <button id="undo-action" type="button" aria-label="Undo" title="Undo">⟲</button>
        <button id="redo-action" type="button" aria-label="Redo" title="Redo">⟳</button>
        <button id="update-ai" type="button">Update</button>
        <button type="button" className="help-button" onClick={onOpenHelp}>Help</button>
      </div>
      <div className="table-wrap">
        <table></table>
      </div>
      <div className="report-wrap" style={{ display: "none" }}>
        <div className="report-toolbar">
          <button type="button" className="report-mode active" data-report-mode="edit">Edit</button>
          <button type="button" className="report-mode" data-report-mode="view">View</button>
          <button type="button" className="report-cmd" data-cmd="bold"><b>B</b></button>
          <button type="button" className="report-cmd" data-cmd="italic"><i>I</i></button>
          <button type="button" className="report-cmd" data-cmd="underline"><u>U</u></button>
          <button type="button" className="report-cmd" data-cmd="insertUnorderedList">• List</button>
          <span className="report-hint">
            Mentions: <code>Sheet 1:A1</code>, <code>@named_cell</code>, region <code>@Sheet 1!A1:B10</code>. Inputs: <code>Input:Sheet 1!A1</code> or <code>Input:@named_cell</code>
          </span>
        </div>
        <div id="report-editor" className="report-editor" contentEditable suppressContentEditableWarning />
        <div id="report-live" className="report-live"></div>
      </div>
      <div className="tabs-bar">
        <div id="tabs"></div>
        <button id="add-tab" type="button"> + </button>
        <button id="delete-tab" type="button">Delete tab</button>
      </div>
    </div>
  );
}

export const App = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const path = window.location.pathname || "/";
  const metacellMatch = path.match(/^\/metacell\/([^/]+)(?:\/([^/]+))?$/);
  const legacySheetMatch = path.match(/^\/sheet\/([^/]+)(?:\/([^/]+))?$/);
  const sheetMatch = metacellMatch || legacySheetMatch;

  let page = <HomePage />;
  if (sheetMatch) {
    page = (
      <SheetPage
        sheetId={decodeURIComponent(sheetMatch[1])}
        initialTabId={sheetMatch[2] ? decodeURIComponent(sheetMatch[2]) : ""}
        onOpenHelp={() => setIsHelpOpen(true)}
      />
    );
  } else if (path === "/settings") {
    page = <SettingsPage />;
  }

  return (
    <>
      <HelpOverlay isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      {page}
    </>
  );
};
