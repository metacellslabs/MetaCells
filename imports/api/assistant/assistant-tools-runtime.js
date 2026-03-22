import { Match, check } from 'meteor/check';

const assistantToolRegistry = [];

function normalizeToolSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function registerAssistantTool(definition) {
  if (!definition || typeof definition !== 'object' || !definition.name) {
    throw new Error('Assistant tool definition requires a name');
  }
  assistantToolRegistry.push(definition);
}

export function getRegisteredAssistantTools() {
  return assistantToolRegistry.slice();
}

export function buildStaticAssistantToolsManifest(isPlainObject) {
  return getRegisteredAssistantTools().map((tool) => ({
    name: String(tool.name || ''),
    description: String(tool.description || ''),
    args: isPlainObject(tool.args) ? tool.args : {},
    mutatesWorkbook: tool.mutatesWorkbook !== false,
    capabilityTags: Array.isArray(tool.capabilityTags)
      ? tool.capabilityTags.slice()
      : [],
  }));
}

export function buildDynamicChannelToolsManifest(channels) {
  const seenToolNames = {};
  return (Array.isArray(channels) ? channels : []).flatMap((channel) => {
    if (
      !channel ||
      !Array.isArray(channel.configuredChannels) ||
      !channel.configuredChannels.length
    ) {
      return [];
    }
    return channel.configuredChannels
      .filter((configured) => configured && configured.enabled !== false)
      .flatMap((configured) => {
        const label = String(configured.label || channel.name || channel.id || '')
          .trim();
        const labelSlug = normalizeToolSlug(label || configured.id || channel.id);
        const connectorId = String(channel.id || '');
        const configuredId = String(configured.id || '');
        const tools = [];

        if (channel.supportsSend === true) {
          const baseToolName = `channel_send_${labelSlug}`;
          const seenCount = Number(seenToolNames[baseToolName] || 0);
          seenToolNames[baseToolName] = seenCount + 1;
          const toolName =
            seenCount > 0
              ? `${baseToolName}_${normalizeToolSlug(configuredId || 'channel')}`
              : baseToolName;
          const args = {};
          (Array.isArray(channel.sendParams) ? channel.sendParams : []).forEach(
            (param) => {
              if (param === 'attachments') args[param] = 'array';
              else if (param === 'to') args[param] = 'string|array';
              else args[param] = 'string';
            },
          );
          if (!Object.prototype.hasOwnProperty.call(args, 'body')) {
            args.body = 'string';
          }
          tools.push({
            name: toolName,
            description: `Send an outbound message through configured channel /${label}.`,
            args,
            mutatesWorkbook: false,
            capabilityTags: ['channels', 'send', connectorId],
            channelId: configuredId,
            channelLabel: label,
            connectorId,
            dynamicType: 'send',
          });
        }

        if (channel.supportsSearch !== false) {
          const baseToolName = `channel_search_${labelSlug}`;
          const seenCount = Number(seenToolNames[baseToolName] || 0);
          seenToolNames[baseToolName] = seenCount + 1;
          const toolName =
            seenCount > 0
              ? `${baseToolName}_${normalizeToolSlug(configuredId || 'channel')}`
              : baseToolName;
          const args = {};
          (Array.isArray(channel.searchParams) ? channel.searchParams : ['query', 'limit'])
            .forEach((param) => {
              args[param] = param === 'limit' ? 'number' : 'string';
            });
          if (!Object.prototype.hasOwnProperty.call(args, 'query')) {
            args.query = 'string';
          }
          if (!Object.prototype.hasOwnProperty.call(args, 'limit')) {
            args.limit = 'number';
          }
          tools.push({
            name: toolName,
            description: `Search configured channel /${label} and return standardized results.`,
            args,
            mutatesWorkbook: false,
            capabilityTags: ['channels', 'search', connectorId],
            channelId: configuredId,
            channelLabel: label,
            connectorId,
            dynamicType: 'search',
          });
        }

        return tools;
      });
  });
}

export function buildAssistantToolsManifest(channels, isPlainObject) {
  return buildStaticAssistantToolsManifest(isPlainObject).concat(
    buildDynamicChannelToolsManifest(channels),
  );
}

function normalizeChannelPayloadValue(key, value) {
  if (key === 'attachments') {
    return Array.isArray(value) ? value : [];
  }
  if (key === 'limit') {
    return Math.max(1, Math.min(100, parseInt(value, 10) || 20));
  }
  if (key === 'to') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) return value;
    return [];
  }
  return String(value == null ? '' : value);
}

function getDynamicAssistantTool(toolName, context) {
  const tools = buildDynamicChannelToolsManifest(
    context && context.manifest ? context.manifest.channels : [],
  );
  const match = tools.find((tool) => tool && tool.name === toolName);
  if (!match) return null;
  return {
    ...match,
    run: async (args) => {
      const payload = {};
      Object.keys(match.args || {}).forEach((key) => {
        payload[key] = normalizeChannelPayloadValue(key, args && args[key]);
      });
      if (match.dynamicType === 'search') {
        return context.searchAssistantChannel(
          match.channelLabel,
          payload,
          match.channelId,
        );
      }
      return context.sendAssistantChannelMessage(
        match.channelLabel,
        payload,
        match.channelId,
      );
    },
  };
}

export async function runAssistantTool(toolCall, context) {
  const name = String(toolCall && toolCall.name ? toolCall.name : '').trim();
  const args =
    context && context.isPlainObject && context.isPlainObject(toolCall && toolCall.arguments)
      ? toolCall.arguments
      : {};
  const registry = getRegisteredAssistantTools();
  const tool =
    registry.find((item) => item && item.name === name) ||
    getDynamicAssistantTool(name, context);
  if (!tool) {
    throw new Error(`Unknown assistant tool: ${name}`);
  }
  return tool.run(args, context);
}

function makeTabId(kind) {
  return `${kind === 'report' ? 'report' : 'sheet'}-${Date.now()}-${Math.floor(
    Math.random() * 10000,
  )}`;
}

export function registerBuiltInAssistantTools(deps) {
  if (assistantToolRegistry.length) return;
  const {
    buildAttachmentSourceFromAssistantUpload,
    isPlainObject,
    getAssistantUploadById,
    serializeAssistantUpload,
  } = deps;

  registerAssistantTool({
    name: 'patch_workbook',
    description:
      'Apply a batch workbook patch across many cells, reports, schedules, and tabs in one tool call.',
    args: {
      cellUpdates: 'array',
      reportUpdates: 'array',
      tabUpdates: 'array',
      activeTabId: 'string',
    },
    capabilityTags: ['workbook', 'batch', 'write'],
    run: async (args, context) => {
      const cellUpdates = Array.isArray(args && args.cellUpdates)
        ? args.cellUpdates
        : [];
      const reportUpdates = Array.isArray(args && args.reportUpdates)
        ? args.reportUpdates
        : [];
      const tabUpdates = Array.isArray(args && args.tabUpdates)
        ? args.tabUpdates
        : [];
      const changed = [];

      for (let i = 0; i < cellUpdates.length; i += 1) {
        const update = cellUpdates[i];
        if (!isPlainObject(update)) continue;
        check(update.sheetId, String);
        check(update.cellId, String);
        const sheetId = String(update.sheetId || '');
        const cellId = String(update.cellId || '').toUpperCase();
        if (update.clear === true) {
          context.storage.setCellSchedule(sheetId, cellId, null);
          context.storage.setCellValue(sheetId, cellId, '');
          changed.push({ kind: 'clear_cell', sheetId, cellId });
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(update, 'source')) {
          context.storage.setCellValue(sheetId, cellId, String(update.source || ''));
          changed.push({ kind: 'set_cell_source', sheetId, cellId });
        }
        if (Object.prototype.hasOwnProperty.call(update, 'attachmentUploadId')) {
          check(update.attachmentUploadId, String);
          const upload = await context.getUpload(update.attachmentUploadId);
          if (!upload) {
            throw new Error(
              `Assistant upload not found: ${String(update.attachmentUploadId || '')}`,
            );
          }
          context.storage.setCellValue(
            sheetId,
            cellId,
            buildAttachmentSourceFromAssistantUpload(upload),
          );
          changed.push({
            kind: 'set_file_cell',
            sheetId,
            cellId,
            uploadId: String(update.attachmentUploadId || ''),
          });
        }
        if (Object.prototype.hasOwnProperty.call(update, 'presentation')) {
          check(update.presentation, Match.Where(isPlainObject));
          context.storage.setCellPresentation(sheetId, cellId, update.presentation);
          changed.push({ kind: 'set_cell_presentation', sheetId, cellId });
        }
        if (Object.prototype.hasOwnProperty.call(update, 'schedule')) {
          context.storage.setCellSchedule(
            sheetId,
            cellId,
            update.schedule == null ? null : update.schedule,
          );
          changed.push({ kind: 'set_cell_schedule', sheetId, cellId });
        }
      }

      for (let i = 0; i < reportUpdates.length; i += 1) {
        const update = reportUpdates[i];
        if (!isPlainObject(update)) continue;
        check(update.reportTabId, String);
        check(update.content, String);
        context.storage.setReportContent(update.reportTabId, update.content);
        changed.push({
          kind: 'set_report_content',
          reportTabId: String(update.reportTabId || ''),
        });
      }

      for (let i = 0; i < tabUpdates.length; i += 1) {
        const update = tabUpdates[i];
        if (!isPlainObject(update)) continue;
        const action = String(update.action || '').trim().toLowerCase();
        const tabs = context.storage.readTabs();
        if (action === 'create') {
          check(update.name, String);
          const type =
            String(update.type || 'sheet').trim().toLowerCase() === 'report'
              ? 'report'
              : 'sheet';
          const id = String(update.tabId || '') || makeTabId(type);
          tabs.push({
            id,
            name: String(update.name || '').trim() || id,
            type,
          });
          context.storage.saveTabs(tabs);
          changed.push({ kind: 'create_tab', id, type });
          continue;
        }
        if (action === 'rename') {
          check(update.tabId, String);
          check(update.name, String);
          context.storage.saveTabs(
            tabs.map((tab) =>
              tab && tab.id === update.tabId
                ? { ...tab, name: String(update.name || '').trim() || tab.name }
                : tab,
            ),
          );
          changed.push({ kind: 'rename_tab', tabId: String(update.tabId || '') });
          continue;
        }
        if (action === 'delete') {
          check(update.tabId, String);
          const tabId = String(update.tabId || '');
          context.storage.clearSheetStorage(tabId);
          context.storage.saveTabs(tabs.filter((tab) => tab && tab.id !== tabId));
          changed.push({ kind: 'delete_tab', tabId });
        }
      }

      if (args && typeof args.activeTabId === 'string' && args.activeTabId.trim()) {
        context.storage.setActiveSheetId(args.activeTabId);
        changed.push({ kind: 'set_active_tab', tabId: String(args.activeTabId) });
      }

      if (!changed.length) {
        return { ok: true, changed: 0 };
      }
      context.markMutated('patch_workbook', { changed });
      return { ok: true, changed: changed.length };
    },
  });

  registerAssistantTool({
    name: 'set_file_cell_from_upload',
    description:
      'Attach an uploaded chat file to a workbook cell, turning it into a file cell.',
    args: {
      sheetId: 'string',
      cellId: 'string',
      uploadId: 'string',
    },
    capabilityTags: ['cells', 'files', 'write'],
    run: async (args, context) => {
      check(args.sheetId, String);
      check(args.cellId, String);
      check(args.uploadId, String);
      const upload = await context.getUpload(args.uploadId);
      if (!upload) {
        throw new Error(`Assistant upload not found: ${String(args.uploadId || '')}`);
      }
      context.storage.setCellValue(
        args.sheetId,
        args.cellId,
        buildAttachmentSourceFromAssistantUpload(upload),
      );
      context.markMutated('set_file_cell_from_upload', {
        sheetId: args.sheetId,
        cellId: String(args.cellId || '').toUpperCase(),
        uploadId: String(args.uploadId || ''),
      });
      return {
        ok: true,
        upload: serializeAssistantUpload(upload, false),
      };
    },
  });

  registerAssistantTool({
    name: 'get_workbook',
    description: 'Return the current workbook JSON snapshot.',
    args: {},
    mutatesWorkbook: false,
    capabilityTags: ['workbook', 'read'],
    run: async (_args, context) => ({
      workbook: context.getWorkbook(),
    }),
  });

  registerAssistantTool({
    name: 'set_cell_source',
    description: 'Set the raw source/formula of a cell.',
    args: {
      sheetId: 'string',
      cellId: 'string',
      source: 'string',
    },
    capabilityTags: ['cells', 'write'],
    run: async (args, context) => {
      check(args.sheetId, String);
      check(args.cellId, String);
      check(args.source, String);
      context.storage.setCellValue(args.sheetId, args.cellId, args.source);
      context.markMutated('set_cell_source', {
        sheetId: args.sheetId,
        cellId: String(args.cellId || '').toUpperCase(),
      });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'clear_cell',
    description: 'Clear cell source and schedule.',
    args: {
      sheetId: 'string',
      cellId: 'string',
    },
    capabilityTags: ['cells', 'write', 'schedules'],
    run: async (args, context) => {
      check(args.sheetId, String);
      check(args.cellId, String);
      context.storage.setCellSchedule(args.sheetId, args.cellId, null);
      context.storage.setCellValue(args.sheetId, args.cellId, '');
      context.markMutated('clear_cell', {
        sheetId: args.sheetId,
        cellId: String(args.cellId || '').toUpperCase(),
      });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'set_cell_presentation',
    description: 'Update formatting and presentation fields for a cell.',
    args: {
      sheetId: 'string',
      cellId: 'string',
      presentation: 'object',
    },
    capabilityTags: ['formatting', 'write'],
    run: async (args, context) => {
      check(args.sheetId, String);
      check(args.cellId, String);
      check(args.presentation, Match.Where(isPlainObject));
      context.storage.setCellPresentation(
        args.sheetId,
        args.cellId,
        args.presentation,
      );
      context.markMutated('set_cell_presentation', {
        sheetId: args.sheetId,
        cellId: String(args.cellId || '').toUpperCase(),
      });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'set_cell_schedule',
    description: 'Create, update, or clear a server schedule for a cell.',
    args: {
      sheetId: 'string',
      cellId: 'string',
      schedule: 'object|null',
    },
    capabilityTags: ['schedules', 'write'],
    run: async (args, context) => {
      check(args.sheetId, String);
      check(args.cellId, String);
      context.storage.setCellSchedule(
        args.sheetId,
        args.cellId,
        args.schedule == null ? null : args.schedule,
      );
      context.markMutated('set_cell_schedule', {
        sheetId: args.sheetId,
        cellId: String(args.cellId || '').toUpperCase(),
      });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'set_report_content',
    description: 'Replace the content of a report tab.',
    args: {
      reportTabId: 'string',
      content: 'string',
    },
    capabilityTags: ['reports', 'write'],
    run: async (args, context) => {
      check(args.reportTabId, String);
      check(args.content, String);
      context.storage.setReportContent(args.reportTabId, args.content);
      context.markMutated('set_report_content', {
        reportTabId: args.reportTabId,
      });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'create_tab',
    description: 'Create a new sheet or report tab.',
    args: {
      name: 'string',
      type: 'string',
    },
    capabilityTags: ['tabs', 'write', 'reports'],
    run: async (args, context) => {
      check(args.name, String);
      const type = String(args.type || 'sheet').trim().toLowerCase() === 'report'
        ? 'report'
        : 'sheet';
      const tabs = context.storage.readTabs();
      const id = makeTabId(type);
      tabs.push({ id, name: String(args.name || '').trim() || id, type });
      context.storage.saveTabs(tabs);
      context.storage.setActiveSheetId(id);
      context.markMutated('create_tab', { id, type });
      return { ok: true, id, type };
    },
  });

  registerAssistantTool({
    name: 'rename_tab',
    description: 'Rename an existing tab.',
    args: {
      tabId: 'string',
      name: 'string',
    },
    capabilityTags: ['tabs', 'write'],
    run: async (args, context) => {
      check(args.tabId, String);
      check(args.name, String);
      const tabs = context.storage.readTabs().map((tab) =>
        tab && tab.id === args.tabId
          ? { ...tab, name: String(args.name || '').trim() || tab.name }
          : tab,
      );
      context.storage.saveTabs(tabs);
      context.markMutated('rename_tab', { tabId: args.tabId });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'delete_tab',
    description: 'Delete an existing tab.',
    args: {
      tabId: 'string',
    },
    capabilityTags: ['tabs', 'write'],
    run: async (args, context) => {
      check(args.tabId, String);
      const tabId = String(args.tabId || '');
      const tabs = context.storage.readTabs().filter((tab) => tab && tab.id !== tabId);
      context.storage.clearSheetStorage(tabId);
      context.storage.saveTabs(tabs);
      if (String(context.storage.getActiveSheetId('') || '') === tabId && tabs[0]) {
        context.storage.setActiveSheetId(tabs[0].id);
      }
      context.markMutated('delete_tab', { tabId });
      return { ok: true };
    },
  });

  registerAssistantTool({
    name: 'list_channels',
    description: 'Return configured channels and connector capabilities.',
    args: {},
    mutatesWorkbook: false,
    capabilityTags: ['channels', 'read'],
    run: async (_args, context) => ({
      channels: context.manifest.channels,
    }),
  });
}
