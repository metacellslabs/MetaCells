import {
  buildChannelAttachmentLinkSystemPrompt,
  formatChannelEventForPrompt,
  getChannelAttachmentLinkEntries,
  normalizeChannelLabel,
} from '../../api/channels/mentioning.js';

export const aiChannelMethods = {
  getChannelPayloadMap(options) {
    var source =
      options &&
      typeof options === 'object' &&
      options.channelPayloads &&
      typeof options.channelPayloads === 'object'
        ? options.channelPayloads
        : {};
    return source;
  },

  shouldIncludeChannelAttachments(options) {
    return !!(
      options &&
      typeof options === 'object' &&
      options.includeChannelAttachments === true
    );
  },

  getChannelMentionValue(label, options) {
    var key = normalizeChannelLabel(label);
    if (!key) return '';
    var map = this.getChannelPayloadMap(options);
    return formatChannelEventForPrompt(map[key] || null, {
      includeAttachments: this.shouldIncludeChannelAttachments(options),
    });
  },

  buildChannelAttachmentSystemPrompt(labels, options) {
    var map = this.getChannelPayloadMap(options);
    var instructions = [];
    var seen = {};
    var source = Array.isArray(labels) ? labels : [];
    for (var i = 0; i < source.length; i++) {
      var key = normalizeChannelLabel(source[i]);
      if (!key || seen[key]) continue;
      seen[key] = true;
      var instruction = buildChannelAttachmentLinkSystemPrompt(
        map[key] || null,
        {
          includeAttachments: this.shouldIncludeChannelAttachments(options),
        },
      );
      if (instruction) instructions.push(instruction);
    }
    return instructions.join('\n');
  },

  buildChannelAttachmentLinks(labels, options) {
    var map = this.getChannelPayloadMap(options);
    var results = [];
    var seen = {};
    var source = Array.isArray(labels) ? labels : [];
    for (var i = 0; i < source.length; i++) {
      var key = normalizeChannelLabel(source[i]);
      if (!key) continue;
      var entries = getChannelAttachmentLinkEntries(map[key] || null, {
        includeAttachments: this.shouldIncludeChannelAttachments(options),
      });
      for (var j = 0; j < entries.length; j++) {
        var item = entries[j];
        var dedupeKey = String(item.name || '') + '::' + String(item.url || '');
        if (!item || !item.url || seen[dedupeKey]) continue;
        seen[dedupeKey] = true;
        results.push(item);
      }
    }
    return results;
  },

  getCurrentChannelEventIds(labels, options) {
    var map = this.getChannelPayloadMap(options);
    var result = {};
    var source = Array.isArray(labels) ? labels : [];
    for (var i = 0; i < source.length; i++) {
      var key = normalizeChannelLabel(source[i]);
      if (!key) continue;
      var payload = map[key] || null;
      var eventId =
        payload && (payload.eventId || payload._id)
          ? String(payload.eventId || payload._id)
          : '';
      if (!eventId) continue;
      result[key] = eventId;
    }
    return result;
  },

  shouldAppendForChannelEvent(sheetId, sourceCellId, channelLabels, options) {
    var labels = Array.isArray(channelLabels) ? channelLabels : [];
    if (!labels.length) return false;
    if (
      !this.storageService ||
      typeof this.storageService.getCellProcessedChannelEventIds !== 'function'
    )
      return false;
    var previous =
      this.storageService.getCellProcessedChannelEventIds(
        sheetId,
        sourceCellId,
      ) || {};
    var current = this.getCurrentChannelEventIds(labels, options);
    var changed = false;
    var hadPrevious = false;

    Object.keys(current).forEach((label) => {
      if (previous[label]) hadPrevious = true;
      if (previous[label] && previous[label] !== current[label]) {
        changed = true;
      }
    });

    return hadPrevious && changed;
  },

  isChannelDependencyResolved(label, options) {
    return !!this.getChannelMentionValue(label, options);
  },
};
