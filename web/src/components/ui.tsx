"use client";

import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------- Button ---------------- */
type Variant = "primary" | "scan" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_8px_24px_-8px_rgb(53_82_200/0.7)] hover:bg-brand-strong active:scale-[0.98]",
  scan: "bg-scan text-white shadow-[0_10px_30px_-8px_rgb(229_36_47/0.7)] hover:brightness-110 active:scale-[0.98]",
  ghost: "bg-transparent text-ink-dim hover:bg-white/5 hover:text-ink",
  outline: "border border-line-strong bg-white/[0.02] text-ink hover:bg-white/5",
  danger: "bg-scan-soft text-scan border border-scan/30 hover:bg-scan/20",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "h-11 px-4 text-sm rounded-xl gap-2",
  lg: "h-13 px-5 text-base rounded-2xl gap-2",
  xl: "h-16 px-6 text-lg rounded-2xl gap-3",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all duration-150 select-none",
        "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ---------------- Input ---------------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-12 w-full rounded-xl border border-line-strong bg-surface-2/80 px-4 text-[15px] text-ink",
        "placeholder:text-ink-mute outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15",
        className,
      )}
      {...rest}
    />
  );
});

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-semibold text-ink-dim">
        {label}
        {required && <span className="ml-1 text-scan">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

/* ---------------- Card / Badge ---------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass rounded-[var(--radius-card)]", className)}>{children}</div>;
}

type Tone = "neutral" | "brand" | "ok" | "warn" | "scan";
const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-ink-dim border-line",
  brand: "bg-brand-soft text-[#9fb1ff] border-brand/30",
  ok: "bg-ok-soft text-ok border-ok/30",
  warn: "bg-warn-soft text-warn border-warn/30",
  scan: "bg-scan-soft text-[#ff7a82] border-scan/30",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

/* ---------------- Logo ---------------- */
export function BarcodeMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Dört Köşe Kırmızı Vizör Çerçevesi */}
      <path
        d="M4 17V9C4 6.79086 5.79086 5 8 5H18"
        stroke="#E5242F"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M46 5H56C58.2091 5 60 6.79086 60 9V17"
        stroke="#E5242F"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M4 39V47C4 49.2091 5.79086 51 8 51H18"
        stroke="#E5242F"
        strokeWidth="3.8"
        strokeLinecap="round"
      />
      <path
        d="M46 51H56C58.2091 51 60 49.2091 60 47V39"
        stroke="#E5242F"
        strokeWidth="3.8"
        strokeLinecap="round"
      />

      {/* Üst Barkod Çubukları */}
      <rect x="13" y="13" width="3.2" height="11" rx="1" fill="#E5242F" />
      <rect x="19" y="13" width="4.8" height="11" rx="1" fill="#E5242F" />
      <rect x="27" y="13" width="2.8" height="11" rx="1" fill="#E5242F" />
      <rect x="33" y="13" width="5.2" height="11" rx="1" fill="#E5242F" />
      <rect x="41" y="13" width="3.0" height="11" rx="1" fill="#E5242F" />
      <rect x="47" y="13" width="4.0" height="11" rx="1" fill="#E5242F" />

      {/* Alt Barkod Çubukları */}
      <rect x="13" y="32" width="3.2" height="11" rx="1" fill="#E5242F" />
      <rect x="19" y="32" width="4.8" height="11" rx="1" fill="#E5242F" />
      <rect x="27" y="32" width="2.8" height="11" rx="1" fill="#E5242F" />
      <rect x="33" y="32" width="5.2" height="11" rx="1" fill="#E5242F" />
      <rect x="41" y="32" width="3.0" height="11" rx="1" fill="#E5242F" />
      <rect x="47" y="32" width="4.0" height="11" rx="1" fill="#E5242F" />

      {/* Orta Lazer Okuma Çizgisi */}
      <line
        x1="3"
        y1="28"
        x2="61"
        y2="28"
        stroke="#FF2E3B"
        strokeWidth="3.2"
        strokeLinecap="round"
        className={animated ? "animate-pulse" : undefined}
      />
    </svg>
  );
}

export function Logo({
  className,
  compact,
  size = "md",
}: {
  className?: string;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const iconSizes = {
    sm: "w-9 h-8",
    md: "w-11 h-10",
    lg: "w-16 h-14",
  };
  const titleSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
  };
  const subSizes = {
    sm: "text-[9px] tracking-[0.22em]",
    md: "text-[11px] tracking-[0.24em]",
    lg: "text-sm tracking-[0.28em]",
  };

  return (
    <div className={cn("inline-flex items-center gap-3 select-none", className)}>
      <div className="relative grid place-items-center rounded-2xl border border-scan/25 bg-gradient-to-b from-scan/15 to-transparent p-2 shadow-[0_0_25px_-5px_rgb(229_36_47/0.35)]">
        <BarcodeMark className={iconSizes[size]} animated />
      </div>
      {!compact && (
        <div className="leading-none">
          <div
            className={cn(
              "font-black tracking-wider bg-gradient-to-r from-white via-[#eef2ff] to-[#9fb1ff] bg-clip-text text-transparent",
              titleSizes[size],
            )}
          >
            DETAY
          </div>
          <div className="my-1 h-[2px] w-full rounded-full bg-gradient-to-r from-brand via-[#5e7aff] to-transparent" />
          <div className={cn("font-extrabold text-[#8fa4ff]", subSizes[size])}>
            STOK SAYIM
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Spinner ---------------- */
export function FullScreenLoader({ label = "Yükleniyor…" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 text-ink-dim">
      <Loader2 className="size-7 animate-spin text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ---------------- Bottom Sheet (mobil) / Modal (masaüstü) ---------------- */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissable?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismissable ? onClose : undefined}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-surface sm:max-w-lg sm:rounded-3xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            {(title || dismissable) && (
              <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
                <div className="text-lg font-bold">{title}</div>
                {dismissable && (
                  <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/5 text-ink-dim hover:bg-white/10" aria-label="Kapat">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && <div className="safe-bottom border-t border-line bg-surface px-5 pt-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Kurulum uyarısı ---------------- */
export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <Logo />
      <Card className="p-6">
        <h1 className="text-xl font-bold">Veritabanı bağlantısı bekleniyor</h1>
        <p className="mt-2 text-sm text-ink-dim">
          <code className="rounded bg-white/5 px-1.5 py-0.5">web/.env.local</code> dosyasına Supabase adresini ve anahtarını
          ekleyin, ardından uygulamayı yeniden başlatın. Şablon: <code className="rounded bg-white/5 px-1.5 py-0.5">.env.example</code>
        </p>
      </Card>
    </div>
  );
}
