export function getMentionAutocompleteContext(app, input) {
  if (!input) return null;
  var range =
    app && typeof app.getEditorSelectionRange === 'function'
      ? app.getEditorSelectionRange(input)
      : {
          start:
            typeof input.selectionStart === 'number' ? input.selectionStart : 0,
          end: typeof input.selectionEnd === 'number' ? input.selectionEnd : 0,
        };
  var start = range.start;
  var end = range.end;
  if (start !== end) return null;
  var value = String(input.value == null ? '' : input.value);
  var left = value.slice(0, start);
  var match = /(^|[^A-Za-z0-9_])(@@?|\/)([A-Za-z0-9_-]*)$/.exec(left);
  if (!match) return null;
  var marker = match[2];
  var query = match[3] || '';
  var markerStart = start - (marker.length + query.length);
  if (markerStart < 0) return null;
  return {
    marker: marker,
    query: query,
    start: markerStart,
    end: start,
  };
}

export function getMentionAutocompleteItems(app, query, marker) {
  var target = String(query == null ? '' : query).toLowerCase();
  var items = [];
  var seen = {};
  var addItem = (kind, label, token, search) => {
    var key = token.toLowerCase();
    if (seen[key]) return;
    var hay = (
      String(label) +
      ' ' +
      String(search || '') +
      ' ' +
      String(token)
    ).toLowerCase();
    if (target && hay.indexOf(target) === -1) return;
    seen[key] = true;
    items.push({
      kind: kind,
      label: label,
      token: token,
      search: search || '',
    });
  };

  if (marker === '/') {
    for (var ch = 0; ch < app.availableChannels.length; ch++) {
      var channel = app.availableChannels[ch];
      if (!channel || !channel.label) continue;
      addItem(
        'channel',
        '/' + channel.label,
        '/' + channel.label,
        channel.label + ' channel',
      );
    }
    items.sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );
    return items.slice(0, 16);
  }

  var named = app.storage.readNamedCells();
  var namedKeys = Object.keys(named || {}).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  for (var i = 0; i < namedKeys.length; i++) {
    var name = namedKeys[i];
    var ref = named[name] || {};
    var location =
      ref.cellId ||
      (ref.startCellId && ref.endCellId
        ? ref.startCellId + ':' + ref.endCellId
        : '');
    addItem(
      'named',
      '@' + name + (location ? '  ' + location : ''),
      marker + name,
      name + ' ' + location,
    );
  }

  var reportTabs = [];
  for (var t = 0; t < app.tabs.length; t++) {
    var tab = app.tabs[t];
    if (!tab) continue;
    if (app.isReportTab(tab.id)) reportTabs.push(tab);
  }
  if (reportTabs.length)
    addItem('report', '@report', marker + 'report', 'report default');
  for (var r = 0; r < reportTabs.length; r++) {
    var reportAlias = 'report' + (r + 1);
    addItem(
      'report',
      '@' + reportAlias + '  ' + reportTabs[r].name,
      marker + reportAlias,
      reportTabs[r].name + ' ' + reportAlias,
    );
  }

  for (var s = 0; s < app.tabs.length; s++) {
    var sheet = app.tabs[s];
    if (!sheet || app.isReportTab(sheet.id)) continue;
    var escaped = String(sheet.name || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");
    addItem(
      'sheet',
      '@' + sheet.name + '!A1',
      marker + "'" + escaped + "'!A1",
      sheet.name + ' sheet',
    );
  }

  items.sort((a, b) => {
    var aw = a.token.toLowerCase().indexOf(target) === marker.length ? 0 : 1;
    var bw = b.token.toLowerCase().indexOf(target) === marker.length ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
  return items.slice(0, 16);
}
