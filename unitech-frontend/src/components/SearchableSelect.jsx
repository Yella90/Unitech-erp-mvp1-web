import { useEffect, useMemo, useRef, useState } from 'react';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Rechercher...',
  emptyLabel = 'Aucun resultat',
  className = '',
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(selectedOption?.label || '');
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedOption]);

  useEffect(() => {
    function handleOutside(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery(selectedOption?.label || '');
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    const needle = normalizeText(query);
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = normalizeText(`${option.label} ${option.keywords || ''}`);
      return haystack.includes(needle);
    });
  }, [options, query]);

  function handleSelect(option) {
    setQuery(option.label);
    setOpen(false);
    onChange?.(option.value, option);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (!event.target.value.trim()) {
            onChange?.('', null);
          }
        }}
        className="w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {open ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => handleSelect(option)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  String(option.value) === String(value) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">{emptyLabel}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SearchableSelect;
