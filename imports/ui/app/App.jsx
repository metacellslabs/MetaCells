import { useEffect, useState } from 'react';
import { HelpOverlay } from '../help/HelpOverlay.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { SheetPage } from './pages/SheetPage.jsx';

export const App = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname || '/');
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const metacellMatch = path.match(/^\/metacell\/([^/]+)(?:\/([^/]+))?$/);
  const legacySheetMatch = path.match(/^\/sheet\/([^/]+)(?:\/([^/]+))?$/);
  const reportMatch = path.match(/^\/report\/([^/]+)\/([^/]+)$/);
  const sheetMatch = metacellMatch || legacySheetMatch;

  let page = <HomePage />;
  if (reportMatch) {
    page = (
      <SheetPage
        sheetId={decodeURIComponent(reportMatch[1])}
        initialTabId={decodeURIComponent(reportMatch[2])}
        onOpenHelp={() => setIsHelpOpen(true)}
        publishedMode={true}
      />
    );
  } else if (sheetMatch) {
    page = (
      <SheetPage
        sheetId={decodeURIComponent(sheetMatch[1])}
        initialTabId={sheetMatch[2] ? decodeURIComponent(sheetMatch[2]) : ''}
        onOpenHelp={() => setIsHelpOpen(true)}
      />
    );
  } else if (path === '/settings') {
    page = <SettingsPage />;
  }

  return (
    <>
      <HelpOverlay isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      {page}
    </>
  );
};
