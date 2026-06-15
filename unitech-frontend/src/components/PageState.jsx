/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

export function usePageLoadingVisibility(isLoading, minimumDuration = 450) {
  const [isVisible, setIsVisible] = useState(isLoading);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let timer;

    if (isLoading) {
      startedAtRef.current = Date.now();
      timer = setTimeout(() => setIsVisible(true), 0);
      return undefined;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(minimumDuration - elapsed, 0);
    timer = setTimeout(() => setIsVisible(false), remaining);

    return () => clearTimeout(timer);
  }, [isLoading, minimumDuration]);

  return isVisible;
}

export function PageBanner({ tone = 'info', title, message, action = null }) {
  const previousMessageRef = useRef('');

  useEffect(() => {
    if (!message) return;
    const payload = title ? `${title}\n${message}` : String(message);
    if (previousMessageRef.current === payload) return;
    previousMessageRef.current = payload;

    const toastOptions = { duration: 2500 };
    if (tone === 'success') {
      toast.success(payload, toastOptions);
    } else if (tone === 'error') {
      toast.error(payload, toastOptions);
    } else if (tone === 'warning') {
      toast(payload, toastOptions);
    } else {
      toast(payload, toastOptions);
    }
  }, [tone, title, message]);

  return action ? <div className="sr-only">{action}</div> : null;
}

export function PageLoadingState({ title = 'Chargement...', message = 'Les donnees de la page sont en cours de chargement.' }) {
  return (
    <div className="min-h-[320px] rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 p-8 shadow-sm">
      <div className="flex min-h-[256px] flex-col items-center justify-center text-center">
        <div className="relative mb-5">
          <div className="h-16 w-16 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-indigo-600 border-r-sky-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
        <div className="mt-6 flex gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.2s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-sky-500 [animation-delay:-0.1s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-emerald-500" />
        </div>
      </div>
    </div>
  );
}

export function PageErrorState({
  title = 'Une erreur est survenue',
  message = 'Impossible de charger cette page pour le moment.',
  action = null,
}) {
  return (
    <div className="rounded-lg border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-rose-700">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
