export const aiAttachmentMethods = {
  stripAIPromptImagePlaceholders(text) {
    return String(text == null ? '' : text)
      .replace(
        /\b(on|in)\s+<attached image:\s*[^>]+>(?=[ \t.,!?:;\-]|$)/gim,
        'in this image',
      )
      .replace(
        /\b(from)\s+<attached image:\s*[^>]+>(?=[ \t.,!?:;\-]|$)/gim,
        '$1 this image',
      )
      .replace(/(^|[ \t])<attached image:\s*[^>]+>(?=[ \t]|$)/gim, '$1this image')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+\?/g, '?')
      .replace(/\s+([.,!;:])/g, '$1')
      .trim();
  },

  getAttachmentForCell(sheetId, cellId, options) {
    var targetSheetId = String(sheetId || '');
    var targetCellId = String(cellId || '').toUpperCase();
    if (
      !targetSheetId ||
      !targetCellId ||
      typeof this.parseAttachmentSource !== 'function'
    )
      return null;
    var raw = String(
      this.storageService.getCellValue(targetSheetId, targetCellId) || '',
    );
    var computed =
      this.storageService &&
      typeof this.storageService.getCellComputedValue === 'function'
        ? String(
            this.storageService.getCellComputedValue(
              targetSheetId,
              targetCellId,
            ) || '',
          )
        : '';
    var attachment =
      this.parseAttachmentSource(raw) || this.parseAttachmentSource(computed);
    if (!attachment) return null;
    if (typeof this.recordDependencyAttachment === 'function') {
      this.recordDependencyAttachment(options, targetSheetId, targetCellId);
    }
    return {
      sheetId: targetSheetId,
      cellId: targetCellId,
      name: String(attachment.name || targetCellId),
      type: String(attachment.type || ''),
      binaryArtifactId: String(attachment.binaryArtifactId || ''),
      url: String(attachment.previewUrl || ''),
      downloadUrl: String(attachment.downloadUrl || ''),
      previewUrl: String(attachment.previewUrl || ''),
      content: this.resolveAttachmentContentOrThrow(
        attachment,
        targetSheetId,
        targetCellId,
      ),
    };
  },

  getImageAttachmentForCell(sheetId, cellId, options) {
    var attachment = this.getAttachmentForCell(sheetId, cellId, options);
    if (!attachment) return null;
    var type = String(attachment.type || '').toLowerCase();
    var previewUrl = String(
      attachment.previewUrl || attachment.downloadUrl || attachment.url || '',
    );
    if (type.indexOf('image/') !== 0 || !previewUrl) return null;
    return {
      sheetId: attachment.sheetId,
      cellId: attachment.cellId,
      name: String(attachment.name || attachment.cellId),
      type: String(attachment.type || ''),
      binaryArtifactId: String(attachment.binaryArtifactId || ''),
      url: previewUrl,
      downloadUrl: String(attachment.downloadUrl || previewUrl),
    };
  },

  getTextAttachmentForCell(sheetId, cellId, options) {
    var attachment = this.getAttachmentForCell(sheetId, cellId, options);
    if (!attachment) return null;
    var type = String(attachment.type || '').toLowerCase();
    if (type.indexOf('image/') === 0) return null;
    if (!String(attachment.content || '').trim()) return null;
    return attachment;
  },

  resolveImageAttachmentMention(sheetId, token, options) {
    var sourceSheetId = String(sheetId || '');
    var rawToken = String(token || '').trim();
    if (!rawToken) return null;

    var sheetCellMatch =
      /^(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)$/.exec(
        rawToken,
      );
    if (sheetCellMatch) {
      var sheetName = sheetCellMatch[1] || sheetCellMatch[2] || '';
      var refSheetId = this.findSheetIdByName(sheetName);
      if (!refSheetId) return null;
      return this.getImageAttachmentForCell(
        refSheetId,
        sheetCellMatch[3],
        options,
      );
    }

    var localCellMatch = /^([A-Za-z]+[0-9]+)$/.exec(rawToken);
    if (localCellMatch) {
      return this.getImageAttachmentForCell(
        sourceSheetId,
        localCellMatch[1],
        options,
      );
    }

    var named = this.storageService.resolveNamedCell(rawToken);
    if (named && named.sheetId && named.cellId) {
      return this.getImageAttachmentForCell(
        named.sheetId,
        named.cellId,
        options,
      );
    }
    return null;
  },

  resolveTextAttachmentMention(sheetId, token, options) {
    var sourceSheetId = String(sheetId || '');
    var rawToken = String(token || '').trim();
    if (!rawToken) return null;

    var sheetCellMatch =
      /^(?:'([^']+)'|([A-Za-z][A-Za-z0-9 _-]*))!([A-Za-z]+[0-9]+)$/.exec(
        rawToken,
      );
    if (sheetCellMatch) {
      var sheetName = sheetCellMatch[1] || sheetCellMatch[2] || '';
      var refSheetId = this.findSheetIdByName(sheetName);
      if (!refSheetId) return null;
      return this.getTextAttachmentForCell(
        refSheetId,
        sheetCellMatch[3],
        options,
      );
    }

    var localCellMatch = /^([A-Za-z]+[0-9]+)$/.exec(rawToken);
    if (localCellMatch) {
      return this.getTextAttachmentForCell(
        sourceSheetId,
        localCellMatch[1],
        options,
      );
    }

    var named = this.storageService.resolveNamedCell(rawToken);
    if (named && named.sheetId && named.cellId) {
      return this.getTextAttachmentForCell(
        named.sheetId,
        named.cellId,
        options,
      );
    }
    return null;
  },

  appendAIPromptImageAttachment(options, attachment) {
    if (!attachment || !options || typeof options !== 'object') return;
    if (!options.aiImageAttachments) options.aiImageAttachments = [];
    var list = options.aiImageAttachments;
    var key = [attachment.sheetId, attachment.cellId, attachment.url].join(':');
    for (var i = 0; i < list.length; i++) {
      var existing = list[i];
      if (!existing) continue;
      var existingKey = [existing.sheetId, existing.cellId, existing.url].join(
        ':',
      );
      if (existingKey === key) return;
    }
    list.push(attachment);
  },

  appendAIPromptTextAttachment(options, attachment) {
    if (!attachment || !options || typeof options !== 'object') return;
    if (!options.aiTextAttachments) options.aiTextAttachments = [];
    var list = options.aiTextAttachments;
    var key = [attachment.sheetId, attachment.cellId, attachment.name].join(':');
    for (var i = 0; i < list.length; i++) {
      var existing = list[i];
      if (!existing) continue;
      var existingKey = [
        existing.sheetId,
        existing.cellId,
        existing.name,
      ].join(':');
      if (existingKey === key) return;
    }
    list.push(attachment);
  },

  buildTextAttachmentUserContentPart(attachment) {
    if (!attachment) return null;
    var name = String(attachment.name || attachment.cellId || 'file').trim();
    var content = String(attachment.content || '').trim();
    if (!content) return null;
    return {
      type: 'text',
      text: ['Attached file: ' + name, content].join('\n\n'),
    };
  },

  buildAIUserContent(userPrompt, imageAttachments, textAttachments) {
    var text = String(userPrompt == null ? '' : userPrompt).trim();
    var files = Array.isArray(textAttachments)
      ? textAttachments.filter((item) => item && item.content)
      : [];
    var images = Array.isArray(imageAttachments)
      ? imageAttachments.filter((item) => item && item.url)
      : [];
    if (images.length) {
      text = this.stripAIPromptImagePlaceholders(text);
    }
    if (!files.length && !images.length) return text;
    var parts = [];
    if (text) parts.push({ type: 'text', text: text });
    for (var j = 0; j < files.length; j++) {
      var textPart = this.buildTextAttachmentUserContentPart(files[j]);
      if (textPart) parts.push(textPart);
    }
    for (var i = 0; i < images.length; i++) {
      parts.push({
        type: 'image_url',
        image_url: {
          url: String(images[i].url || ''),
        },
      });
    }
    return parts;
  },
};
