export function ensureReportUI(app) {
  if (app.reportWrap && app.reportEditor && app.reportLive) return;
  var wrap = document.querySelector('.report-wrap');
  if (!wrap) return;
  app.reportWrap = wrap;
  app.reportEditor = wrap.querySelector('#report-editor');
  app.reportLive = wrap.querySelector('#report-live');
}
