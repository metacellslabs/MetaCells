import { getProviderMissingFields, isProviderConfigured } from '../../utils/settings-ui.js';

export function ProviderCredentialHelp({
  provider,
  onToggle,
  isOpen = false,
  toggleLabelPrefix = 'Credential help for',
}) {
  const source = provider && typeof provider === 'object' ? provider : null;
  if (!source) return null;
  const hasCredentialHelp =
    (Array.isArray(source.credentialSteps) &&
      source.credentialSteps.length > 0) ||
    (Array.isArray(source.credentialLinks) && source.credentialLinks.length > 0);
  if (!hasCredentialHelp) return null;
  return (
    <button
      type="button"
      className="settings-help-toggle"
      aria-label={`${toggleLabelPrefix} ${source.name}`}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      ?
    </button>
  );
}

export function ProviderCredentialHelpPanel({ provider, isOpen }) {
  const source = provider && typeof provider === 'object' ? provider : null;
  if (!source || !isOpen) return null;
  const hasCredentialHelp =
    (Array.isArray(source.credentialSteps) &&
      source.credentialSteps.length > 0) ||
    (Array.isArray(source.credentialLinks) && source.credentialLinks.length > 0);
  if (!hasCredentialHelp) return null;
  return (
    <div className="settings-help-panel">
      {source.credentialSteps && source.credentialSteps.length ? (
        <ol className="settings-help-steps">
          {source.credentialSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
      {source.credentialLinks && source.credentialLinks.length ? (
        <div className="settings-help-links">
          {source.credentialLinks.map((link) => (
            <a
              key={`${source.id}-${link.url}`}
              className="settings-help-link"
              href={link.url}
              target="_blank"
              rel="noreferrer"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProviderFields({ provider, draft, onChange }) {
  if (!provider || !Array.isArray(provider.fields)) return null;
  return (
    <>
      {provider.fields.map((field) => (
        <div key={field.key} className="settings-field">
          <label
            className="settings-label"
            htmlFor={`${provider.id}-${field.key}`}
          >
            {field.label}
          </label>
          <input
            id={`${provider.id}-${field.key}`}
            className="settings-input"
            type={field.type || 'text'}
            value={String((draft && draft[field.key]) || '')}
            onChange={(event) => onChange(field.key, event.target.value)}
            placeholder={field.placeholder || ''}
          />
        </div>
      ))}
      {provider.availableModels && provider.availableModels.length ? (
        <p className="settings-provider-note">
          Models: {provider.availableModels.join(', ')}
        </p>
      ) : null}
    </>
  );
}

export function AIProviderOnboardingPage({
  provider,
  draft,
  selectedProviderId,
  registeredProviders,
  isSaving,
  isLoading,
  isHelpOpen,
  onToggleHelp,
  onSelectProvider,
  onDraftChange,
  onSave,
}) {
  const missingFields = getProviderMissingFields(draft || provider);
  return (
    <main className="home-page onboarding-page">
      <section className="home-card onboarding-card">
        <div className="onboarding-copy">
          <div className="home-brand">
            <img className="home-brand-logo" src="/logo.png" alt="MetaCells" />
          </div>
          <span className="onboarding-eyebrow">AI setup required</span>
          <h1>Set up your default AI provider</h1>
          <p className="home-subtitle onboarding-subtitle">
            MetaCells detected that the default AI provider is not configured.
            Choose a provider, enter the connection parameters, and continue to
            the app.
          </p>
        </div>

        <div className="settings-provider-card onboarding-provider-card">
          <div className="settings-provider-head">
            <div className="settings-provider-title">
              <strong>{provider?.name || 'Provider'}</strong>
              <ProviderCredentialHelp
                provider={provider}
                isOpen={isHelpOpen}
                onToggle={onToggleHelp}
                toggleLabelPrefix="Setup help for"
              />
            </div>
            <span className="settings-status">
              {isProviderConfigured(draft || provider)
                ? 'Ready'
                : missingFields.length
                  ? `Missing: ${missingFields.join(', ')}`
                  : 'Needs setup'}
            </span>
          </div>
          <ProviderCredentialHelpPanel provider={provider} isOpen={isHelpOpen} />

          <div className="settings-field">
            <label className="settings-label" htmlFor="onboarding-provider-id">
              Provider type
            </label>
            <select
              id="onboarding-provider-id"
              className="settings-input"
              value={selectedProviderId}
              onChange={(event) => onSelectProvider(event.target.value)}
              disabled={isSaving || isLoading}
            >
              {registeredProviders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <ProviderFields
            provider={provider}
            draft={draft}
            onChange={(fieldKey, value) =>
              onDraftChange(selectedProviderId, fieldKey, value)
            }
          />

          <div className="settings-actions">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Saving...' : 'Save and continue'}
            </button>
            <a className="home-secondary-link" href="/settings">
              Open full settings
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
