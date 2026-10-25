import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Teknik Detaylar (Google Drive ayarları) girişi.
 * - E-posta: Vercel ortam değişkeni `TEKNIK_EMAIL`
 * - Şifre: `TEKNIK_PASSWORD` tanımlıysa o, değilse aşağıdaki SHA-256 özeti (depo herkese açık olduğu için düz yazılmaz)
 * - Oturum: `TEKNIK_SESSION_SECRET` (yoksa `GOOGLE_CLIENT_SECRET`) ile imzalı, httpOnly çerez
 */

const DEFAULT_PASSWORD_SHA256 = "08c8c0e5d592540fdb3c03ddebbf2fd26ec029117e1bc743ccb86109bc5cf92b";
export const TEKNIK_COOKIE = "teknik_session";
export const TEKNIK_SESSION_MAX_AGE = 60 * 60 * 12; // 12 saat

function sha256(val: string) {
  return createHash("sha256").update(val, "utf8").digest();
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

function sessionSecret(): string | null {
  return (
    process.env.TEKNIK_SESSION_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || null
  );
}

export function teknikLoginConfigError(): string | null {
  if (!process.env.TEKNIK_EMAIL?.trim()) {
    return "Giriş e-postası tanımlı değil. Vercel → Settings → Environment Variables bölümüne TEKNIK_EMAIL ekleyin.";
  }
  if (!sessionSecret()) {
    return "Oturum anahtarı tanımlı değil. Vercel'e TEKNIK_SESSION_SECRET ekleyin.";
  }
  return null;
}

export function checkTeknikCredentials(email: string, password: string): boolean {
  const allowedEmail = (process.env.TEKNIK_EMAIL ?? "").trim().toLowerCase();
  if (!allowedEmail) return false;
  const emailOk = safeEqual(sha256(email.trim().toLowerCase()), sha256(allowedEmail));
  const envPassword = process.env.TEKNIK_PASSWORD;
  const expected = envPassword ? sha256(envPassword) : Buffer.from(DEFAULT_PASSWORD_SHA256, "hex");
  const passOk = safeEqual(sha256(password), expected);
  return emailOk && passOk;
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createTeknikSession(email: string): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("Oturum anahtarı tanımlı değil");
  const exp = Date.now() + TEKNIK_SESSION_MAX_AGE * 1000;
  const payload = `${exp}.${Buffer.from(email.trim().toLowerCase()).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyTeknikSession(token: string | undefined | null): boolean {
  const secret = sessionSecret();
  if (!token || !secret) return false;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!safeEqual(Buffer.from(sig), Buffer.from(sign(payload, secret)))) return false;
  const [expStr, emailB64] = payload.split(".");
  if (!(Number(expStr) > Date.now())) return false;
  // TEKNIK_EMAIL değiştirilirse eski oturumlar geçersiz olur
  const allowedEmail = (process.env.TEKNIK_EMAIL ?? "").trim().toLowerCase();
  return Buffer.from(emailB64 ?? "", "base64url").toString() === allowedEmail;
}
