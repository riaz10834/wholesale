"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; type: "success" | "error"; text: string };
const Ctx = createContext<{ success: (t: string) => void; error: (t: string) => void }>({
  success: () => {},
  error: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((type: Toast["type"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={{ success: (t) => push("success", t), error: (t) => push("error", t) }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border bg-white p-3 text-sm shadow-card ${
              t.type === "success" ? "border-emerald-200" : "border-rose-200"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            )}
            <p className="flex-1 text-slate-700">{t.text}</p>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
