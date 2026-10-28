import { NextRequest, NextResponse } from "next/server";
import {
  checkPanelCredentials,
  createPanelChallenge,
  createPanelSession,
  PANEL_CHALLENGE_COOKIE,
  PANEL_CODE_MAX_AGE,
  PANEL_COOKIE,
  PANEL_SESSION_MAX_AGE,
  panelLoginConfigError,
  sendPanelCodeEmail,
  verifyPanelChallenge,
} from "@/lib/panel-auth";

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Aynı koda yapılan yanlış denemeler (sunucu örneği başına, en iyi çaba)
const MAX_CODE_ATTEMPTS = 5;
const codeAttempts = new Map<string, number>();

const slowDown = () => new Promise((r) => setTimeout(r, 800));

export async function POST(req: NextRequest) {
  const configError = panelLoginConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    step?: string;
    email?: string;
    password?: string;
    code?: string;
  };

  // 1. adım: e-posta + şifre → e-postaya 6 haneli kod
  if (body.step === "password") {
    const email = String(body.email ?? "");
    if (!checkPanelCredentials(email, String(body.password ?? ""))) {
      await slowDown();
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }
    const { code, cookie } = createPanelChallenge(email);
    try {
      await sendPanelCodeEmail(email.trim(), code);
    } catch (e) {
      console.error("Panel doğrulama e-postası gönderilemedi:", e);
      return NextResponse.json(
        { error: "Doğrulama kodu e-postası gönderilemedi. SMTP_USER / SMTP_APP_PASSWORD ayarlarını kontrol edin." },
        { status: 500 },
      );
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PANEL_CHALLENGE_COOKIE, cookie, { ...COOKIE_BASE, maxAge: PANEL_CODE_MAX_AGE });
    return res;
  }

  // 2. adım: kod doğrulama → oturum
  if (body.step === "code") {
    const challenge = req.cookies.get(PANEL_CHALLENGE_COOKIE)?.value;
    if (!challenge) {
      return NextResponse.json(
        { error: "Kodun süresi doldu. Lütfen tekrar giriş yapın.", restart: true },
        { status: 401 },
      );
    }
    const attempts = codeAttempts.get(challenge) ?? 0;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      const res = NextResponse.json(
        { error: "Çok fazla hatalı deneme. Lütfen tekrar giriş yapıp yeni kod isteyin.", restart: true },
        { status: 429 },
      );
      res.cookies.delete(PANEL_CHALLENGE_COOKIE);
      return res;
    }
    const email = verifyPanelChallenge(challenge, String(body.code ?? ""));
    if (!email) {
      codeAttempts.set(challenge, attempts + 1);
      await slowDown();
      return NextResponse.json({ error: "Doğrulama kodu hatalı." }, { status: 401 });
    }
    codeAttempts.delete(challenge);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(PANEL_CHALLENGE_COOKIE);
    res.cookies.set(PANEL_COOKIE, createPanelSession(email), {
      ...COOKIE_BASE,
      maxAge: PANEL_SESSION_MAX_AGE,
    });
    return res;
  }

  return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PANEL_COOKIE);
  res.cookies.delete(PANEL_CHALLENGE_COOKIE);
  return res;
}
