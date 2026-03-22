export function setupReportLiveInteractions(app) {
  if (!app || !app.reportLive || app.reportLiveInteractionsBound) return;
  app.reportLiveInteractionsBound = true;

  app.reportLive.addEventListener('change', (e) => {
    var input =
      e.target && e.target.closest
        ? e.target.closest('.report-linked-input')
        : null;
    if (!input) return;
    app.applyLinkedReportInput(input);
  });

  app.reportLive.addEventListener('click', (e) => {
    var reportTabButton =
      e.target && e.target.closest
        ? e.target.closest('.report-tab-nav-button')
        : null;
    if (reportTabButton) {
      e.preventDefault();
      app.activateReportTab(reportTabButton.dataset.reportTabKey || '');
      return;
    }
    var fileButton =
      e.target && e.target.closest
        ? e.target.closest('.report-file-button')
        : null;
    var removeButton =
      e.target && e.target.closest
        ? e.target.closest('.report-file-remove')
        : null;
    if (fileButton || removeButton) {
      var shell = (fileButton || removeButton).closest('.report-file-shell');
      if (!shell) return;
      e.preventDefault();
      e.stopPropagation();
      app.handleReportFileShellAction(shell, !!removeButton);
      return;
    }
  });

  app.reportLive.addEventListener('focusin', (e) => {
    var input =
      e.target && e.target.closest
        ? e.target.closest('.report-linked-input')
        : null;
    if (!input) return;
    app.refreshLinkedReportInputValue(input);
  });

  app.reportLive.addEventListener('keydown', (e) => {
    var input =
      e.target && e.target.closest
        ? e.target.closest('.report-linked-input')
        : null;
    if (!input) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      app.applyLinkedReportInput(input);
      input.blur();
    }
  });

  app.reportLive.addEventListener('click', (e) => {
    var link =
      e.target && e.target.closest
        ? e.target.closest('.report-internal-link')
        : null;
    if (!link) return;
    e.preventDefault();
    app.followReportInternalLink(link);
  });
}
