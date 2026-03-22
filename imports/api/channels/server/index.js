import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { getRegisteredChannelConnectorById } from '../connectors/index.js';
import {
  AppSettings,
  DEFAULT_SETTINGS_ID,
  ensureDefaultSettings,
} from '../../settings/index.js';
import { registerAIQueueSheetRuntimeHooks } from '../../ai/index.js';
import { normalizeChannelLabel } from '../mentioning.js';
import { getActiveChannelPayloadMap } from '../runtime-state.js';
import {
  buildNormalizedChannels,
  findConfiguredChannelById,
  findConfiguredChannelByLabel,
  getChannelHandler,
  isChannelPollingWorkerStarted,
  logChannelRuntime,
  migrateLegacyChannelEvents,
  normalizeChannelSettings,
  pollEnabledChannels,
  startChannelPollingWorker,
} from './channel-polling-runtime.js';
import { searchChannelEventHistory } from './channel-search-runtime.js';

if (Meteor.isServer) {
  registerAIQueueSheetRuntimeHooks({
    loadChannelPayloads: async () => getActiveChannelPayloadMap(),
  });

  Meteor.startup(() => {
    migrateLegacyChannelEvents().catch((error) => {
      logChannelRuntime('legacy.events.migration_failed', {
        message: error && error.message ? error.message : String(error),
      });
    });
  });

  Meteor.methods({
    async 'settings.upsertCommunicationChannel'(channel) {
      check(channel, {
        id: String,
        connectorId: String,
        label: String,
        enabled: Boolean,
        settings: Match.Maybe(Object),
      });

      await ensureDefaultSettings();

      const connector = getRegisteredChannelConnectorById(channel.connectorId);
      if (!connector) {
        throw new Meteor.Error(
          'channel-connector-not-found',
          'Channel connector not found',
        );
      }

      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const nextChannels = Array.isArray(
        current && current.communicationChannels,
      )
        ? [...current.communicationChannels]
        : [];
      const existingChannel =
        nextChannels.find((item) => item && item.id === channel.id) || null;

      const normalizedChannel = {
        id: String(channel.id || ''),
        connectorId: connector.id,
        type: connector.type,
        label: String(channel.label || connector.name).trim(),
        enabled: channel.enabled !== false,
        status:
          existingChannel && existingChannel.status
            ? existingChannel.status
            : 'saved',
        settings: normalizeChannelSettings(connector, channel.settings),
        lastTestMessage: String(
          (existingChannel && existingChannel.lastTestMessage) || '',
        ),
        lastTestAt:
          existingChannel && existingChannel.lastTestAt
            ? existingChannel.lastTestAt
            : null,
        lastSeenUid:
          Number(existingChannel && existingChannel.lastSeenUid) || 0,
        lastEventId: String(
          (existingChannel && existingChannel.lastEventId) || '',
        ),
        lastEventPreview:
          existingChannel &&
          existingChannel.lastEventPreview &&
          typeof existingChannel.lastEventPreview === 'object'
            ? { ...existingChannel.lastEventPreview }
            : null,
        lastEventAt:
          existingChannel && existingChannel.lastEventAt
            ? existingChannel.lastEventAt
            : null,
        lastPolledAt:
          existingChannel && existingChannel.lastPolledAt
            ? existingChannel.lastPolledAt
            : null,
        watchError: String(
          (existingChannel && existingChannel.watchError) || '',
        ),
        createdAt:
          existingChannel && existingChannel.createdAt
            ? existingChannel.createdAt
            : new Date(),
        updatedAt: new Date(),
      };

      const index = nextChannels.findIndex(
        (item) => item && item.id === normalizedChannel.id,
      );
      if (index === -1) nextChannels.push(normalizedChannel);
      else
        nextChannels[index] = { ...nextChannels[index], ...normalizedChannel };

      await AppSettings.updateAsync(
        { _id: DEFAULT_SETTINGS_ID },
        {
          $set: {
            communicationChannels: nextChannels,
            updatedAt: new Date(),
          },
        },
      );
    },

    async 'channels.pollNow'() {
      logChannelRuntime('pollNow.called', { userId: this.userId || null });
      return pollEnabledChannels();
    },

    async 'settings.testCommunicationChannel'(channelId) {
      check(channelId, String);

      await ensureDefaultSettings();
      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const channels = Array.isArray(current && current.communicationChannels)
        ? current.communicationChannels
        : [];
      const channel = channels.find((item) => item && item.id === channelId);
      if (!channel) {
        throw new Meteor.Error(
          'channel-not-found',
          'Communication channel not found',
        );
      }

      const connector = getRegisteredChannelConnectorById(channel.connectorId);
      if (!connector) {
        throw new Meteor.Error(
          'channel-connector-not-found',
          'Channel connector not found',
        );
      }

      const handler = getChannelHandler(connector.id);
      try {
        const result = await handler.testConnection({
          channel,
          settings: normalizeChannelSettings(connector, channel.settings),
        });

        await AppSettings.updateAsync(
          { _id: DEFAULT_SETTINGS_ID, 'communicationChannels.id': channelId },
          {
            $set: {
              'communicationChannels.$.status':
                result && result.ok ? 'connected' : 'error',
              'communicationChannels.$.lastTestAt': new Date(),
              'communicationChannels.$.lastTestMessage': String(
                (result && result.message) || '',
              ),
              updatedAt: new Date(),
            },
          },
        );

        return result;
      } catch (error) {
        const message = String(
          (error && (error.reason || error.message)) ||
            'Failed to connect to communication channel',
        ).trim();

        await AppSettings.updateAsync(
          { _id: DEFAULT_SETTINGS_ID, 'communicationChannels.id': channelId },
          {
            $set: {
              'communicationChannels.$.status': 'error',
              'communicationChannels.$.lastTestAt': new Date(),
              'communicationChannels.$.lastTestMessage': message,
              updatedAt: new Date(),
            },
          },
        );

        throw new Meteor.Error('channel-test-failed', message);
      }
    },

    async 'channels.send'(channelId, payload) {
      check(channelId, String);
      check(
        payload,
        Match.Where(
          (value) =>
            !!value && typeof value === 'object' && !Array.isArray(value),
        ),
      );

      await ensureDefaultSettings();
      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const channels = Array.isArray(current && current.communicationChannels)
        ? current.communicationChannels
        : [];
      const channel = findConfiguredChannelById(channels, channelId);
      if (!channel) {
        throw new Meteor.Error(
          'channel-not-found',
          'Communication channel not found',
        );
      }

      const connector = getRegisteredChannelConnectorById(channel.connectorId);
      if (!connector) {
        throw new Meteor.Error(
          'channel-connector-not-found',
          'Channel connector not found',
        );
      }

      const handler = getChannelHandler(channel.connectorId);
      if (typeof handler.send !== 'function') {
        throw new Meteor.Error(
          'channel-send-not-supported',
          `Channel ${String(channel.connectorId || '')} does not support send actions`,
        );
      }
      return handler.send({
        channel,
        settings: normalizeChannelSettings(connector, channel.settings),
        payload: {
          ...payload,
          to: Array.isArray(payload.to) ? payload.to : [],
          subj: String(payload.subj || ''),
          body: String(payload.body || ''),
          attachments: Array.isArray(payload.attachments)
            ? payload.attachments
            : [],
        },
      });
    },

    async 'channels.sendByLabel'(label, payload) {
      check(label, String);
      check(
        payload,
        Match.Where(
          (value) =>
            !!value && typeof value === 'object' && !Array.isArray(value),
        ),
      );

      await ensureDefaultSettings();
      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const channels = Array.isArray(current && current.communicationChannels)
        ? current.communicationChannels
        : [];
      const channel = findConfiguredChannelByLabel(channels, label);
      if (!channel) {
        throw new Meteor.Error(
          'channel-not-found',
          `Communication channel "/${normalizeChannelLabel(label)}" not found`,
        );
      }

      const connector = getRegisteredChannelConnectorById(channel.connectorId);
      if (!connector) {
        throw new Meteor.Error(
          'channel-connector-not-found',
          'Channel connector not found',
        );
      }

      const handler = getChannelHandler(channel.connectorId);
      if (typeof handler.send !== 'function') {
        throw new Meteor.Error(
          'channel-send-not-supported',
          `Channel ${String(channel.connectorId || '')} does not support send actions`,
        );
      }
      return handler.send({
        channel,
        settings: normalizeChannelSettings(connector, channel.settings),
        payload: {
          ...payload,
          to: Array.isArray(payload.to) ? payload.to : [],
          subj: String(payload.subj || ''),
          body: String(payload.body || ''),
          attachments: Array.isArray(payload.attachments)
            ? payload.attachments
            : [],
        },
      });
    },

    async 'channels.search'(channelId, query, options) {
      check(channelId, String);
      check(query, Match.Maybe(String));
      check(options, Match.Maybe(Object));

      await ensureDefaultSettings();
      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const channels = Array.isArray(current && current.communicationChannels)
        ? current.communicationChannels
        : [];
      const channel = findConfiguredChannelById(channels, channelId);
      if (!channel) {
        throw new Meteor.Error(
          'channel-not-found',
          'Communication channel not found',
        );
      }
      const connector = getRegisteredChannelConnectorById(channel.connectorId);
      if (!connector) {
        throw new Meteor.Error(
          'channel-connector-not-found',
          'Channel connector not found',
        );
      }
      const handler = getChannelHandler(channel.connectorId);
      if (handler && typeof handler.search === 'function') {
        const result = await handler.search({
          channel,
          settings: normalizeChannelSettings(connector, channel.settings),
          query: String(query || ''),
          options: normalizeSearchOptions(options),
        });
        if (result && result.source && result.source !== 'none') {
          return result;
        }
      }
      if (connector.supportsReceive !== false) {
        return searchChannelEventHistory(channel, query, options);
      }
      return {
        ok: true,
        query: String(query || ''),
        source: 'none',
        total: 0,
        items: [],
      };
    },

    async 'channels.searchByLabel'(label, query, options) {
      check(label, String);
      check(query, Match.Maybe(String));
      check(options, Match.Maybe(Object));

      await ensureDefaultSettings();
      const current = await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID);
      const channels = Array.isArray(current && current.communicationChannels)
        ? current.communicationChannels
        : [];
      const channel = findConfiguredChannelByLabel(channels, label);
      if (!channel) {
        throw new Meteor.Error(
          'channel-not-found',
          `Communication channel "/${normalizeChannelLabel(label)}" not found`,
        );
      }
      const connector = getRegisteredChannelConnectorById(channel.connectorId);
      if (!connector) {
        throw new Meteor.Error(
          'channel-connector-not-found',
          'Channel connector not found',
        );
      }
      const handler = getChannelHandler(channel.connectorId);
      if (handler && typeof handler.search === 'function') {
        const result = await handler.search({
          channel,
          settings: normalizeChannelSettings(connector, channel.settings),
          query: String(query || ''),
          options: normalizeSearchOptions(options),
        });
        if (result && result.source && result.source !== 'none') {
          return result;
        }
      }
      if (connector.supportsReceive !== false) {
        return searchChannelEventHistory(channel, query, options);
      }
      return {
        ok: true,
        query: String(query || ''),
        source: 'none',
        total: 0,
        items: [],
      };
    },
  });
}
