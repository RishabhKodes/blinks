"use client";

import { useEffect } from "react";
import { useApp } from "./AppProvider";

function ToastItem({
  id,
  message,
  type,
  onDismiss,
}: {
  id: string;
  message: string;
  type: "success" | "error";
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  const borderColor = type === "success" ? "border-l-emerald-500" : "border-l-red-500";

  return (
    <div
      className={`flex items-center gap-3 bg-surface border border-edge border-l-4 ${borderColor} rounded-lg px-5 py-3.5 shadow-lg animate-slide-up min-w-[300px] max-w-[440px]`}
    >
      <p className="text-base text-ink flex-1">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="text-ink-faint hover:text-ink-secondary text-base shrink-0"
      >
        x
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={removeToast}
          />
        </div>
      ))}
    </div>
  );
}
