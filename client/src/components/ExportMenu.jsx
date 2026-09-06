import { useEffect, useRef, useState } from 'react';
import { risksApi } from '../api/risksApi';

const FORMATS = [
  { key: 'html', label: 'HTML', icon: '🌐' },
  { key: 'pdf', label: 'PDF', icon: '📄' },
  { key: 'csv', label: 'CSV', icon: '📑' },
  { key: 'excel', label: 'Excel', icon: '📊' },
];

export default function ExportMenu({ filters }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn btn-secondary" onClick={() => setOpen((v) => !v)}>
        ⬇ Export <span className="caret">▾</span>
      </button>
      {open && (
        <div className="export-dropdown">
          {FORMATS.map((f) => (
            <a
              key={f.key}
              className="export-option"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                risksApi.downloadExport(f.key, filters).catch((err) => alert(`Export failed: ${err.message}`));
              }}
            >
              <span>{f.icon}</span> Export as {f.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
