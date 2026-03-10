import { useEffect, useMemo, useState } from "react";
import { HELP_SECTIONS } from "./helpContent.js";

function renderHelpItem(text) {
  const lines = String(text || "").split("\n");
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(`[^`]+`)/g).filter(Boolean);
    return (
      <span key={`${line}-${lineIndex}`} className="help-line">
        {parts.map((part, index) => {
          if (part.charAt(0) === "`" && part.charAt(part.length - 1) === "`") {
            return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>;
          }
          return <span key={`${part}-${index}`}>{part}</span>;
        })}
      </span>
    );
  });
}

export function HelpOverlay({ isOpen, onClose }) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const filteredSections = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return HELP_SECTIONS;

    return HELP_SECTIONS.map((section) => {
      const titleMatches = section.title.toLowerCase().includes(normalizedQuery);
      const items = titleMatches
        ? section.items
        : section.items.filter((item) => String(item).toLowerCase().includes(normalizedQuery));
      return { ...section, items };
    }).filter((section) => section.items.length > 0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(event) => event.stopPropagation()}>
        <div className="help-modal-head">
          <div>
            <h2>Help</h2>
            <p>Commands, shortcuts, examples, and report patterns.</p>
          </div>
          <button type="button" className="help-close" onClick={onClose} aria-label="Close help">×</button>
        </div>
        <div className="help-search-row">
          <input
            className="help-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search formulas, mentions, reports, files..."
          />
        </div>
        <div className="help-grid">
          {filteredSections.length ? (
            filteredSections.map((section) => (
              <section
                key={section.title}
                className={`help-card help-card-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <h3>{section.title}</h3>
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{renderHelpItem(item)}</li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <section className="help-card help-card-empty">
              <h3>No matches</h3>
              <p>Try a broader search like <strong>file</strong>, <strong>report</strong>, <strong>update</strong>, or <strong>@idea</strong>.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
