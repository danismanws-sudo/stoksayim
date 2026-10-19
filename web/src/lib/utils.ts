import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const dtf = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const tf = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (iso: string) => dtf.format(new Date(iso));
export const fmtTime = (iso: string) => tf.format(new Date(iso));

/** Barkodu depolama yolunda güvenle kullanılabilir hale getirir. */
export const safePathPart = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

/** Supabase/Postgres hata kodundan Türkçe mesaj. */
export function humanError(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (!err) return "Bilinmeyen hata";
  if (err.code === "23505") return "Bu barkod bu operasyonda zaten kayıtlı.";
  if (err.code === "42501") return "Bu işlem için yetkiniz yok.";
  if (err.message?.includes("Failed to fetch")) return "İnternet bağlantısı yok.";
  return err.message ?? "Bilinmeyen hata";
}
