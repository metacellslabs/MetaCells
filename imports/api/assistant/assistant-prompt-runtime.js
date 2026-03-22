import {
  DEFAULT_SETTINGS_ID,
  AppSettings,
  ensureDefaultSettings,
} from '../settings/index.js';
import { getRegisteredAIProviders } from '../settings/providers/index.js';
import { getRegisteredChannelConnectors } from '../channels/connectors/index.js';
import { getRegisteredFormulas } from '../../engine/formulas/index.js';
import { decodeWorkbookDocument } from '../sheets/workbook-codec.js';
import { parseAttachmentSourceValue } from '../artifacts/index.js';
import { isPlainObject, toPlainTextContent } from './assistant-conversation-runtime.js';

const ASSISTANT_MAX_PROMPT_TOKENS = 100000;
const ASSISTANT_MAX_HISTORY_MESSAGES = 24;
const ASSISTANT_MAX_HISTORY_MESSAGE_CHARS = 4000;
const ASSISTANT_MAX_FILE_CELLS = 24;
const ASSISTANT_MAX_FILE_CELL_CONTENT_CHARS = 1200;
const ASSISTANT_MAX_POPULATED_CELLS = 120;
const ASSISTANT_MAX_CELL_SOURCE_CHARS = 240;
const ASSISTANT_MAX_CELL_VALUE_CHARS = 240;
const ASSISTANT_MAX_UPLOADS = 6;
const ASSISTANT_MAX_UPLOAD_CONTENT_CHARS = 3000;
const ASSISTANT_MAX_TOTAL_UPLOAD_CHARS = 12000;
const ASSISTANT_MAX_REPORT_PREVIEW_CHARS = 1500;

export function truncateAssistantText(value, maxChars) {
  const text = String(value == null ? '' : value);
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}…`;
}

function estimateAssistantTokens(value) {
  return Math.ceil(String(value == null ? '' : value).length / 4);
}

export function estimateAssistantMessageTokens(messages) {
  return (Array.isArray(messages) ? messages : []).reduce((total, message) => {
    const role = String(message && message.role ? message.role : 'user');
    const content = toPlainTextContent(message && message.content);
    return total + estimateAssistantTokens(role) + estimateAssistantTokens(content) + 8;
  }, 0);
}

export function compactWorkbookForPrompt(workbook) {
  const normalized = decodeWorkbookDocument(workbook || {});
  const tabs = Array.isArray(normalized.tabs) ? normalized.tabs : [];
  const sheets = isPlainObject(normalized.sheets) ? normalized.sheets : {};
  return {
    activeTabId: String(normalized.activeTabId || ''),
    aiMode: String(normalized.aiMode || ''),
    namedCellKeys: Object.keys(
      isPlainObject(normalized.namedCells) ? normalized.namedCells : {},
    ).slice(0, 50),
    tabs: tabs.slice(0, 40).map((tab) => {
      const sheet = sheets[tab.id] || {};
      const cells = isPlainObject(sheet.cells) ? sheet.cells : {};
      return {
        id: String(tab.id || ''),
        name: String(tab.name || ''),
        type: tab.type === 'report' ? 'report' : 'sheet',
        cellCount: Object.keys(cells).length,
        reportPreview:
          tab.type === 'report'
            ? truncateAssistantText(sheet.reportContent || '', ASSISTANT_MAX_REPORT_PREVIEW_CHARS)
            : '',
      };
    }),
  };
}

export function compactUploadsForPrompt(uploads) {
  const source = Array.isArray(uploads) ? uploads : [];
  let remainingChars = ASSISTANT_MAX_TOTAL_UPLOAD_CHARS;
  const compacted = [];
  for (let i = 0; i < source.length && compacted.length < ASSISTANT_MAX_UPLOADS; i += 1) {
    const upload = isPlainObject(source[i]) ? source[i] : null;
    if (!upload) continue;
    if (remainingChars <= 0) break;
    const content = truncateAssistantText(
      upload.content || '',
      Math.min(ASSISTANT_MAX_UPLOAD_CONTENT_CHARS, remainingChars),
    );
    remainingChars -= content.length;
    compacted.push({
      id: String(upload.id || ''),
      name: String(upload.name || ''),
      type: String(upload.type || ''),
      content,
      truncated:
        String(upload.content || '').length > content.length ||
        content.length >= ASSISTANT_MAX_UPLOAD_CONTENT_CHARS,
    });
  }
  return compacted;
}

function trimConversationForPrompt(conversation) {
  const history = Array.isArray(conversation) ? conversation : [];
  return history
    .slice(-ASSISTANT_MAX_HISTORY_MESSAGES)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const role = String(item.role || '').trim().toLowerCase();
      if (!role || ['system', 'user', 'assistant'].indexOf(role) === -1) {
        return null;
      }
      return {
        role,
        content: truncateAssistantText(
          toPlainTextContent(item.content),
          ASSISTANT_MAX_HISTORY_MESSAGE_CHARS,
        ),
      };
    })
    .filter(Boolean);
}

function getDefaultFormattingManifest() {
  return {
    formats: [
      'text',
      'number',
      'number_0',
      'number_2',
      'percent',
      'percent_2',
      'date',
      'currency_usd',
      'currency_eur',
      'currency_gbp',
    ],
    align: ['left', 'center', 'right'],
    fontFamilies: ['default', 'serif', 'sans', 'mono', 'display'],
    fontSizeRange: { min: 10, max: 28 },
    decimalPlacesRange: { min: 0, max: 6 },
    borders: ['top', 'right', 'bottom', 'left'],
  };
}

function getDefaultScheduleManifest() {
  return {
    supported: true,
    kinds: ['once', 'daily', 'weekly', 'monthly', 'interval', 'cron'],
    note:
      'Schedules run server-side. Mutations to schedules should use tools, not free text.',
  };
}

function getFormulaLanguageGuide() {
  return {
    shortcuts: [
      {
        prefix: "'",
        meaning: 'Single-cell AI answer. Returns one response in the same cell.',
      },
      {
        prefix: '>',
        meaning:
          'AI list spill. Returns a delimited list and fills cells below the formula cell.',
      },
      {
        prefix: '#',
        meaning:
          'AI table spill. Returns a markdown table and fills a grid below the formula cell.',
      },
    ],
    mentions: [
      { syntax: '@idea', meaning: 'Use the computed value of the named cell idea.' },
      { syntax: '@B1', meaning: 'Use the computed value of cell B1 from the current sheet.' },
      { syntax: '@Sheet 1!B1', meaning: 'Use the computed value from another sheet.' },
      { syntax: '@B1:C5', meaning: 'Use the values from a region.' },
      {
        syntax: '_@idea',
        meaning:
          'Use the raw source/formula of the referenced cell instead of its computed value.',
      },
      {
        syntax: '@@brief',
        meaning:
          'Use the named cell as hidden AI context or instruction, not visible prompt text.',
      },
      {
        syntax: '@policy',
        meaning:
          'If the cell is a file cell, the extracted file content is used in AI prompts.',
      },
    ],
    examples: [
      {
        title: 'Long formula AI',
        formula:
          '=IF(B1="","", AI_COMPLETION("Generate key partners for the business idea: " & B1))',
        meaning:
          'Traditional spreadsheet formula that calls AI for one cell when B1 is present.',
      },
      {
        title: 'Single-cell AI shortcut',
        formula: "'Generate key partners for the business idea: @B1",
        meaning:
          'Shorter equivalent single-cell AI prompt using a mention instead of string concatenation.',
      },
      {
        title: 'AI list spill',
        formula: '>top 10 customer pains for @B1',
        meaning:
          'Generates a list and spills one item per row below the cell.',
      },
      {
        title: 'AI table spill',
        formula: '#compare @B1 with competitors;4;6',
        meaning:
          'Generates a table with up to 4 columns and 6 rows and spills it below/right.',
      },
      {
        title: 'Region mention',
        formula: "'Summarise @B2:D12 for @B1",
        meaning: 'Uses a whole cell range as prompt context.',
      },
      {
        title: 'Hidden context mention',
        formula: "'Write partner ideas for @B1 with @@brief",
        meaning:
          'Uses @B1 visibly and @@brief as hidden instruction/persona context.',
      },
      {
        title: 'Channel table feed',
        formula: '#7 /sf extract action items for @B1',
        meaning:
          'Processes the last 7 days of channel events and fills one result row per event.',
      },
    ],
    guidance: [
      'Prefer the shortcut syntax when editing AI cells unless the user specifically wants a classic =formula form.',
      'When creating AI formulas, use mentions like @B1 or @idea instead of manually concatenating cell values into strings where possible.',
      'Use single quote for one-cell AI, > for list spill, and # for table spill.',
    ],
  };
}

function buildFormulaManifest() {
  return getRegisteredFormulas().map((formula) => ({
    name: String(formula.name || ''),
    signature: String(formula.signature || ''),
    summary: String(formula.summary || ''),
    aliases: Array.isArray(formula.aliases) ? formula.aliases.slice() : [],
    examples: Array.isArray(formula.examples) ? formula.examples.slice() : [],
  }));
}

function buildChannelManifest(settingsDoc) {
  const configuredChannels = Array.isArray(
    settingsDoc && settingsDoc.communicationChannels,
  )
    ? settingsDoc.communicationChannels
    : [];
  const configuredByConnector = new Map();
  for (let i = 0; i < configuredChannels.length; i += 1) {
    const channel = configuredChannels[i];
    if (!channel || !channel.connectorId) continue;
    const key = String(channel.connectorId || '');
    if (!configuredByConnector.has(key)) configuredByConnector.set(key, []);
    configuredByConnector.get(key).push({
      id: String(channel.id || ''),
      label: String(channel.label || ''),
      enabled: channel.enabled !== false,
      status: String(channel.status || ''),
    });
  }
  return getRegisteredChannelConnectors().map((connector) => ({
    id: String(connector.id || ''),
    name: String(connector.name || ''),
    type: String(connector.type || ''),
    description: String(connector.description || ''),
    descriptionWithCapabilities: [
      String(connector.description || ''),
      Array.isArray(connector.capabilities && connector.capabilities.actions) &&
      connector.capabilities.actions.length
        ? `Actions: ${connector.capabilities.actions.join(', ')}.`
        : '',
      Array.isArray(connector.capabilities && connector.capabilities.entities) &&
      connector.capabilities.entities.length
        ? `Entities: ${connector.capabilities.entities.join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    supportsReceive: connector.supportsReceive !== false,
    supportsSend: !!connector.supportsSend,
    supportsSearch: connector.supportsSearch !== false,
    capabilities:
      connector && connector.capabilities && typeof connector.capabilities === 'object'
        ? {
            ...connector.capabilities,
            actions: Array.isArray(connector.capabilities.actions)
              ? connector.capabilities.actions.slice()
              : [],
            entities: Array.isArray(connector.capabilities.entities)
              ? connector.capabilities.entities.slice()
              : [],
          }
        : null,
    sendParams: Array.isArray(connector.sendParams)
      ? connector.sendParams.slice()
      : [],
    searchParams: Array.isArray(connector.searchParams)
      ? connector.searchParams.slice()
      : ['query', 'limit'],
    mentioningFormulas: Array.isArray(connector.mentioningFormulas)
      ? connector.mentioningFormulas.slice()
      : [],
    configuredChannels: configuredByConnector.get(String(connector.id || '')) || [],
  }));
}

function buildChannelLanguageGuide(channels) {
  const source = Array.isArray(channels) ? channels : [];
  const configuredChannels = [];
  const receiveExamples = [];
  const sendExamples = [];
  const guidance = [
    'Treat configured receive-capable channels as live event streams that the workbook can process with formulas.',
    'If the user asks about incoming emails, messages, notifications, tickets, or channel events, prefer workbook formulas using the configured channel label instead of generic prose.',
    'To build a running list or table from incoming channel events, prefer # formulas like `# /label classify each event` or `#7 /label extract action items`.',
    'A plain channel mention like `/label` inside a formula binds the prompt to that channel payload. Use # for row-per-event tables and > or single-quote only when the user clearly wants a different shape.',
    'If the user asks to include only events matching a condition, encode that condition in the formula prompt so each event is filtered/classified during processing.',
    'Use outbound channel send tools or `/label:send:{...}` formulas only when the user wants to send a message. Do not confuse receive flows with send flows.',
  ];

  source.forEach((connector) => {
    if (!connector || !Array.isArray(connector.configuredChannels)) return;
    connector.configuredChannels
      .filter((channel) => channel && channel.enabled !== false)
      .forEach((channel) => {
        const label = String(channel.label || '').trim();
        if (!label) return;
        configuredChannels.push({
          label,
          connectorName: String(connector.name || ''),
          connectorType: String(connector.type || ''),
          supportsReceive: connector.supportsReceive !== false,
          supportsSend: !!connector.supportsSend,
          status: String(channel.status || ''),
          mentioningFormulas: Array.isArray(connector.mentioningFormulas)
            ? connector.mentioningFormulas.slice(0, 3)
            : [],
          help: Array.isArray(connector.help) ? connector.help.slice(0, 4) : [],
        });

        if (connector.supportsReceive !== false) {
          receiveExamples.push(
            `# /${label} summarise each incoming event in one line`,
            `#7 /${label} extract action items`,
            `# /${label} include only payment requests and return one row per matching event`,
          );
        }
        if (connector.supportsSend) {
          sendExamples.push(
            `/${label}:send:{"to":"user@example.com","subj":"Hi","body":"hello"}`,
          );
        }
      });
  });

  return {
    configuredChannels,
    receiveExamples: Array.from(new Set(receiveExamples)),
    sendExamples: Array.from(new Set(sendExamples)),
    guidance,
  };
}

function summarizeWorkbook(workbook) {
  const normalized = decodeWorkbookDocument(workbook || {});
  const tabs = Array.isArray(normalized.tabs) ? normalized.tabs : [];
  const sheets = isPlainObject(normalized.sheets) ? normalized.sheets : {};
  const sheetSummaries = tabs.map((tab) => {
    const sheet = sheets[tab.id] || {};
    const cells = isPlainObject(sheet.cells) ? sheet.cells : {};
    const reportContent = String(sheet.reportContent || '');
    const scheduledCells = [];
    Object.keys(cells).forEach((cellId) => {
      const cell = cells[cellId];
      if (!isPlainObject(cell) || !cell.schedule || cell.schedule.enabled === false)
        return;
      scheduledCells.push({
        cellId,
        kind: String(cell.schedule.kind || ''),
        origin: String(cell.schedule.origin || ''),
        label: String(cell.schedule.label || ''),
      });
    });
    return {
      id: String(tab.id || ''),
      name: String(tab.name || ''),
      type: tab.type === 'report' ? 'report' : 'sheet',
      cellCount: Object.keys(cells).length,
      scheduledCells,
      reportLength: reportContent.length,
    };
  });
  return {
    activeTabId: String(normalized.activeTabId || ''),
    aiMode: String(normalized.aiMode || ''),
    namedCells: normalized.namedCells || {},
    tabs: sheetSummaries,
  };
}

async function loadSettingsDoc() {
  await ensureDefaultSettings();
  return (
    (await AppSettings.findOneAsync(DEFAULT_SETTINGS_ID)) || {
      communicationChannels: [],
    }
  );
}

export async function buildAssistantManifest(
  sheetDocumentId,
  workbook,
  buildAssistantToolsManifest,
) {
  const settingsDoc = await loadSettingsDoc();
  const channelManifest = buildChannelManifest(settingsDoc);
  const providers = getRegisteredAIProviders().map((provider) => ({
    id: String(provider.id || ''),
    name: String(provider.name || ''),
    type: String(provider.type || ''),
    models: Array.isArray(provider.availableModels)
      ? provider.availableModels.slice()
      : [],
  }));
  return {
    workbookId: String(sheetDocumentId || ''),
    activeProviderId: String((settingsDoc && settingsDoc.activeAIProviderId) || ''),
    providers,
    formulas: buildFormulaManifest(),
    formulaLanguage: getFormulaLanguageGuide(),
    channelLanguage: buildChannelLanguageGuide(channelManifest),
    channels: channelManifest,
    formatting: getDefaultFormattingManifest(),
    schedules: getDefaultScheduleManifest(),
    reports: {
      supported: true,
      note: 'Reports are stored as report tabs with HTML/markdown-like rich content.',
    },
    workbookSummary: summarizeWorkbook(workbook),
    tools:
      typeof buildAssistantToolsManifest === 'function'
        ? buildAssistantToolsManifest(channelManifest)
        : [],
  };
}

export function buildAssistantSystemPrompt(manifest) {
  return [
    'You are the MetaCells workbook assistant.',
    'You help edit sheets, reports, formatting, schedules, and workbook structure.',
    'Use tools for any workbook mutation. Do not claim changes unless the tool call succeeded.',
    'You receive a manifest describing formulas, channels, schedules, reports, formatting, and tools.',
    'Pay close attention to formulaLanguage in the manifest. It explains AI shortcut syntax, mentions, and examples.',
    'Pay close attention to channelLanguage and channels in the manifest. They describe configured live channels, their labels, and examples.',
    'You receive a compact workbook snapshot with every user message.',
    'The user payload also includes workbookContext. Use workbookContext.fileCells first when the user refers to a document, attachment, or file cell like C3.',
    'The user payload also includes channelContext. Use it when the user refers to email, inbox, incoming messages, connected channels, notifications, or message automation.',
    'If configured receive-capable channels exist and the user asks to collect, list, classify, summarise, or filter incoming emails/messages, prefer creating or editing workbook formulas that use those channel labels.',
    'For row-per-event results, prefer `# /label ...` formulas. For lookback windows, prefer `#7 /label ...` or `#30 /label ...` when the user implies recent history.',
    'If the user asks for a list of payment-request emails, assume they likely want a channel-driven table or list in the workbook, not a general explanation.',
    'Do not say that channel setup is required if channelContext already shows configured enabled channels.',
    'When responding, return JSON only with this schema:',
    '{"message":"string","toolCalls":[{"name":"tool_name","arguments":{}}]}',
    'If no tool is needed, return an empty toolCalls array.',
    'If a user asks for unsupported behavior, explain that in message and do not invent tools.',
    'Prefer minimal, precise tool calls.',
    'MetaCells manifest:',
    JSON.stringify(manifest),
  ].join('\n');
}

export function buildChannelPromptContext(manifest) {
  const channels = Array.isArray(manifest && manifest.channels)
    ? manifest.channels
    : [];
  return {
    configuredChannels: channels.flatMap((connector) =>
      (Array.isArray(connector && connector.configuredChannels)
        ? connector.configuredChannels
        : []
      )
        .filter((channel) => channel && channel.enabled !== false)
        .map((channel) => ({
          label: String(channel.label || ''),
          connectorName: String(connector.name || ''),
          connectorType: String(connector.type || ''),
          supportsReceive: connector.supportsReceive !== false,
          supportsSend: !!connector.supportsSend,
          status: String(channel.status || ''),
          mentioningExamples: Array.isArray(connector.mentioningFormulas)
            ? connector.mentioningFormulas.slice(0, 3)
            : [],
          help: Array.isArray(connector.help) ? connector.help.slice(0, 4) : [],
        })),
    ),
    receiveCapableLabels: channels.flatMap((connector) =>
      connector && connector.supportsReceive !== false
        ? (Array.isArray(connector.configuredChannels)
            ? connector.configuredChannels
            : []
          )
            .filter((channel) => channel && channel.enabled !== false)
            .map((channel) => String(channel.label || '').trim())
            .filter(Boolean)
        : [],
    ),
    sendCapableLabels: channels.flatMap((connector) =>
      connector && connector.supportsSend
        ? (Array.isArray(connector.configuredChannels)
            ? connector.configuredChannels
            : []
          )
            .filter((channel) => channel && channel.enabled !== false)
            .map((channel) => String(channel.label || '').trim())
            .filter(Boolean)
        : [],
    ),
    guidance:
      manifest && manifest.channelLanguage && Array.isArray(manifest.channelLanguage.guidance)
        ? manifest.channelLanguage.guidance
        : [],
    receiveExamples:
      manifest && manifest.channelLanguage && Array.isArray(manifest.channelLanguage.receiveExamples)
        ? manifest.channelLanguage.receiveExamples
        : [],
    sendExamples:
      manifest && manifest.channelLanguage && Array.isArray(manifest.channelLanguage.sendExamples)
        ? manifest.channelLanguage.sendExamples
        : [],
  };
}

export function buildWorkbookPromptContext(workbook) {
  const normalized = decodeWorkbookDocument(workbook || {});
  const tabs = Array.isArray(normalized.tabs) ? normalized.tabs : [];
  const sheets = isPlainObject(normalized.sheets) ? normalized.sheets : {};
  const fileCells = [];
  const populatedCells = [];

  tabs.forEach((tab) => {
    const sheet = sheets[tab.id] || {};
    const cells = isPlainObject(sheet.cells) ? sheet.cells : {};
    Object.keys(cells).forEach((cellId) => {
      const cell = cells[cellId];
      if (!isPlainObject(cell)) return;
      const source = String(cell.source || '');
      const value = String(cell.value || '');
      const attachment = parseAttachmentSourceValue(source);
      if (attachment) {
        fileCells.push({
          tabId: String(tab.id || ''),
          tabName: String(tab.name || ''),
          cellId: String(cellId || '').toUpperCase(),
          name: String(attachment.name || ''),
          mimeType: String(attachment.type || ''),
          contentPreview: truncateAssistantText(
            attachment.content || '',
            ASSISTANT_MAX_FILE_CELL_CONTENT_CHARS,
          ),
          hasContent: !!String(attachment.content || '').trim(),
        });
        return;
      }
      if (!source && !value) return;
      populatedCells.push({
        tabId: String(tab.id || ''),
        tabName: String(tab.name || ''),
        cellId: String(cellId || '').toUpperCase(),
        source: truncateAssistantText(source, ASSISTANT_MAX_CELL_SOURCE_CHARS),
        value: truncateAssistantText(value, ASSISTANT_MAX_CELL_VALUE_CHARS),
      });
    });
  });

  return {
    activeTabId: String(normalized.activeTabId || ''),
    fileCells: fileCells.slice(0, ASSISTANT_MAX_FILE_CELLS),
    populatedCells: populatedCells.slice(0, ASSISTANT_MAX_POPULATED_CELLS),
  };
}

export function buildConversationMessages(
  systemPrompt,
  conversation,
  manifest,
  workbook,
  userMessage,
  uploads,
) {
  const messages = [{ role: 'system', content: systemPrompt }];
  const history = trimConversationForPrompt(conversation);
  for (let i = 0; i < history.length; i += 1) {
    const item = history[i];
    if (!item || typeof item !== 'object') continue;
    const role = String(item.role || '').trim().toLowerCase();
    if (!role || ['system', 'user', 'assistant'].indexOf(role) === -1)
      continue;
    messages.push({
      role,
      content: toPlainTextContent(item.content),
    });
  }
  messages.push({
    role: 'user',
    content: JSON.stringify({
      message: String(userMessage || ''),
      workbook: compactWorkbookForPrompt(workbook),
      workbookContext: buildWorkbookPromptContext(workbook),
      channelContext: buildChannelPromptContext(manifest),
      chatFiles: compactUploadsForPrompt(uploads),
    }),
  });
  while (
    messages.length > 2 &&
    estimateAssistantMessageTokens(messages) > ASSISTANT_MAX_PROMPT_TOKENS
  ) {
    messages.splice(1, 1);
  }
  return messages;
}
