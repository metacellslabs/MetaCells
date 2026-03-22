import {
  buildAttachmentSourceValue,
  getArtifactText,
} from '../artifacts/index.js';
import {
  extractChannelMentionLabels,
  formatChannelEventForPrompt,
  getChannelAttachmentLinkEntries,
  normalizeChannelLabel,
  buildAttachmentLinksMarkdown,
} from '../channels/mentioning.js';
import {
  buildChannelAttachmentPath,
  buildUnifiedChannelEvent,
  ChannelEvents,
} from '../channels/events.js';
import { FormulaEngine } from '../../engine/formula-engine.js';
import { AIService } from '../../ui/metacell/runtime/ai-service.js';
import { StorageService } from '../../engine/storage-service.js';
import { WorkbookStorageAdapter } from '../../engine/workbook-storage-adapter.js';
import { enqueueAIChatRequest } from '../ai/index.js';

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function escapeRegex(value) {
  return String(value == null ? '' : value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripChannelMentionsFromPrompt(text) {
  return String(text == null ? '' : text)
    .replace(/(^|[^A-Za-z0-9_:/])\/([A-Za-z][A-Za-z0-9_-]*)\b/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseBareChannelLogSpec(rawValue) {
  const match = /^\s*\/([A-Za-z][A-Za-z0-9_-]*)\s*$/.exec(
    String(rawValue == null ? '' : rawValue),
  );
  if (!match) return null;
  const label = normalizeChannelLabel(match[1]);
  if (!label) return null;
  return { label, days: 30 };
}

function stringifyChannelParty(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    return String(
      value.name ||
        value.email ||
        value.username ||
        value.handle ||
        value.id ||
        '',
    ).trim();
  }
  return '';
}

function firstNonEmptyChannelText(...values) {
  for (let i = 0; i < values.length; i += 1) {
    const text = String(values[i] == null ? '' : values[i]).trim();
    if (text) return text;
  }
  return '';
}

function formatUnifiedChannelEventRow(eventPayload) {
  const unified = buildUnifiedChannelEvent(eventPayload, {
    eventId:
      eventPayload && (eventPayload.eventId || eventPayload._id)
        ? String(eventPayload.eventId || eventPayload._id)
        : '',
  });
  const message =
    unified && unified.message && typeof unified.message === 'object'
      ? unified.message
      : {};
  const channel =
    unified && unified.channel && typeof unified.channel === 'object'
      ? unified.channel
      : {};
  const attachments = Array.isArray(unified && unified.attachments)
    ? unified.attachments
    : [];
  const date = firstNonEmptyChannelText(
    message.date,
    eventPayload && eventPayload.date,
    eventPayload && eventPayload.createdAt instanceof Date
      ? eventPayload.createdAt.toISOString()
      : '',
  );
  const from = firstNonEmptyChannelText(
    Array.isArray(message.from)
      ? message.from.map(stringifyChannelParty).filter(Boolean).join(', ')
      : '',
    channel.subchannel,
    channel.label,
  );
  const text = firstNonEmptyChannelText(
    message.text,
    message.subject,
    message.summary,
    unified && unified.event,
  );
  const firstAttachment =
    attachments.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item.binaryArtifactId || item.downloadUrl || item.name),
    ) || null;
  const file = firstAttachment
    ? buildAttachmentSourceValue({
        name: String(firstAttachment.name || 'Attached file'),
        type: String(firstAttachment.type || 'application/octet-stream'),
        content: '',
        contentArtifactId: String(firstAttachment.contentArtifactId || ''),
        binaryArtifactId: String(firstAttachment.binaryArtifactId || ''),
        downloadUrl: String(firstAttachment.downloadUrl || ''),
        previewUrl: String(
          firstAttachment.previewUrl || firstAttachment.downloadUrl || '',
        ),
        pending: false,
        converting: false,
      })
    : attachments
        .map((item) => String((item && item.name) || '').trim())
        .filter(Boolean)
        .join(', ');
  return [date, from, text, file];
}

function inferChannelFeedFilterMode(promptText) {
  const prompt = String(promptText || '').trim().toLowerCase();
  if (!prompt) return 'pass-through';
  if (
    /\b(only|include only|filter|matching|matches|if\b|when\b|where\b|unless|exclude|skip|payment request|invoice|urgent|overdue|requirement|criteria)\b/.test(
      prompt,
    )
  ) {
    return 'ai-filter';
  }
  return 'pass-through';
}

function inferChannelFeedExpectedFields(promptText) {
  const prompt = String(promptText || '').trim().toLowerCase();
  const fields = [];
  const add = (name, meaning) => {
    if (!name) return;
    if (fields.some((item) => item && item.name === name)) return;
    fields.push({ name, meaning });
  };

  add('summary', 'Short human-readable summary of the matching event');

  if (/\b(payment request|invoice|billing|pay|overdue|amount|bank|iban)\b/.test(prompt)) {
    add('requestType', 'Type of payment-related request, such as invoice or payment reminder');
    add('amount', 'Requested amount if present');
    add('currency', 'Currency code or symbol if present');
    add('dueDate', 'Due date if mentioned');
    add('invoiceNumber', 'Invoice or billing reference if present');
    add('counterparty', 'Sender, vendor, or customer requesting payment');
    add('reason', 'Why the event matched the payment-related criteria');
  }

  if (/\b(urgent|priority|asap|immediately|important|critical)\b/.test(prompt)) {
    add('priority', 'Priority level inferred from the message');
    add('urgencyReason', 'Why the message should be treated as urgent');
    add('deadline', 'Deadline or time sensitivity if mentioned');
  }

  if (/\b(action item|todo|task|follow up|follow-up|next step)\b/.test(prompt)) {
    add('actionItem', 'Concrete next action extracted from the event');
    add('owner', 'Likely owner or responsible person if identifiable');
    add('deadline', 'Deadline for the action if present');
    add('status', 'Initial task status such as new or pending');
  }

  if (/\b(lead|prospect|sales|deal|opportunity)\b/.test(prompt)) {
    add('company', 'Company or account name');
    add('contact', 'Primary contact name or email if present');
    add('stage', 'Sales stage or inferred opportunity stage');
    add('interest', 'What the lead is interested in');
  }

  if (/\b(support|incident|bug|issue|ticket|complaint)\b/.test(prompt)) {
    add('issueType', 'Type of issue or support request');
    add('severity', 'Severity or impact level');
    add('customer', 'Customer or reporter');
    add('product', 'Affected product or area if present');
  }

  if (/\b(meeting|call|appointment|schedule)\b/.test(prompt)) {
    add('meetingDate', 'Meeting or appointment date');
    add('meetingTime', 'Meeting or appointment time');
    add('participants', 'Participants if present');
    add('location', 'Meeting location or link');
  }

  if (!fields.some((item) => item.name === 'reason')) {
    add('reason', 'Why the event matched or was included');
  }

  return fields;
}

function buildChannelFeedDecisionSystemPrompt(task) {
  const filterMode =
    task && typeof task.filterMode === 'string' ? task.filterMode : 'pass-through';
  const expectedFields =
    task && Array.isArray(task.expectedFields) ? task.expectedFields : [];
  const guidance =
    filterMode === 'ai-filter'
      ? 'Decide whether the event should be included. Return JSON with include, value, and attributes.'
      : 'Always include the event unless it is empty or clearly irrelevant. Return JSON with include, value, and attributes.';
  return [
    'You evaluate one channel event against one spreadsheet formula prompt.',
    guidance,
    'Return only valid JSON with this shape:',
    '{"include":true,"value":"...","attributes":{"summary":"..."}}',
    'If the event does not match, return {"include":false,"value":"","attributes":{}}.',
    expectedFields.length
      ? `Populate attributes using these fields when possible: ${expectedFields
          .map((field) => `${field.name} (${field.meaning})`)
          .join(', ')}.`
      : 'Keep attributes minimal and relevant.',
  ].join(' ');
}

function parseChannelFeedDecisionResponse(text) {
  try {
    const parsed = JSON.parse(String(text == null ? '' : text));
    const include = parsed && parsed.include === true;
    const value = String((parsed && parsed.value) || '').trim();
    const attributes =
      parsed && parsed.attributes && typeof parsed.attributes === 'object'
        ? parsed.attributes
        : {};
    return { include, value, attributes };
  } catch (error) {
    return {
      include: false,
      value: '',
      attributes: {
        parseError: error && error.message ? error.message : String(error),
      },
    };
  }
}

function buildChannelFeedWindowStart(days) {
  const count = Math.max(1, parseInt(days, 10) || 1);
  const today = startOfToday();
  return new Date(today.getTime() - (count - 1) * 24 * 60 * 60 * 1000);
}

async function hydrateChannelEventForPrompt(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const source = { ...doc };
  const attachments = Array.isArray(doc.attachments) ? doc.attachments : [];
  source.attachments = await Promise.all(
    attachments.map(async (attachment) => {
      const item =
        attachment && typeof attachment === 'object' ? { ...attachment } : null;
      if (!item) return item;
      if (!item.content && item.contentArtifactId) {
        try {
          item.content = await getArtifactText(String(item.contentArtifactId || ''));
        } catch (error) {
          item.content = '';
        }
      }
      if (!item.downloadUrl && (item.binaryArtifactId || item.contentArtifactId)) {
        item.downloadUrl = buildChannelAttachmentPath(
          String(doc.channelId || ''),
          String(doc._id || ''),
          String(item.id || item.binaryArtifactId || item.contentArtifactId || ''),
        );
      }
      return item;
    }),
  );
  return source;
}

async function loadChannelEventsForWindow(label, days, afterCreatedAt) {
  const selector = {
    label: {
      $regex: `^${escapeRegex(normalizeChannelLabel(label))}$`,
      $options: 'i',
    },
    createdAt: {
      $gte: buildChannelFeedWindowStart(days),
    },
  };
  if (afterCreatedAt instanceof Date) {
    selector.createdAt.$gt = afterCreatedAt;
  }
  const docs = await ChannelEvents.find(selector, {
    sort: { createdAt: 1, _id: 1 },
  }).fetchAsync();
  return Promise.all(docs.map((doc) => hydrateChannelEventForPrompt(doc)));
}

function stripJsonFences(text) {
  const source = String(text == null ? '' : text).trim();
  if (!source) return '';
  const fenced = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? String(fenced[1] || '').trim() : source;
}

function parseBatchAIResponse(text) {
  return JSON.parse(stripJsonFences(text));
}

function buildChannelBatchSystemPrompt() {
  return [
    'Return only valid JSON.',
    'Return a JSON array with one item per jobId.',
    'Do not include markdown, prose, or code fences.',
    'Each object must include jobId and formulaKind.',
    'For ask formulas return {"jobId":"...","formulaKind":"ask","value":"..."}.',
    'For list formulas return {"jobId":"...","formulaKind":"list","items":["..."]}.',
    'For table formulas return {"jobId":"...","formulaKind":"table","rows":[["..."]]}',
    'Keep every provided jobId exactly unchanged.',
  ].join(' ');
}

function collectChannelBatchTasks(
  sheetDocumentId,
  workbook,
  channelLabel,
  channelPayloads,
  options = {},
) {
  const adapter = new WorkbookStorageAdapter(workbook);
  const storageService = new StorageService(adapter);
  const aiService = new AIService(storageService, () => {}, {
    sheetDocumentId,
    getActiveSheetId: () => '',
  });
  const formulaEngine = new FormulaEngine(
    storageService,
    aiService,
    () => storageService.readTabs(),
    [],
  );
  const target = normalizeChannelLabel(channelLabel);
  const historyOnly = !!(options && options.historyOnly);
  const tasks = [];
  const sheets =
    workbook && workbook.sheets && typeof workbook.sheets === 'object'
      ? workbook.sheets
      : {};

  Object.keys(sheets).forEach((sheetId) => {
    const cells =
      sheets[sheetId] && typeof sheets[sheetId].cells === 'object'
        ? sheets[sheetId].cells
        : {};
    Object.keys(cells).forEach((cellId) => {
      const cell =
        cells[cellId] && typeof cells[cellId] === 'object' ? cells[cellId] : {};
      const source = String(cell.source || '');
      if (!source) return;
      const channelFeedSpec =
        source.charAt(0) === '#'
          ? formulaEngine.parseChannelFeedPromptSpec(source)
          : null;
      const channelLogSpec = parseBareChannelLogSpec(source);
      const listSpec =
        source.charAt(0) === '>'
          ? formulaEngine.parseListShortcutSpec(source)
          : null;
      const formulaKind = channelFeedSpec
        ? 'channel-feed'
        : channelLogSpec
          ? 'channel-log'
          : source.charAt(0) === "'"
            ? 'ask'
            : source.charAt(0) === '>'
              ? 'list'
              : source.charAt(0) === '#'
                ? 'table'
                : '';
      if (!formulaKind) return;
      if (
        historyOnly &&
        formulaKind !== 'channel-feed' &&
        formulaKind !== 'channel-log'
      ) {
        return;
      }
      if (
        (formulaKind === 'channel-feed' || formulaKind === 'channel-log') &&
        normalizeChannelLabel(
          formulaKind === 'channel-log'
            ? channelLogSpec && channelLogSpec.label
            : channelFeedSpec &&
                Array.isArray(channelFeedSpec.labels) &&
                channelFeedSpec.labels.length
              ? channelFeedSpec.labels[0]
              : '',
        ) !== target
      ) {
        return;
      }
      if (extractChannelMentionLabels(source).indexOf(target) === -1) return;

      let promptTemplate = '';
      let count = null;
      let colsLimit = null;
      let rowsLimit = null;
      let days = null;
      let includeAttachments = false;
      if (formulaKind === 'ask') {
        const askSpec =
          typeof formulaEngine.parseFormulaDisplayPlaceholder === 'function'
            ? formulaEngine.parseFormulaDisplayPlaceholder(source.substring(1))
            : { content: source.substring(1) };
        promptTemplate = formulaEngine.normalizeQueuedPromptTemplate(
          askSpec && askSpec.content ? askSpec.content : source.substring(1),
        );
      } else if (formulaKind === 'list') {
        promptTemplate = listSpec && listSpec.prompt ? listSpec.prompt : '';
        count = 5;
        includeAttachments = !!(listSpec && listSpec.includeAttachments);
      } else if (formulaKind === 'channel-feed') {
        promptTemplate =
          channelFeedSpec && channelFeedSpec.prompt ? channelFeedSpec.prompt : '';
        days = channelFeedSpec && channelFeedSpec.days ? channelFeedSpec.days : 1;
        includeAttachments = !!(
          channelFeedSpec && channelFeedSpec.includeAttachments
        );
      } else if (formulaKind === 'channel-log') {
        promptTemplate = `/${target}`;
        days = channelLogSpec && channelLogSpec.days ? channelLogSpec.days : 30;
      } else if (formulaKind === 'table') {
        const spec = formulaEngine.parseTablePromptSpec(source);
        promptTemplate = spec && spec.prompt ? spec.prompt : '';
        colsLimit = spec && spec.cols ? spec.cols : null;
        rowsLimit = spec && spec.rows ? spec.rows : null;
      }
      if (!promptTemplate) return;

      const prepared = formulaEngine.prepareAIPrompt(
        sheetId,
        promptTemplate,
        {},
        { channelPayloads, includeChannelAttachments: includeAttachments },
      );
      tasks.push({
        jobId: `${sheetId}:${String(cellId || '').toUpperCase()}:${formulaKind}`,
        sheetId,
        cellId: String(cellId || '').toUpperCase(),
        formulaKind,
        promptTemplate,
        prompt: prepared.userPrompt,
        systemPrompt: prepared.systemPrompt,
        attachmentLinks: Array.isArray(prepared.attachmentLinks)
          ? prepared.attachmentLinks
          : [],
        count,
        colsLimit,
        rowsLimit,
        days,
        includeAttachments,
        filterMode:
          formulaKind === 'channel-feed'
            ? inferChannelFeedFilterMode(promptTemplate)
            : 'pass-through',
        expectedFields:
          formulaKind === 'channel-feed'
            ? inferChannelFeedExpectedFields(promptTemplate)
            : [],
      });
    });
  });

  return { tasks, storageService, formulaEngine };
}

export async function runChannelBatchForWorkbook({
  sheetDocumentId,
  workbook,
  channelLabel,
  channelPayloads,
  historyOnly = false,
}) {
  const collected = collectChannelBatchTasks(
    sheetDocumentId,
    workbook,
    channelLabel,
    channelPayloads,
    { historyOnly },
  );
  const tasks = collected.tasks;
  if (!tasks.length) return workbook;

  const target = normalizeChannelLabel(channelLabel);
  const storageService = collected.storageService;
  const formulaEngine = collected.formulaEngine;
  const currentPayload =
    channelPayloads && channelPayloads[target] ? channelPayloads[target] : null;
  const currentEventId =
    currentPayload && (currentPayload.eventId || currentPayload._id)
      ? String(currentPayload.eventId || currentPayload._id)
      : '';
  const batchedTasks = tasks.filter(
    (task) =>
      task.formulaKind !== 'channel-feed' &&
      task.formulaKind !== 'channel-log',
  );
  const feedTasks = tasks.filter((task) => task.formulaKind === 'channel-feed');
  const logTasks = tasks.filter((task) => task.formulaKind === 'channel-log');

  if (batchedTasks.length) {
    const messages = [];
    const uniqueSystemPrompts = batchedTasks
      .map((task) => String(task.systemPrompt || '').trim())
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index);
    if (uniqueSystemPrompts.length) {
      messages.push({
        role: 'system',
        content: uniqueSystemPrompts.join('\n\n'),
      });
    }
    messages.push({ role: 'system', content: buildChannelBatchSystemPrompt() });
    messages.push({
      role: 'user',
      content: JSON.stringify(
        batchedTasks.map((task) => ({
          jobId: task.jobId,
          formulaKind: task.formulaKind,
          prompt: task.prompt,
          count: task.count,
          colsLimit: task.colsLimit,
          rowsLimit: task.rowsLimit,
        })),
      ),
    });

    const responseText = await enqueueAIChatRequest(
      messages,
      {
        sheetDocumentId,
        activeSheetId: '',
        sourceCellId: `channel-batch:${target}`,
        formulaKind: 'channel-batch',
        queueIdentity: `${sheetDocumentId}:channel-batch:${target}`,
        dependencies: [{ kind: 'channel', label: target }],
      },
      { timeoutMs: 180000 },
    );

    const parsed = parseBatchAIResponse(responseText);
    const byJobId = {};
    (Array.isArray(parsed) ? parsed : []).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const jobId = String(item.jobId || '');
      if (!jobId) return;
      byJobId[jobId] = item;
    });

    batchedTasks.forEach((task) => {
      const item = byJobId[task.jobId];
      if (!item) return;
      const previousProcessed =
        storageService.getCellProcessedChannelEventIds(
          task.sheetId,
          task.cellId,
        ) || {};
      const shouldAppend = !!(
        previousProcessed[target] &&
        currentEventId &&
        previousProcessed[target] !== currentEventId
      );

      if (task.formulaKind === 'ask') {
        let value = String(item.value == null ? '' : item.value);
        const markdown = buildAttachmentLinksMarkdown(task.attachmentLinks);
        if (markdown) {
          value = value ? `${value}\n\n${markdown}` : markdown;
        }
        storageService.setComputedCellValue(
          task.sheetId,
          task.cellId,
          value,
          'resolved',
          '',
        );
      } else if (task.formulaKind === 'list') {
        const values = Array.isArray(item.items)
          ? item.items
              .map((entry) => String(entry == null ? '' : entry))
              .filter((entry) => entry.trim() !== '')
          : [];
        formulaEngine.spillMatrixToSheet(
          task.sheetId,
          task.cellId,
          values.map((value) => [value]),
          {
            preserveSourceCell: true,
            appendBelowExisting: shouldAppend,
          },
        );
        if (!shouldAppend) {
          storageService.clearGeneratedCellsBySource(task.sheetId, task.cellId);
          formulaEngine.fillUnderneathCells(
            task.sheetId,
            task.cellId,
            values,
            0,
          );
        } else {
          const source = formulaEngine.parseCellId(task.cellId);
          const existing =
            storageService.listGeneratedCellsBySource(
              task.sheetId,
              task.cellId,
            ) || [];
          let maxRow = source ? source.row : 0;
          existing.forEach((cellId) => {
            const parsedCell = formulaEngine.parseCellId(cellId);
            if (parsedCell && parsedCell.row > maxRow) maxRow = parsedCell.row;
          });
          const colLabel = source
            ? formulaEngine.columnIndexToLabel(source.col)
            : 'A';
          for (let i = 0; i < values.length; i += 1) {
            const targetCellId = `${colLabel}${maxRow + i + 1}`;
            storageService.setCellValue(task.sheetId, targetCellId, values[i], {
              generatedBy: task.cellId,
            });
          }
        }
      } else if (task.formulaKind === 'table') {
        const rows = Array.isArray(item.rows) ? item.rows : [];
        formulaEngine.spillMatrixToSheet(task.sheetId, task.cellId, rows, {
          preserveSourceCell: true,
          appendBelowExisting: shouldAppend,
        });
      }

      storageService.setCellRuntimeState(task.sheetId, task.cellId, {
        state: 'resolved',
        error: '',
        lastProcessedChannelEventIds: currentEventId
          ? { [target]: currentEventId }
          : {},
      });
    });
  }

  for (let index = 0; index < logTasks.length; index += 1) {
    const task = logTasks[index];
    const eventDocs = await loadChannelEventsForWindow(target, task.days, null);
    const rows = [];
    let latestProcessedEventId = '';
    const newestFirstDocs = eventDocs.slice().reverse();
    for (let eventIndex = 0; eventIndex < newestFirstDocs.length; eventIndex += 1) {
      const eventPayload = newestFirstDocs[eventIndex];
      if (!eventPayload) continue;
      rows.push(formatUnifiedChannelEventRow(eventPayload));
      if (!latestProcessedEventId) {
        latestProcessedEventId = String(
          eventPayload.eventId || eventPayload._id || '',
        );
      }
    }

    formulaEngine.spillMatrixToSheet(task.sheetId, task.cellId, rows, {
      preserveSourceCell: true,
    });

    storageService.setCellRuntimeState(task.sheetId, task.cellId, {
      state: 'resolved',
      error: '',
      lastProcessedChannelEventIds: latestProcessedEventId
        ? { [target]: latestProcessedEventId }
        : {},
    });
  }

  for (let index = 0; index < feedTasks.length; index += 1) {
    const task = feedTasks[index];
    const previousProcessed =
      storageService.getCellProcessedChannelEventIds(task.sheetId, task.cellId) ||
      {};
    const previousEventId = String(previousProcessed[target] || '');
    let previousCreatedAt = null;
    if (previousEventId) {
      const previousDoc = await ChannelEvents.findOneAsync(
        { _id: previousEventId },
        { fields: { createdAt: 1 } },
      );
      if (previousDoc && previousDoc.createdAt instanceof Date) {
        previousCreatedAt = previousDoc.createdAt;
      }
    }

    const shouldAppend = !!previousCreatedAt;
    const eventDocs = await loadChannelEventsForWindow(
      target,
      task.days,
      shouldAppend ? previousCreatedAt : null,
    );
    console.log('[channel-feed] task.start', {
      sheetDocumentId,
      channelLabel: target,
      sheetId: task.sheetId,
      cellId: task.cellId,
      days: task.days,
      filterMode: task.filterMode,
      shouldAppend,
      events: eventDocs.length,
    });
    const values = [];
    let latestProcessedEventId = previousEventId;
    let lastDecisionAttributes = {};
    let lastDecisionValue = '';
    let lastEvaluatedEventId = previousEventId;
    let lastIncludedEventId = previousEventId;

    for (let eventIndex = 0; eventIndex < eventDocs.length; eventIndex += 1) {
      const eventPayload = eventDocs[eventIndex];
      if (!eventPayload) continue;
      const taskPrompt = stripChannelMentionsFromPrompt(task.promptTemplate);
      if (!taskPrompt) continue;
      const prepared = formulaEngine.prepareAIPrompt(
        task.sheetId,
        taskPrompt,
        {},
        { includeChannelAttachments: !!task.includeAttachments },
      );
      const eventText = formatChannelEventForPrompt(eventPayload, {
        includeAttachments: !!task.includeAttachments,
      });
      const finalPrompt = [
        `Task: ${prepared.userPrompt || taskPrompt}`,
        '',
        'Channel event:',
        eventText,
      ]
        .filter((part) => String(part || '').trim() !== '')
        .join('\n')
        .trim();
      if (!finalPrompt) continue;
      const responseText = await enqueueAIChatRequest(
        [
          {
            role: 'system',
            content: buildChannelFeedDecisionSystemPrompt(task),
          },
          ...(prepared.systemPrompt
            ? [{ role: 'system', content: String(prepared.systemPrompt) }]
            : []),
          {
            role: 'user',
            content: finalPrompt,
          },
        ],
        {
          sheetDocumentId,
          activeSheetId: task.sheetId,
          sourceCellId: task.cellId,
          formulaKind: 'channel-feed',
          queueIdentity: `${sheetDocumentId}:channel-feed:${task.sheetId}:${task.cellId}:${String(eventPayload._id || '')}`,
          dependencies: [{ kind: 'channel', label: target }],
        },
        { timeoutMs: 180000 },
      );
      const decision = parseChannelFeedDecisionResponse(responseText);
      const eventId = String(eventPayload.eventId || eventPayload._id || '');
      lastEvaluatedEventId = eventId || lastEvaluatedEventId;
      lastDecisionAttributes =
        decision && decision.attributes && typeof decision.attributes === 'object'
          ? decision.attributes
          : {};
      lastDecisionValue = String(
        decision && decision.value ? decision.value : '',
      ).trim();
      if (decision.include !== true || !lastDecisionValue) {
        console.log('[channel-feed] task.skip', {
          sheetDocumentId,
          sheetId: task.sheetId,
          cellId: task.cellId,
          eventId,
          filterMode: task.filterMode,
          attributes: lastDecisionAttributes,
        });
        latestProcessedEventId = eventId || latestProcessedEventId;
        continue;
      }
      const markdown = buildAttachmentLinksMarkdown(
        getChannelAttachmentLinkEntries(eventPayload, {
          includeAttachments: !!task.includeAttachments,
        }),
      );
      const value = markdown
        ? `${String(responseText || '').trim()}\n\n${markdown}`.trim()
        : String(responseText || '').trim();
      if (!value) continue;
      values.push(value);
      console.log('[channel-feed] task.value', {
        sheetDocumentId,
        sheetId: task.sheetId,
        cellId: task.cellId,
        eventId: String(eventPayload.eventId || eventPayload._id || ''),
        preview: value.slice(0, 160),
      });
      latestProcessedEventId = String(
        eventPayload.eventId || eventPayload._id || latestProcessedEventId || '',
      );
    }

    if (!shouldAppend) {
      formulaEngine.spillMatrixToSheet(
        task.sheetId,
        task.cellId,
        values.map((value) => [value]),
        {
          preserveSourceCell: true,
        },
      );
      console.log('[channel-feed] task.write.replace', {
        sheetDocumentId,
        sheetId: task.sheetId,
        cellId: task.cellId,
        rows: values.length,
        generated: storageService.listGeneratedCellsBySource(
          task.sheetId,
          task.cellId,
        ),
      });
    } else if (values.length) {
      const previousGenerated =
        storageService.listGeneratedCellsBySource(task.sheetId, task.cellId) || [];
      formulaEngine.spillMatrixToSheet(
        task.sheetId,
        task.cellId,
        values.map((value) => [value]),
        {
          preserveSourceCell: true,
          appendBelowExisting: true,
        },
      );
      const nextGenerated =
        storageService.listGeneratedCellsBySource(task.sheetId, task.cellId) || [];
      const writtenIds = nextGenerated.filter(
        (cellId) => previousGenerated.indexOf(cellId) === -1,
      );
      console.log('[channel-feed] task.write.append', {
        sheetDocumentId,
        sheetId: task.sheetId,
        cellId: task.cellId,
        rows: values.length,
        writtenIds,
      });
    }

    storageService.setCellRuntimeState(task.sheetId, task.cellId, {
      state: 'resolved',
      error: '',
      lastProcessedChannelEventIds: latestProcessedEventId
        ? { [target]: latestProcessedEventId }
        : {},
      channelFeedMeta: {
        filterMode: String(task.filterMode || 'pass-through'),
        decisionMode: 'ai-envelope',
        promptTemplate: String(task.promptTemplate || ''),
        lastDecisionAt: new Date().toISOString(),
        lastEvaluatedEventId: String(lastEvaluatedEventId || ''),
        lastIncludedEventId: String(lastIncludedEventId || ''),
        lastValuePreview: String(lastDecisionValue || '').slice(0, 500),
        lastAttributes: lastDecisionAttributes,
      },
    });
  }

  return storageService.storage &&
    typeof storageService.storage.snapshot === 'function'
    ? storageService.storage.snapshot()
    : workbook;
}
