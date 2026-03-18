async function buildQueuedPayload(queueMeta) {
  if (
    !queueMeta ||
    !queueMeta.sheetDocumentId ||
    typeof loadSheetDocumentStorageHook !== 'function'
  ) {
    return null;
  }

  const workbookData = await loadSheetDocumentStorageHook(
    queueMeta.sheetDocumentId,
  );
  if (!workbookData) return null;

  const rawStorage = new WorkbookStorageAdapter(workbookData);
  const storageService = new StorageService(rawStorage);
  const channelPayloads =
    typeof loadChannelPayloadsHook === 'function'
      ? (await loadChannelPayloadsHook()) || {}
      : {};
  const aiService = new AIService(storageService, () => {}, {
    sheetDocumentId: queueMeta.sheetDocumentId,
    getActiveSheetId: () => String(queueMeta.activeSheetId || ''),
  });
  const formulaEngine = new FormulaEngine(
    storageService,
    aiService,
    () => storageService.readTabs(),
    buildCellIds(workbookData),
  );

  const sourceSheetId = String(queueMeta.activeSheetId || '');
  const sourceCellId = String(queueMeta.sourceCellId || '').toUpperCase();
  let promptTemplate = String(queueMeta.promptTemplate || '');
  let queueMetaUpdates = null;

  if (sourceSheetId && sourceCellId) {
    const currentRaw = String(
      storageService.getCellValue(sourceSheetId, sourceCellId) || '',
    );
    const kind = String(queueMeta.formulaKind || '');

    if (kind === 'ask') {
      if (currentRaw.charAt(0) === "'") {
        promptTemplate =
          typeof formulaEngine.normalizeQueuedPromptTemplate === 'function'
            ? formulaEngine.normalizeQueuedPromptTemplate(
                currentRaw.substring(1),
              )
            : String(currentRaw.substring(1).trim());
        if (!promptTemplate) return null;
        queueMetaUpdates = {
          ...(queueMetaUpdates || {}),
          promptTemplate,
        };
      }
    } else if (kind === 'list') {
      if (currentRaw.charAt(0) === '>') {
        const listSpec =
          typeof formulaEngine.parseListShortcutSpec === 'function'
            ? formulaEngine.parseListShortcutSpec(currentRaw)
            : null;
        if (!listSpec || !String(listSpec.prompt || '')) return null;
        promptTemplate = String(listSpec.prompt || '');
        queueMetaUpdates = {
          ...(queueMetaUpdates || {}),
          promptTemplate,
          count: Math.max(1, Math.min(50, parseInt(queueMeta.count, 10) || 5)),
        };
      }
    } else if (kind === 'table') {
      if (currentRaw.charAt(0) === '#') {
        const tableSpec =
          typeof formulaEngine.parseTablePromptSpec === 'function'
            ? formulaEngine.parseTablePromptSpec(currentRaw)
            : null;
        if (!tableSpec || !String(tableSpec.prompt || '')) return null;
        promptTemplate = String(tableSpec.prompt || '');
        queueMetaUpdates = {
          ...(queueMetaUpdates || {}),
          promptTemplate,
          colsLimit: parseInt(tableSpec.cols, 10) || null,
          rowsLimit: parseInt(tableSpec.rows, 10) || null,
        };
      }
    }
  }

  return aiService.withRequestsSuppressed(() => {
    const runtimeOptions = { channelPayloads };

    if (queueMeta.formulaKind === 'formula-fallback') {
      const prepared = formulaEngine.buildUnknownFormulaFallbackRequest(
        sourceSheetId,
        String(queueMeta.sourceCellId || '').toUpperCase(),
        promptTemplate,
        runtimeOptions,
      );

      return {
        messages: [
          { role: 'system', content: prepared.systemPrompt },
          { role: 'user', content: prepared.userContent || prepared.userPrompt },
        ],
        dependencies: prepared.dependencies,
        queueMetaUpdates,
      };
    }

    const dependencies = formulaEngine.collectAIPromptDependencies(
      sourceSheetId,
      promptTemplate,
      runtimeOptions,
    );

    const dependenciesResolved = formulaEngine.arePromptDependenciesResolved(
      sourceSheetId,
      promptTemplate,
      runtimeOptions,
    );

    if (!dependenciesResolved) {
      return {
        pendingDependencies: true,
        dependencies,
        queueMetaUpdates,
      };
    }

    const prepared = formulaEngine.prepareAIPrompt(
      sourceSheetId,
      promptTemplate,
      {},
      runtimeOptions,
    );

    if (
      containsPendingPromptMarker(prepared.userPrompt) ||
      containsPendingPromptMarker(prepared.systemPrompt)
    ) {
      return {
        pendingDependencies: true,
        dependencies,
        queueMetaUpdates,
      };
    }

    const buildUserContent = (text) =>
      aiService.buildUserMessageContent(text, prepared.userContent);

    const enrich = (messages) =>
      aiService
        .enrichPromptWithFetchedUrls(prepared.userPrompt)
        .then((finalPrompt) => {
          const nextMessages = messages.slice();
          nextMessages[nextMessages.length - 1] = {
            role: 'user',
            content: buildUserContent(finalPrompt),
          };
          return {
            messages: nextMessages,
            dependencies,
            queueMetaUpdates,
          };
        });

    if (queueMeta.formulaKind === 'list') {
      const count = Math.max(
        1,
        Math.min(50, parseInt(queueMeta.count, 10) || 5),
      );
      const messages = [];
      if (prepared.systemPrompt) {
        messages.push({ role: 'system', content: prepared.systemPrompt });
      }
      messages.push({ role: 'system', content: buildListInstruction(count) });
      messages.push({
        role: 'user',
        content: buildUserContent(prepared.userPrompt),
      });
      return enrich(messages);
    }

    if (queueMeta.formulaKind === 'table') {
      const colsLimit = parseInt(queueMeta.colsLimit, 10) || null;
      const rowsLimit = parseInt(queueMeta.rowsLimit, 10) || null;
      const messages = [];
      if (prepared.systemPrompt) {
        messages.push({ role: 'system', content: prepared.systemPrompt });
      }
      messages.push({
        role: 'system',
        content: buildTableInstruction(colsLimit, rowsLimit),
      });
      messages.push({
        role: 'user',
        content: buildUserContent(prepared.userPrompt),
      });
      return enrich(messages);
    }

    const messages = [];
    if (prepared.systemPrompt) {
      messages.push({ role: 'system', content: prepared.systemPrompt });
    }
    messages.push({
      role: 'user',
      content: buildUserContent(prepared.userPrompt),
    });
    return enrich(messages);
  });
}