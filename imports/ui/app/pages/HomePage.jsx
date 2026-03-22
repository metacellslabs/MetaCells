import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { useEffect, useState } from 'react';
import {
  AppSettings,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_SETTINGS_ID,
} from '../../../api/settings/index.js';
import { Sheets } from '../../../api/sheets/index.js';
import { AIProviderOnboardingPage } from '../components/settings/ProviderSettingsComponents.jsx';
import {
  buildProviderDrafts,
  getActiveProviderRecord,
  getProviderMissingFields,
  isProviderConfigured,
} from '../utils/settings-ui.js';

export function HomePage() {
  const registeredProviders = DEFAULT_AI_PROVIDERS;
  const defaultProviderId = String(
    (registeredProviders[0] && registeredProviders[0].id) || '',
  );
  const [activeOnboardingProviderId, setActiveOnboardingProviderId] =
    useState(defaultProviderId);
  const [providerDrafts, setProviderDrafts] = useState(() =>
    buildProviderDrafts(registeredProviders),
  );
  const [savingProviderId, setSavingProviderId] = useState('');
  const [isSavingActiveProvider, setIsSavingActiveProvider] = useState(false);
  const [isOnboardingHelpOpen, setIsOnboardingHelpOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('route-home');
    document.body.classList.remove('route-sheet');
    return () => {
      document.body.classList.remove('route-home');
    };
  }, []);

  const { isLoading, sheets, settings } = useTracker(() => {
    const handle = Meteor.subscribe('sheets.list');
    const settingsHandle = Meteor.subscribe('settings.default');
    return {
      isLoading: !handle.ready() || !settingsHandle.ready(),
      sheets: Sheets.find({}, { sort: { updatedAt: -1, createdAt: -1 } }).fetch(),
      settings: AppSettings.findOne(DEFAULT_SETTINGS_ID),
    };
  });

  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFormulaTest, setIsCreatingFormulaTest] = useState(false);
  const [isCreatingFinancialModel, setIsCreatingFinancialModel] = useState(false);
  const [deletingSheetId, setDeletingSheetId] = useState('');
  const [deleteSheetDialog, setDeleteSheetDialog] = useState(null);

  useEffect(() => {
    const providers = Array.isArray(settings && settings.aiProviders)
      ? settings.aiProviders
      : [];
    const activeProvider = getActiveProviderRecord(settings, registeredProviders);
    setProviderDrafts(buildProviderDrafts(registeredProviders, providers));
    setActiveOnboardingProviderId(
      String((activeProvider && activeProvider.id) || defaultProviderId),
    );
  }, [
    defaultProviderId,
    registeredProviders,
    settings && settings.updatedAt ? new Date(settings.updatedAt).getTime() : 0,
  ]);

  const handleProviderDraftChange = (providerId, fieldKey, value) => {
    setProviderDrafts((current) => ({
      ...current,
      [providerId]: {
        ...(current[providerId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleCompleteOnboarding = () => {
    if (savingProviderId || isSavingActiveProvider || !activeOnboardingProviderId) return;
    const draft = providerDrafts[activeOnboardingProviderId];
    if (!draft) return;
    const nextProvider = {
      id: String(draft.id || '').trim(),
      name: String(draft.name || '').trim(),
      type: String(draft.type || '').trim(),
      baseUrl: String(draft.baseUrl || '').trim(),
      model: String(draft.model || '').trim(),
      apiKey: String(draft.apiKey || '').trim(),
      enabled: draft.enabled !== false,
    };
    const missingFields = getProviderMissingFields(nextProvider);
    if (missingFields.length) {
      window.alert(`Fill in required provider settings: ${missingFields.join(', ')}`);
      return;
    }
    setSavingProviderId(activeOnboardingProviderId);
    setIsSavingActiveProvider(true);
    Meteor.callAsync('settings.upsertAIProvider', nextProvider)
      .then(() =>
        Meteor.callAsync('settings.setActiveAIProvider', activeOnboardingProviderId),
      )
      .then(() => {
        setSavingProviderId('');
        setIsSavingActiveProvider(false);
      })
      .catch((error) => {
        setSavingProviderId('');
        setIsSavingActiveProvider(false);
        window.alert(error.reason || error.message || 'Failed to save AI provider');
      });
  };

  const handleCreateSheet = () => {
    if (isCreating) return;
    setIsCreating(true);
    Meteor.callAsync('sheets.create')
      .then((sheetId) => {
        setIsCreating(false);
        window.location.assign(`/metacell/${sheetId}`);
      })
      .catch((error) => {
        setIsCreating(false);
        window.alert(error.reason || error.message || 'Failed to create metacell');
      });
  };

  const handleDeleteSheet = (sheetId, sheetName) => {
    if (deletingSheetId) return;
    setDeleteSheetDialog({
      sheetId: String(sheetId || ''),
      sheetName: String(sheetName || ''),
    });
  };

  const confirmDeleteSheet = () => {
    if (!deleteSheetDialog || deletingSheetId) return;
    const targetSheetId = deleteSheetDialog.sheetId;
    setDeletingSheetId(targetSheetId);
    setDeleteSheetDialog(null);
    Meteor.callAsync('sheets.remove', targetSheetId)
      .then(() => setDeletingSheetId(''))
      .catch((error) => {
        setDeletingSheetId('');
        window.alert(error.reason || error.message || 'Failed to delete metacell');
      });
  };

  const handleCreateFormulaTestSheet = () => {
    if (isCreatingFormulaTest) return;
    setIsCreatingFormulaTest(true);
    Meteor.callAsync('sheets.createFormulaTestWorkbook')
      .then((sheetId) => {
        setIsCreatingFormulaTest(false);
        window.location.assign(`/metacell/${sheetId}`);
      })
      .catch((error) => {
        setIsCreatingFormulaTest(false);
        window.alert(error.reason || error.message || 'Failed to create formula test metacell');
      });
  };

  const handleCreateFinancialModelSheet = () => {
    if (isCreatingFinancialModel) return;
    setIsCreatingFinancialModel(true);
    Meteor.callAsync('sheets.createFinancialModelWorkbook')
      .then((sheetId) => {
        setIsCreatingFinancialModel(false);
        window.location.assign(`/metacell/${sheetId}`);
      })
      .catch((error) => {
        setIsCreatingFinancialModel(false);
        window.alert(error.reason || error.message || 'Failed to create financial model metacell');
      });
  };

  const activeProvider = getActiveProviderRecord(settings, registeredProviders);
  const onboardingProviderId = String(
    activeOnboardingProviderId ||
      (activeProvider && activeProvider.id) ||
      defaultProviderId,
  );
  const onboardingProvider =
    registeredProviders.find((provider) => provider.id === onboardingProviderId) ||
    registeredProviders[0] ||
    null;
  const onboardingDraft = providerDrafts[onboardingProviderId] || onboardingProvider || {};
  const showOnboarding = !isLoading && !isProviderConfigured(activeProvider);

  if (showOnboarding) {
    return (
      <AIProviderOnboardingPage
        provider={onboardingProvider}
        draft={onboardingDraft}
        selectedProviderId={onboardingProviderId}
        registeredProviders={registeredProviders}
        isSaving={Boolean(savingProviderId) || isSavingActiveProvider}
        isLoading={isLoading}
        isHelpOpen={isOnboardingHelpOpen}
        onToggleHelp={() => setIsOnboardingHelpOpen((current) => !current)}
        onSelectProvider={(providerId) => {
          setActiveOnboardingProviderId(providerId);
          setIsOnboardingHelpOpen(false);
        }}
        onDraftChange={handleProviderDraftChange}
        onSave={handleCompleteOnboarding}
      />
    );
  }

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="home-brand">
            <img className="home-brand-logo" src="/logo.png" alt="MetaCells" />
          </div>
          <h1>Cells that work for you.</h1>
          <p className="home-subtitle">
            Create smart spreadsheets where cells can think, calculate, and help
            complete tasks automatically. Built-in AI agents can analyze data,
            generate content, and perform tasks right inside your sheet.
          </p>
          <div className="home-actions">
            <button
              type="button"
              className="home-create-button"
              onClick={handleCreateSheet}
              disabled={isCreating}
            >
              {isCreating ? 'Creating...' : 'Add metacell'}
            </button>
            <button
              type="button"
              className="home-secondary-button"
              onClick={handleCreateFormulaTestSheet}
              disabled={isCreatingFormulaTest}
            >
              {isCreatingFormulaTest ? 'Building test sheet...' : 'Create formula test'}
            </button>
            <button
              type="button"
              className="home-secondary-button"
              onClick={handleCreateFinancialModelSheet}
              disabled={isCreatingFinancialModel}
            >
              {isCreatingFinancialModel ? 'Building model...' : 'Create financial model'}
            </button>
            <a className="home-secondary-link" href="/settings">
              Settings
            </a>
            <span className="home-meta">
              {isLoading
                ? 'Loading metacells...'
                : `${sheets.length} metacell${sheets.length === 1 ? '' : 's'}`}
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
            <p className="home-empty-note">
              Start with a blank metacell and the app will create a persistent document for it.
            </p>
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
                    <span className="sheet-list-arrow" aria-hidden="true">
                      →
                    </span>
                  </div>
                </a>
                <button
                  type="button"
                  className="sheet-list-delete"
                  onClick={() => handleDeleteSheet(sheet._id, sheet.name)}
                  disabled={deletingSheetId === sheet._id}
                  aria-label={`Delete ${sheet.name}`}
                >
                  {deletingSheetId === sheet._id ? '...' : '×'}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
      {deleteSheetDialog ? (
        <div
          className="app-dialog-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDeleteSheetDialog(null);
          }}
        >
          <div
            className="app-dialog-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-sheet-dialog-title"
          >
            <div className="app-dialog-header">
              <h2 id="delete-sheet-dialog-title" className="app-dialog-title">
                Delete metacell?
              </h2>
              <p className="app-dialog-description">
                This will permanently remove "{deleteSheetDialog.sheetName}".
              </p>
            </div>
            <div className="app-dialog-actions">
              <button
                type="button"
                className="app-dialog-button"
                onClick={() => setDeleteSheetDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="app-dialog-button app-dialog-button-primary is-danger"
                onClick={confirmDeleteSheet}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
