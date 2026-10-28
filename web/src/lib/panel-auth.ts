import { randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import {
  createSession,
  normalizeEmail,
  safeEqual,
  sessionSecret,
  sha256,
  sign,
  verifySession,
} from "./auth-core";

/**
 * Yönetici Paneli girişi: e-posta + şifre + e-postaya gönderilen 6 haneli doğrulama kodu.
 * - `PANEL_EMAILS`: girişe izinli adresler, virgülle (örn. "patron@gmail.com,admin@gmail.com").
 *   Admin daha sonra listeden silinince sadece patron girebilir; adminin açık oturumu da düşer.
 * - `PANEL_PASSWORD`: panel şifresi
 * - `SMTP_USER` + `SMTP_APP_PASSWORD`: kodu gönderen Gmail hesabı ve Google "Uygulama Şifresi"
 */

export const PANEL_COOKIE = "panel_session";
export const PANEL_CHALLENGE_COOKIE = "panel_challenge";
export const PANEL_SESSION_MAX_AGE = 60 * 60 * 12; // 12 saat
export const PANEL_CODE_MAX_AGE = 60 * 10; // 10 dakika

export function panelAllowedEmails(): string[] {
  return (process.env.PANEL_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

export function panelLoginConfigError(): string | null {
  const missing = [
    !panelAllowedEmails().length && "PANEL_EMAILS",
    !process.env.PANEL_PASSWORD?.trim() && "PANEL_PASSWORD",
    !process.env.SMTP_USER?.trim() && "SMTP_USER",
    !process.env.SMTP_APP_PASSWORD?.trim() && "SMTP_APP_PASSWORD",
    !sessionSecret() && "TEKNIK_SESSION_SECRET",
  ].filter(Boolean);
  return missing.length
    ? `Panel girişi için Vercel → Settings → Environment Variables bölümüne şu değişkenler eklenmeli: ${missing.join(", ")}`
    : null;
}

export function checkPanelCredentials(email: string, password: string): boolean {
  const normalized = normalizeEmail(email);
  const emailOk = panelAllowedEmails().some((e) => safeEqual(sha256(e), sha256(normalized)));
  const expected = (process.env.PANEL_PASSWORD ?? "").trim();
  const passOk = Boolean(expected) && safeEqual(sha256(password), sha256(expected));
  return emailOk && passOk;
}

function challengeSig(exp: number, email: string, code: string, secret: string) {
  return sign(`panel-code|${exp}|${email}|${code}`, secret);
}

/** Kod üretir; kodun kendisi çerezde tutulmaz, sadece imzası tutulur */
export function createPanelChallenge(email: string): { code: string; cookie: string } {
  const secret = sessionSecret();
  if (!secret) throw new Error("Oturum anahtarı tanımlı değil");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const normalized = normalizeEmail(email);
  const exp = Date.now() + PANEL_CODE_MAX_AGE * 1000;
  const cookie = `${exp}.${Buffer.from(normalized).toString("base64url")}.${challengeSig(exp, normalized, code, secret)}`;
  return { code, cookie };
}

/** Doğru kod girildiyse e-postayı döner */
export function verifyPanelChallenge(cookie: string | undefined, code: string): string | null {
  const secret = sessionSecret();
  if (!cookie || !secret) return null;
  const [expStr, emailB64, sig] = cookie.split(".");
  const exp = Number(expStr);
  if (!(exp > Date.now()) || !sig) return null;
  const email = Buffer.from(emailB64 ?? "", "base64url").toString();
  if (!panelAllowedEmails().includes(email)) return null;
  const expected = challengeSig(exp, email, code.replace(/\D/g, ""), secret);
  return safeEqual(Buffer.from(sig), Buffer.from(expected)) ? email : null;
}

export async function sendPanelCodeEmail(to: string, code: string) {
  const user = (process.env.SMTP_USER ?? "").trim();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: (process.env.SMTP_APP_PASSWORD ?? "").replace(/\s+/g, "") },
  });
  await transporter.sendMail({
    from: `"Detay Stok Sayım" <${user}>`,
    to,
    subject: `Panel giriş kodunuz: ${code}`,
    text: `Operasyon Kontrol Merkezi giriş kodunuz: ${code}\n\nKod 10 dakika geçerlidir. Bu girişi siz yapmadıysanız bu e-postayı dikkate almayın.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">
      <p>Operasyon Kontrol Merkezi giriş kodunuz:</p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>
      <p style="color:#555">Kod 10 dakika geçerlidir. Bu girişi siz yapmadıysanız bu e-postayı dikkate almayın.</p>
    </div>`,
  });
}

export function createPanelSession(email: string): string {
  return createSession("panel", email, PANEL_SESSION_MAX_AGE);
}

export function verifyPanelSession(token: string | undefined | null): boolean {
  return verifySession("panel", token, panelAllowedEmails()) !== null;
}
