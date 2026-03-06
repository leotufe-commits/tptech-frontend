// src/lib/toast.ts
export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastPayload = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  durationMs?: number;
};

const EVENT_NAME = "tptech:toast";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toastBase(payload: Omit<ToastPayload, "id">) {
  const full: ToastPayload = {
    id: uid(),
    durationMs: 3200,
    ...payload,
  };

  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT_NAME, { detail: full }));
}

type ToastOpts = { title?: string; durationMs?: number };

export const toast = Object.assign(toastBase, {
  success: (message: string, opts?: ToastOpts) =>
    toastBase({ variant: "success", message, ...opts }),
  error: (message: string, opts?: ToastOpts) =>
    toastBase({ variant: "error", message, ...opts }),
  warning: (message: string, opts?: ToastOpts) =>
    toastBase({ variant: "warning", message, ...opts }),
  info: (message: string, opts?: ToastOpts) =>
    toastBase({ variant: "info", message, ...opts }),
});

export function onToast(handler: (t: ToastPayload) => void) {
  const listener = (ev: Event) => {
    const ce = ev as CustomEvent<ToastPayload>;
    if (!ce.detail) return;
    handler(ce.detail);
  };

  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
