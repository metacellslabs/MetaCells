import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { useEffect, useState } from 'react';
import {
  AppSettings,
  DEFAULT_AI_PROVIDERS,
  DEFAULT_CHANNEL_CONNECTORS,
  DEFAULT_JOB_SETTINGS,
} from '../../../api/settings/index.js';
import {
  AIProviderOnboardingPage,
  ProviderCredentialHelp,
  ProviderCredentialHelpPanel,
  ProviderFields,
} from '../components/settings/ProviderSettingsComponents.jsx';
import {
  buildChannelDrafts,
  buildJobSettingsDraft,
  buildProviderDrafts,
  getActiveProviderRecord,
  readSettingsTabFromUrl,
} from '../utils/settings-ui.js';

export function SettingsPage() {
  const SETTINGS_TABS = [
    { id: 'ai', label: '🤖 AI Providers' },
    { id: 'channels', label: '📨 Channels' },
    { id: 'jobs', label: '🧱 Jobs' },
    { id: 'general', label: '⚙️ General' },
    { id: 'advanced', label: '🛠️ Advanced' },
  ];
  const SETTINGS_TAB_IDS = SETTINGS_TABS.map((tab) => tab.id);
  const registeredProviders = DEFAULT_AI_PROVIDERS;
  const registeredChannelConnectors = DEFAULT_CHANNEL_CONNECTORS;
  const defaultProviderId = String(
    (registeredProviders[0] && registeredProviders[0].id) || '',
  );
  const [activeSettingsTab, setActiveSettingsTab] = useState(() =>
    readSettingsTabFromUrl(SETTINGS_TAB_IDS),
  );
  const [activeProviderId, setActiveProviderId] = useState(defaultProviderId);
  const [openProviderHelpId, setOpenProviderHelpId] = useState('');
  const [providerDrafts, setProviderDrafts] = useState(() =>
    buildProviderDrafts(registeredProviders),
  );
  const [savingProviderId, setSavingProviderId] = useState('');
  const [isSavingActiveProvider, setIsSavingActiveProvider] = useState(false);
  const [addingChannel, setAddingChannel] = useState('');
  const [channelDrafts, setChannelDrafts] = useState({});
  const [savingChannelId, setSavingChannelId] = useState('');
  const [testingChannelId, setTestingChannelId] = useState('');
  const [pollingNow, setPollingNow] = useState(false);
  const [jobSettingsDraft, setJobSettingsDraft] = useState(() =>
    buildJobSettingsDraft(DEFAULT_JOB_SETTINGS),
  );
  const [savingJobSettings, setSavingJobSettings] = useState(false);

  useEffect(() => {
    document.body.classList.add('route-home');
    document.body.classList.remove('route-sheet');
    return () => {
      document.body.classList.remove('route-home');
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveSettingsTab(readSettingsTabFromUrl(SETTINGS_TAB_IDS));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const nextTab = SETTINGS_TAB_IDS.includes(activeSettingsTab)
      ? activeSettingsTab
      : SETTINGS_TAB_IDS[0];
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('tab') === nextTab) return;
    params.set('tab', nextTab);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
  }, [activeSettingsTab]);

  const { isLoading, settings } = useTracker(() => {
    const handle = Meteor.subscribe('settings.default');
    return {
      isLoading: !handle.ready(),
      settings: AppSettings.findOne(),
    };
  }, []);

  useEffect(() => {
    const providers = Array.isArray(settings && settings.aiProviders)
      ? settings.aiProviders
      : [];
    const channels = Array.isArray(settings && settings.communicationChannels)
      ? settings.communicationChannels
      : [];
    setActiveProviderId((settings && settings.activeAIProviderId) || defaultProviderId);
    setProviderDrafts(buildProviderDrafts(registeredProviders, providers));
    setChannelDrafts(buildChannelDrafts(registeredChannelConnectors, channels));
    setJobSettingsDraft(buildJobSettingsDraft(settings && settings.jobSettings));
  }, [
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

  const handleSaveProvider = (providerId) => {
    if (savingProviderId) return;
    const draft = providerDrafts[providerId];
    if (!draft) return;
    setSavingProviderId(providerId);
    Meteor.callAsync('settings.upsertAIProvider', {
      id: String(draft.id || '').trim(),
      name: String(draft.name || '').trim(),
      type: String(draft.type || '').trim(),
      baseUrl: String(draft.baseUrl || '').trim(),
      model: String(draft.model || '').trim(),
      apiKey: String(draft.apiKey || '').trim(),
      enabled: draft.enabled !== false,
    })
      .then(() => setSavingProviderId(''))
      .catch((error) => {
        setSavingProviderId('');
        window.alert(error.reason || error.message || 'Failed to save AI provider');
      });
  };

  const handleSaveActiveProvider = () => {
    if (isSavingActiveProvider || !activeProviderId) return;
    setIsSavingActiveProvider(true);
    Meteor.callAsync('settings.setActiveAIProvider', activeProviderId)
      .then(() => setIsSavingActiveProvider(false))
      .catch((error) => {
        setIsSavingActiveProvider(false);
        window.alert(error.reason || error.message || 'Failed to set active AI provider');
      });
  };

  const handleAddChannel = (connectorId) => {
    if (addingChannel) return;
    setAddingChannel(connectorId);
    Meteor.callAsync('settings.addCommunicationChannel', connectorId)
      .then(() => setAddingChannel(''))
      .catch((error) => {
        setAddingChannel('');
        window.alert(error.reason || error.message || 'Failed to add communication channel');
      });
  };

  const handleChannelDraftChange = (channelId, fieldKey, value, nestedKey) => {
    setChannelDrafts((current) => ({
      ...current,
      [channelId]: {
        ...(current[channelId] || {}),
        ...(nestedKey
          ? {
              [fieldKey]: {
                ...((current[channelId] && current[channelId][fieldKey]) || {}),
                [nestedKey]: value,
              },
            }
          : { [fieldKey]: value }),
      },
    }));
  };

  const handleSaveChannel = (channelId) => {
    if (savingChannelId) return;
    const draft = channelDrafts[channelId];
    if (!draft) return;
    setSavingChannelId(channelId);
    Meteor.callAsync('settings.upsertCommunicationChannel', {
      id: String(draft.id || ''),
      connectorId: String(draft.connectorId || ''),
      label: String(draft.label || '').trim(),
      enabled: draft.enabled !== false,
      settings: draft.settings || {},
    })
      .then(() => setSavingChannelId(''))
      .catch((error) => {
        setSavingChannelId('');
        window.alert(error.reason || error.message || 'Failed to save communication channel');
      });
  };

  const handleTestChannel = (channelId) => {
    if (testingChannelId) return;
    setTestingChannelId(channelId);
    Meteor.callAsync('settings.testCommunicationChannel', channelId)
      .then((result) => {
        setTestingChannelId('');
        if (result && result.message) window.alert(result.message);
      })
      .catch((error) => {
        setTestingChannelId('');
        window.alert(error.reason || error.message || 'Failed to test communication channel');
      });
  };

  const handlePollNow = () => {
    if (pollingNow) return;
    setPollingNow(true);
    Meteor.callAsync('channels.pollNow')
      .then((result) => {
        setPollingNow(false);
        const summary = result && typeof result === 'object' ? result : {};
        const total = Number(summary.total) || 0;
        const events = Number(summary.events) || 0;
        const failed = Number(summary.failed) || 0;
        const polled = Number(summary.polled) || 0;
        const details = Array.isArray(summary.results)
          ? summary.results
              .map((item) => {
                if (!item) return '';
                const label = String(item.label || item.channelId || 'channel');
                if (item.error) return `${label}: ${item.error}`;
                if (item.skipped) return `${label}: ${String(item.reason || 'skipped')}`;
                return `${label}: ${Number(item.events) || 0} event(s)`;
              })
              .filter(Boolean)
              .join('\n')
          : '';
        window.alert(
          `Poll complete.\nChannels: ${total}\nPolled: ${polled}\nNew events: ${events}\nFailed: ${failed}` +
            (details ? `\n\n${details}` : ''),
        );
      })
      .catch((error) => {
        setPollingNow(false);
        window.alert(error.reason || error.message || 'Failed to poll channels');
      });
  };

  const handleJobSettingsDraftChange = (fieldKey, value) => {
    setJobSettingsDraft((current) => ({
      ...current,
      [fieldKey]: value,
    }));
  };

  const handleSaveJobSettings = () => {
    if (savingJobSettings) return;
    setSavingJobSettings(true);
    Meteor.callAsync('settings.updateJobSettings', {
      workerEnabled: jobSettingsDraft.workerEnabled !== false,
      aiChatConcurrency:
        Number(jobSettingsDraft.aiChatConcurrency) ||
        DEFAULT_JOB_SETTINGS.aiChatConcurrency,
      aiChatMaxAttempts:
        Number(jobSettingsDraft.aiChatMaxAttempts) ||
        DEFAULT_JOB_SETTINGS.aiChatMaxAttempts,
      aiChatRetryDelayMs:
        Number(jobSettingsDraft.aiChatRetryDelayMs) ||
        DEFAULT_JOB_SETTINGS.aiChatRetryDelayMs,
      aiChatTimeoutMs:
        Number(jobSettingsDraft.aiChatTimeoutMs) ||
        DEFAULT_JOB_SETTINGS.aiChatTimeoutMs,
      aiChatLeaseTimeoutMs:
        Number(jobSettingsDraft.aiChatLeaseTimeoutMs) ||
        DEFAULT_JOB_SETTINGS.aiChatLeaseTimeoutMs,
      aiChatHeartbeatIntervalMs:
        Number(jobSettingsDraft.aiChatHeartbeatIntervalMs) ||
        DEFAULT_JOB_SETTINGS.aiChatHeartbeatIntervalMs,
      fileExtractConcurrency:
        Number(jobSettingsDraft.fileExtractConcurrency) ||
        DEFAULT_JOB_SETTINGS.fileExtractConcurrency,
      fileExtractMaxAttempts:
        Number(jobSettingsDraft.fileExtractMaxAttempts) ||
        DEFAULT_JOB_SETTINGS.fileExtractMaxAttempts,
      fileExtractRetryDelayMs:
        Number(jobSettingsDraft.fileExtractRetryDelayMs) ||
        DEFAULT_JOB_SETTINGS.fileExtractRetryDelayMs,
      fileExtractTimeoutMs:
        Number(jobSettingsDraft.fileExtractTimeoutMs) ||
        DEFAULT_JOB_SETTINGS.fileExtractTimeoutMs,
      fileExtractLeaseTimeoutMs:
        Number(jobSettingsDraft.fileExtractLeaseTimeoutMs) ||
        DEFAULT_JOB_SETTINGS.fileExtractLeaseTimeoutMs,
      fileExtractHeartbeatIntervalMs:
        Number(jobSettingsDraft.fileExtractHeartbeatIntervalMs) ||
        DEFAULT_JOB_SETTINGS.fileExtractHeartbeatIntervalMs,
    })
      .then(() => setSavingJobSettings(false))
      .catch((error) => {
        setSavingJobSettings(false);
        window.alert(error.reason || error.message || 'Failed to save job settings');
      });
  };

  const aiProviders = Array.isArray(settings && settings.aiProviders)
    ? settings.aiProviders
    : [];
  const communicationChannels = Array.isArray(settings && settings.communicationChannels)
    ? settings.communicationChannels
    : [];
  const activeProviderLabel = (
    aiProviders.find((provider) => provider && provider.id === activeProviderId) ||
    registeredProviders.find((provider) => provider && provider.id === activeProviderId) ||
    registeredProviders[0] || { name: 'None' }
  ).name;
  const configuredChannelsCount = communicationChannels.length;
  const configuredSecretsCount = Object.values(providerDrafts).filter(
    (provider) => String((provider && provider.apiKey) || '').trim(),
  ).length;

  const renderSettingsPanel = () => {
    if (activeSettingsTab === 'channels') {
      return (
        <>
          <div className="home-section-head">
            <h2>Communication Channels</h2>
          </div>
          <div className="settings-section-copy">
            <p>
              Connector files define settings schema, test/send behavior, event
              hooks, and formula mention patterns for each channel type.
            </p>
          </div>
          <div className="settings-channel-actions">
            <button
              type="button"
              onClick={handlePollNow}
              disabled={pollingNow || !communicationChannels.length}
            >
              {pollingNow ? 'Polling...' : 'Poll now'}
            </button>
            {registeredChannelConnectors.map((connector) => (
              <button
                key={connector.id}
                type="button"
                onClick={() => handleAddChannel(connector.id)}
                disabled={addingChannel === connector.id}
              >
                {addingChannel === connector.id ? 'Adding...' : `Add ${connector.name}`}
              </button>
            ))}
          </div>

          {!communicationChannels.length ? (
            <p className="home-empty-note">No communication channels added yet.</p>
          ) : (
            <div className="settings-channel-list">
              {communicationChannels.map((channel) => {
                const connector = registeredChannelConnectors.find(
                  (item) => item.id === channel.connectorId,
                );
                const draft = channelDrafts[channel.id] || {};
                const draftSettings = draft.settings || {};

                return (
                  <div key={channel.id} className="settings-provider-card">
                    <div className="settings-provider-head">
                      <strong>{draft.label || channel.label}</strong>
                      <span className="settings-status">{channel.status}</span>
                    </div>
                    <div className="settings-checkbox-row">
                      <label
                        className="settings-checkbox-label"
                        htmlFor={`channel-${channel.id}-enabled`}
                      >
                        <input
                          id={`channel-${channel.id}-enabled`}
                          type="checkbox"
                          checked={draft.enabled !== false}
                          onChange={(event) =>
                            handleChannelDraftChange(
                              channel.id,
                              'enabled',
                              event.target.checked,
                            )
                          }
                        />
                        <span>Enabled</span>
                      </label>
                    </div>
                    <div className="settings-field">
                      <label
                        className="settings-label"
                        htmlFor={`channel-${channel.id}-label`}
                      >
                        Channel label
                      </label>
                      <input
                        id={`channel-${channel.id}-label`}
                        className="settings-input"
                        type="text"
                        value={String(draft.label || channel.label || '')}
                        onChange={(event) =>
                          handleChannelDraftChange(
                            channel.id,
                            'label',
                            event.target.value,
                          )
                        }
                        placeholder="Channel label"
                      />
                    </div>
                    {(connector?.settingsFields || []).map((field) =>
                      field.key === 'label' ? null : (
                        <div key={field.key} className="settings-field">
                          <label
                            className="settings-label"
                            htmlFor={`channel-${channel.id}-${field.key}`}
                          >
                            {field.label}
                          </label>
                          {field.type === 'checkbox' ? (
                            <input
                              id={`channel-${channel.id}-${field.key}`}
                              type="checkbox"
                              checked={Boolean(draftSettings[field.key])}
                              onChange={(event) =>
                                handleChannelDraftChange(
                                  channel.id,
                                  'settings',
                                  event.target.checked,
                                  field.key,
                                )
                              }
                            />
                          ) : (
                            <input
                              id={`channel-${channel.id}-${field.key}`}
                              className="settings-input"
                              type={field.type === 'password' ? 'password' : 'text'}
                              value={String(draftSettings[field.key] ?? '')}
                              onChange={(event) =>
                                handleChannelDraftChange(
                                  channel.id,
                                  'settings',
                                  event.target.value,
                                  field.key,
                                )
                              }
                              placeholder={field.placeholder || ''}
                            />
                          )}
                        </div>
                      ),
                    )}
                    {connector ? (
                      <p className="settings-provider-note">
                        Mentioning: {connector.mentioningFormulas.join(' | ')}
                      </p>
                    ) : null}
                    <div className="settings-kv-list settings-kv-list-compact">
                      <div className="settings-kv-item">
                        <span className="settings-label">Last seen UID</span>
                        <strong>{draft.lastSeenUid || 0}</strong>
                      </div>
                      <div className="settings-kv-item">
                        <span className="settings-label">Last event at</span>
                        <strong>
                          {draft.lastEventAt
                            ? new Date(draft.lastEventAt).toLocaleString()
                            : 'Never'}
                        </strong>
                      </div>
                      <div className="settings-kv-item">
                        <span className="settings-label">Last polled at</span>
                        <strong>
                          {draft.lastPolledAt
                            ? new Date(draft.lastPolledAt).toLocaleString()
                            : 'Never'}
                        </strong>
                      </div>
                    </div>
                    {draft.lastEventPreview ? (
                      <div className="settings-channel-event">
                        <div className="settings-channel-event-head">Latest event</div>
                        {draft.lastEventId ? (
                          <p className="settings-provider-note">
                            Event ID: {draft.lastEventId}
                          </p>
                        ) : null}
                        <pre className="settings-channel-event-body">
                          {JSON.stringify(draft.lastEventPreview, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="settings-provider-note">No event received yet.</p>
                    )}
                    {draft.lastTestMessage ? (
                      <p className="settings-provider-note">{draft.lastTestMessage}</p>
                    ) : null}
                    {draft.watchError ? (
                      <p className="settings-provider-note settings-provider-note-error">
                        {draft.watchError}
                      </p>
                    ) : null}
                    <div className="settings-actions">
                      <button
                        type="button"
                        onClick={() => handleSaveChannel(channel.id)}
                        disabled={savingChannelId === channel.id}
                      >
                        {savingChannelId === channel.id ? 'Saving...' : 'Save channel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTestChannel(channel.id)}
                        disabled={testingChannelId === channel.id}
                      >
                        {testingChannelId === channel.id ? 'Testing...' : 'Test connection'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (activeSettingsTab === 'general') {
      return (
        <>
          <div className="home-section-head">
            <h2>General</h2>
          </div>
          <div className="settings-section-copy">
            <p>
              Overview of the current AI and communication setup stored in Mongo.
            </p>
          </div>
          <div className="settings-kv-list">
            <div className="settings-kv-item">
              <span className="settings-label">Default AI provider</span>
              <strong>{activeProviderLabel}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">Configured providers</span>
              <strong>{registeredProviders.length}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">Connected channels</span>
              <strong>{configuredChannelsCount}</strong>
            </div>
            <div className="settings-kv-item">
              <span className="settings-label">Providers with API keys</span>
              <strong>{configuredSecretsCount}</strong>
            </div>
          </div>
        </>
      );
    }

    if (activeSettingsTab === 'jobs') {
      return (
        <>
          <div className="home-section-head">
            <h2>Jobs</h2>
          </div>
          <div className="settings-section-copy">
            <p>
              Durable server jobs back AI calls and file conversion. These
              settings are stored in Mongo and are designed to map cleanly to a
              future external broker.
            </p>
          </div>
          <div className="settings-provider-card">
            <div className="settings-provider-head">
              <strong>Worker control</strong>
              <span className="settings-status">
                {jobSettingsDraft.workerEnabled ? 'Enabled' : 'Paused'}
              </span>
            </div>
            <div className="settings-checkbox-row">
              <label className="settings-checkbox-label" htmlFor="job-settings-worker-enabled">
                <input
                  id="job-settings-worker-enabled"
                  type="checkbox"
                  checked={jobSettingsDraft.workerEnabled !== false}
                  onChange={(event) =>
                    handleJobSettingsDraftChange('workerEnabled', event.target.checked)
                  }
                />
                <span>Enable durable job worker</span>
              </label>
            </div>
            <p className="settings-provider-note">
              If disabled, queued jobs stay persisted in Mongo and will resume
              when the worker is re-enabled.
            </p>
          </div>

          <div className="settings-provider-card">
            <div className="settings-provider-head">
              <strong>AI jobs</strong>
              <span className="settings-status">applies to server AI queue</span>
            </div>
            <div className="settings-field-grid">
              {[
                ['ai-concurrency', 'Concurrency', 'aiChatConcurrency', '1', '1'],
                ['ai-attempts', 'Max attempts', 'aiChatMaxAttempts', '1', '1'],
                ['ai-delay', 'Retry delay ms', 'aiChatRetryDelayMs', '250', '250'],
                ['ai-timeout', 'Timeout ms', 'aiChatTimeoutMs', '1000', '1000'],
                ['ai-lease', 'Lease timeout ms', 'aiChatLeaseTimeoutMs', '1000', '1000'],
                ['ai-heartbeat', 'Heartbeat ms', 'aiChatHeartbeatIntervalMs', '500', '500'],
              ].map(([id, label, key, min, step]) => (
                <div key={id} className="settings-field">
                  <label className="settings-label" htmlFor={`job-settings-${id}`}>
                    {label}
                  </label>
                  <input
                    id={`job-settings-${id}`}
                    className="settings-input"
                    type="number"
                    min={min}
                    step={step}
                    value={String(jobSettingsDraft[key])}
                    onChange={(event) =>
                      handleJobSettingsDraftChange(key, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="settings-provider-card">
            <div className="settings-provider-head">
              <strong>File extraction jobs</strong>
              <span className="settings-status">applies to converter jobs</span>
            </div>
            <div className="settings-field-grid">
              {[
                ['file-concurrency', 'Concurrency', 'fileExtractConcurrency', '1', '1'],
                ['file-attempts', 'Max attempts', 'fileExtractMaxAttempts', '1', '1'],
                ['file-delay', 'Retry delay ms', 'fileExtractRetryDelayMs', '250', '250'],
                ['file-timeout', 'Timeout ms', 'fileExtractTimeoutMs', '1000', '1000'],
                ['file-lease', 'Lease timeout ms', 'fileExtractLeaseTimeoutMs', '1000', '1000'],
                ['file-heartbeat', 'Heartbeat ms', 'fileExtractHeartbeatIntervalMs', '500', '500'],
              ].map(([id, label, key, min, step]) => (
                <div key={id} className="settings-field">
                  <label className="settings-label" htmlFor={`job-settings-${id}`}>
                    {label}
                  </label>
                  <input
                    id={`job-settings-${id}`}
                    className="settings-input"
                    type="number"
                    min={min}
                    step={step}
                    value={String(jobSettingsDraft[key])}
                    onChange={(event) =>
                      handleJobSettingsDraftChange(key, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
            <div className="settings-actions">
              <button
                type="button"
                onClick={handleSaveJobSettings}
                disabled={savingJobSettings}
              >
                {savingJobSettings ? 'Saving...' : 'Save job settings'}
              </button>
            </div>
          </div>
        </>
      );
    }

    if (activeSettingsTab === 'advanced') {
      return (
        <>
          <div className="home-section-head">
            <h2>Advanced</h2>
          </div>
          <div className="settings-section-copy">
            <p>
              Raw provider diagnostics and saved endpoints for debugging
              server-side AI calls.
            </p>
          </div>
          <div className="settings-kv-list">
            {registeredProviders.map((provider) => {
              const draft = providerDrafts[provider.id] || provider;
              return (
                <div key={provider.id} className="settings-kv-item">
                  <span className="settings-label">{provider.name}</span>
                  <strong>{draft.baseUrl || draft.model || 'Not configured'}</strong>
                </div>
              );
            })}
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
          <p>
            Current provider configuration is stored in Mongo and used by
            server-side AI requests.
          </p>
        </div>

        <div className="settings-provider-card">
          <div className="settings-provider-head">
            <strong>Default provider</strong>
            <span className="settings-status">
              {isLoading ? 'Loading...' : 'Saved in DB'}
            </span>
          </div>
          <label className="settings-label" htmlFor="active-provider-id">
            Active AI provider
          </label>
          <select
            id="active-provider-id"
            className="settings-input"
            value={activeProviderId}
            onChange={(event) => setActiveProviderId(event.target.value)}
          >
            {registeredProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <div className="settings-actions">
            <button
              type="button"
              onClick={handleSaveActiveProvider}
              disabled={isSavingActiveProvider || isLoading}
            >
              {isSavingActiveProvider ? 'Saving...' : 'Set default provider'}
            </button>
            <span className="settings-meta">Current: {activeProviderLabel}</span>
          </div>
        </div>

        {registeredProviders.map((provider) => {
          const draft = providerDrafts[provider.id] || provider;
          const isActive = activeProviderId === provider.id;
          const isHelpOpen = openProviderHelpId === provider.id;
          return (
            <div key={provider.id} className="settings-provider-card">
              <div className="settings-provider-head">
                <div className="settings-provider-title">
                  <strong>{provider.name}</strong>
                  <ProviderCredentialHelp
                    provider={provider}
                    isOpen={isHelpOpen}
                    onToggle={() =>
                      setOpenProviderHelpId((current) =>
                        current === provider.id ? '' : provider.id,
                      )
                    }
                  />
                </div>
                <span className="settings-status">
                  {isActive ? 'Default' : isLoading ? 'Loading...' : 'Available'}
                </span>
              </div>
              <ProviderCredentialHelpPanel provider={provider} isOpen={isHelpOpen} />
              <ProviderFields
                provider={provider}
                draft={draft}
                onChange={(fieldKey, value) =>
                  handleProviderDraftChange(provider.id, fieldKey, value)
                }
              />
              <div className="settings-actions">
                <button
                  type="button"
                  onClick={() => handleSaveProvider(provider.id)}
                  disabled={Boolean(savingProviderId) || isLoading}
                >
                  {savingProviderId === provider.id ? 'Saving...' : 'Save provider'}
                </button>
              </div>
            </div>
          );
        })}
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
          <p className="home-subtitle">
            Manage AI providers and communication channel connections.
          </p>
          <div className="home-actions">
            <a className="home-secondary-link" href="/">
              ← Back
            </a>
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
              className={`settings-tab-button${activeSettingsTab === tab.id ? ' active' : ''}`}
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
