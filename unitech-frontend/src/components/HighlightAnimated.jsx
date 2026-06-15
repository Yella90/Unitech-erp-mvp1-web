import { useEffect, useState } from 'react';

/**
 * HighlightRow - Row component with highlight animation on mount
 * Used for newly added items in lists/tables
 * 
 * Props:
 *   - children: React node
 *   - className: string (additional classes)
 *   - duration: number (highlight duration in ms, default: 2000)
 *   - isNew: boolean (whether to show highlight animation, default: true)
 */
export function HighlightRow({
  children,
  className = '',
  duration = 2000,
  isNew = true,
  ...props
}) {
  const [shouldHighlight, setShouldHighlight] = useState(isNew);

  useEffect(() => {
    if (!isNew) {
      const timer = setTimeout(() => setShouldHighlight(false), 0);
      return () => clearTimeout(timer);
    }

    const startTimer = setTimeout(() => setShouldHighlight(true), 0);
    const timer = setTimeout(() => {
      setShouldHighlight(false);
    }, duration);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [isNew, duration]);

  return (
    <tr
      className={`transition-all-smooth ${
        shouldHighlight ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

/**
 * HighlightCell - Table cell with highlight effect
 * Props:
 *   - children: React node
 *   - className: string
 *   - isNew: boolean
 *   - duration: number (default: 2000)
 */
export function HighlightCell({
  children,
  className = '',
  isNew = true,
  duration = 2000,
  ...props
}) {
  const [shouldHighlight, setShouldHighlight] = useState(isNew);

  useEffect(() => {
    if (!isNew) {
      const timer = setTimeout(() => setShouldHighlight(false), 0);
      return () => clearTimeout(timer);
    }

    const startTimer = setTimeout(() => setShouldHighlight(true), 0);
    const timer = setTimeout(() => {
      setShouldHighlight(false);
    }, duration);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [isNew, duration]);

  return (
    <td
      className={`transition-all-smooth ${
        shouldHighlight ? 'bg-yellow-100' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * HighlightDiv - Generic div with highlight animation
 * Props:
 *   - children: React node
 *   - className: string
 *   - isNew: boolean
 *   - duration: number (default: 2000)
 */
export function HighlightDiv({
  children,
  className = '',
  isNew = true,
  duration = 2000,
  ...props
}) {
  const [shouldHighlight, setShouldHighlight] = useState(isNew);

  useEffect(() => {
    if (!isNew) {
      const timer = setTimeout(() => setShouldHighlight(false), 0);
      return () => clearTimeout(timer);
    }

    const startTimer = setTimeout(() => setShouldHighlight(true), 0);
    const timer = setTimeout(() => {
      setShouldHighlight(false);
    }, duration);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(timer);
    };
  }, [isNew, duration]);

  return (
    <div
      className={`transition-all-smooth ${
        shouldHighlight ? 'bg-yellow-50 border-2 border-yellow-300 rounded-lg' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default HighlightRow;
