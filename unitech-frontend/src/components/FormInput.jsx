import { useEffect, useId, useRef } from 'react';
import { triggerShake } from '../utils/animations';

/**
 * FormInput - Input field with shake animation on error
 * 
 * Props:
 *   - label: string
 *   - error: string (error message)
 *   - onErrorShake: boolean (default: true, shows shake on error)
 *   - ... all standard input attributes
 */
export function FormInput({
  label,
  error,
  onErrorShake = true,
  className = '',
  id,
  ...props
}) {
  const inputRef = useRef(null);
  const reactId = useId();
  const errorId = id ? `${id}-error` : `input-error-${reactId}`;
  const inputId = id || `input-${reactId}`;

  useEffect(() => {
    if (error && onErrorShake && inputRef.current) {
      triggerShake(inputRef.current);
    }
  }, [error, onErrorShake]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
        </label>
      )}
      <input
        id={inputId}
        ref={inputRef}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`px-3 py-2 rounded-md border transition-colors-smooth focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-300 bg-red-50 focus:ring-red-500 text-red-900'
            : 'border-slate-300 bg-white focus:ring-indigo-500'
        }`}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

/**
 * FormSelect - Select field with shake animation on error
 */
export function FormSelect({
  label,
  error,
  onErrorShake = true,
  className = '',
  children,
  ...props
}) {
  const selectRef = useRef(null);

  useEffect(() => {
    if (error && onErrorShake && selectRef.current) {
      triggerShake(selectRef.current);
    }
  }, [error, onErrorShake]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <select
        ref={selectRef}
        className={`px-3 py-2 rounded-md border transition-colors-smooth focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-300 bg-red-50 focus:ring-red-500 text-red-900'
            : 'border-slate-300 bg-white focus:ring-indigo-500'
        }`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

/**
 * FormTextarea - Textarea field with shake animation on error
 */
export function FormTextarea({
  label,
  error,
  onErrorShake = true,
  className = '',
  ...props
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (error && onErrorShake && textareaRef.current) {
      triggerShake(textareaRef.current);
    }
  }, [error, onErrorShake]);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-slate-700">
          {label}
          {props.required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <textarea
        ref={textareaRef}
        className={`px-3 py-2 rounded-md border transition-colors-smooth focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-300 bg-red-50 focus:ring-red-500 text-red-900'
            : 'border-slate-300 bg-white focus:ring-indigo-500'
        }`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

export default FormInput;
