import { createSession, normalizeEmail, safeEqual, sessionSecret, sha256, verifySession } from "./auth-core";

/**
 * Teknik Detaylar (Google Drive ayarları) girişi.
 * - E-posta: Vercel ortam değişkeni `TEKNIK_EMAIL`
 * - Şifre: `TEKNIK_PASSWORD` tanımlıysa o, değilse aşağıdaki SHA-256 özeti (depo herkese açık olduğu için düz yazılmaz)
 * - Oturum: `TEKNIK_SESSION_SECRET` (yoksa `GOOGLE_CLIENT_SECRET`) ile imzalı, httpOnly çerez
 */

const DEFAULT_PASSWORD_SHA256 = "08c8c0e5d592540fdb3c03ddebbf2fd26ec029117e1bc743ccb86109bc5cf92b";
export const TEKNIK_COOKIE = "teknik_session";
export const TEKNIK_SESSION_MAX_AGE = 60 * 60 * 12; // 12 saat

function allowedEmails() {
  const email = normalizeEmail(process.env.TEKNIK_EMAIL ?? "");
  return email ? [email] : [];
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
  const [allowedEmail] = allowedEmails();
  if (!allowedEmail) return false;
  const emailOk = safeEqual(sha256(normalizeEmail(email)), sha256(allowedEmail));
  // Vercel'e yapıştırırken kalan baş/son boşluklar girişi bozmasın
  const envPassword = process.env.TEKNIK_PASSWORD?.trim();
  const expected = envPassword ? sha256(envPassword) : Buffer.from(DEFAULT_PASSWORD_SHA256, "hex");
  const passOk = safeEqual(sha256(password), expected);
  return emailOk && passOk;
}

export function createTeknikSession(email: string): string {
  return createSession("teknik", email, TEKNIK_SESSION_MAX_AGE);
}

export function verifyTeknikSession(token: string | undefined | null): boolean {
  return verifySession("teknik", token, allowedEmails()) !== null;
}
