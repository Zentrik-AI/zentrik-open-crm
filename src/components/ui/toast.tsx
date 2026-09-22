import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, Info, ShieldAlert, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { type Tone } from "../../lib/meta";
import { toneSolidBg, toneText } from "../../lib/tone";

type ToastInput = { title: string; tone?: Tone; icon?: LucideIcon; duration?: number };
type ToastItem = Required<Omit<ToastInput, "icon">> & { id: number; icon?: LucideIcon };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const defaultIcon: Record<Tone, LucideIcon> = {
  neutral: Info,
  accent: Info,
  signal: Info,
  account: Info,
  agent: Info,
  highlight: Info,
  success: Check,
  warning: ShieldAlert,
  destructive: ShieldAlert,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((t: ToastInput) => {
    const id = ++idRef.current;
    const item: ToastItem = {
      id,
      title: t.title,
      tone: t.tone ?? "accent",
      duration: t.duration ?? 4000,
      icon: t.icon,
    };
    setToasts((cur) => [...cur.slice(-3), item]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 left-4 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
            role="region"
            aria-label="Notifications"
            aria-live="polite"
          >
            {toasts.map((t) => (
              <ToastCard key={t.id} item={t} onDone={() => remove(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const Icon = item.icon ?? defaultIcon[item.tone];
  const [phase, setPhase] = useState<"enter" | "in" | "out">("enter");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase("in"));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setPhase("out"), item.duration);
    return () => clearTimeout(t);
  }, [item.duration]);
  useEffect(() => {
    if (phase !== "out") return;
    const t = setTimeout(onDone, 240);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  const stamp = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(
    new Date(),
  );

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-lg border border-border bg-surface py-2.5 pl-3 pr-3 shadow-e2 transition-[opacity,transform] duration-base ease-out",
        phase === "in" ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", toneSolidBg[item.tone])} aria-hidden />
      <Icon className={cn("mt-px h-4 w-4 shrink-0", toneText[item.tone])} aria-hidden />
      <div className="min-w-0 flex-1 text-body-sm text-foreground">{item.title}</div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint-foreground">{stamp}</span>
      <span
        className="absolute bottom-0 left-0 h-0.5 bg-accent/70"
        style={{ animation: `shrink-x ${item.duration}ms linear forwards` }}
        aria-hidden
      />
    </div>
  );
}
