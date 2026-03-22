export function renderReportLiveValues(app, forceRender) {
  if (!app.reportEditor || !app.reportLive) return;
  if (app.reportMode !== 'view' && !forceRender) return;
  var root = document.createElement('div');
  root.innerHTML = app.reportEditor.innerHTML || '';
  app.replaceMentionNodes(root);
  app.renderReportMarkdownNodes(root);
  var html = root.innerHTML.trim();
  var nextHtml = html || '<p></p>';
  if (!forceRender && app.lastReportLiveHtml === nextHtml) return;
  app.lastReportLiveHtml = nextHtml;
  app.reportLive.innerHTML = nextHtml;
  app.injectLinkedInputsFromPlaceholders(app.reportLive);
  app.decorateReportTabs(app.reportLive);
  if (!app.reportLive.innerHTML.trim()) {
    app.reportLive.innerHTML = '<p></p>';
  }
  if (typeof app.publishUiState === 'function') {
    app.publishUiState();
  }
}
