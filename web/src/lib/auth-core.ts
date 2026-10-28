import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Teknik Detaylar ve Yönetici Paneli girişleri için ortak imzalı oturum yardımcıları.
 * Oturum anahtarı: `TEKNIK_SESSION_SECRET` (yoksa `GOOGLE_CLIENT_SECRET`).
 */

export function sha256(val: string) {
  return createHash("sha256").update(val, "utf8").digest();
}

export function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionSecret(): string | null {
  return (
    process.env.TEKNIK_SESSION_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim() || null
  );
}

export function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** `scope.exp.email` yükünü imzalar */
export function createSession(scope: string, email: string, maxAgeSec: number): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("Oturum anahtarı tanımlı değil");
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = `${scope}.${exp}.${Buffer.from(normalizeEmail(email)).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** İmza, süre ve e-postanın hâlâ izinli olup olmadığını kontrol eder; geçerliyse e-postayı döner */
export function verifySession(
  scope: string,
  token: string | undefined | null,
  allowedEmails: string[],
): string | null {
  const secret = sessionSecret();
  if (!token || !secret) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!safeEqual(Buffer.from(sig), Buffer.from(sign(payload, secret)))) return null;
  const [tokenScope, expStr, emailB64] = payload.split(".");
  if (tokenScope !== scope || !(Number(expStr) > Date.now())) return null;
  const email = Buffer.from(emailB64 ?? "", "base64url").toString();
  // İzinli listeden çıkarılan hesabın (örn. admin) oturumu hemen geçersiz olur
  return allowedEmails.includes(email) ? email : null;
}
