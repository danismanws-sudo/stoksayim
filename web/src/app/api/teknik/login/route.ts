import { NextRequest, NextResponse } from "next/server";
import {
  checkTeknikCredentials,
  createTeknikSession,
  TEKNIK_COOKIE,
  TEKNIK_SESSION_MAX_AGE,
  teknikLoginConfigError,
} from "@/lib/teknik-auth";

export async function POST(req: NextRequest) {
  const configError = teknikLoginConfigError();
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email ?? "");
  const password = String(body.password ?? "");

  if (!checkTeknikCredentials(email, password)) {
    // Kaba kuvvet denemelerini yavaşlat
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(TEKNIK_COOKIE, createTeknikSession(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TEKNIK_SESSION_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(TEKNIK_COOKIE);
  return res;
}
