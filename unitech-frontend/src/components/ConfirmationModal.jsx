/**
 * ConfirmationModal with fade-in animation
 * Props:
 *   - isOpen: boolean
 *   - title: string
 *   - message: string
 *   - confirmLabel: string (default: "Confirmer")
 *   - cancelLabel: string (default: "Annuler")
 *   - onConfirm: function
 *   - onCancel: function
 *   - isLoading: boolean (shows spinner on confirm button)
 *   - isDangerous: boolean (colors button red)
 */
export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  isLoading = false,
  isDangerous = false,
}) {
  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-all ${
        'bg-opacity-50'
      }`}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`transform rounded-lg bg-white p-6 shadow-2xl transition-all ${
          'scale-100 opacity-100 animate-fadeInScale'
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '90vw', width: '400px' }}
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition-colors-smooth"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors-smooth flex items-center gap-2 ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-500'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-500'
            } disabled:opacity-75`}
          >
            {isLoading && (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;
