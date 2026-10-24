import { NextRequest, NextResponse } from "next/server";
import { readDB, syncAllOperationsToGoogleDrive } from "@/lib/drive-store";
import { exchangeCodeForTokens } from "@/lib/google-drive-api";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "uygulama.detaystoksayim.com";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;
  const redirectUri = `${baseUrl}/api/drive/oauth/callback`;

  if (error || !code) {
    return NextResponse.redirect(
      `${baseUrl}/panel?drive_error=${encodeURIComponent(error || "Yetkilendirme kodu alınamadı")}`,
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    // Bağlantı kurulduğu anda Drive'da tüm klasör hiyerarşisini ve mevcut operasyonları oluştur
    const db = await readDB();
    await syncAllOperationsToGoogleDrive(db, baseUrl);

    const target = new URL(`${baseUrl}/panel`);
    target.searchParams.set("drive_connected", "1");
    if (tokens.refreshToken) {
      target.searchParams.set("refresh_token", tokens.refreshToken);
    }
    if (tokens.email) {
      target.searchParams.set("drive_email", tokens.email);
    }
    return NextResponse.redirect(target.toString());
  } catch (e) {
    return NextResponse.redirect(
      `${baseUrl}/panel?drive_error=${encodeURIComponent((e as Error)?.message ?? "OAuth bağlantı hatası")}`,
    );
  }
}
