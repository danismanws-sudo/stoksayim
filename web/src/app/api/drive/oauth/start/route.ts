import { NextRequest, NextResponse } from "next/server";
import { buildGoogleOAuthUrl, getOAuthClientCredentials } from "@/lib/google-drive-api";
import { TEKNIK_COOKIE, verifyTeknikSession } from "@/lib/teknik-auth";

export async function GET(req: NextRequest) {
  if (!verifyTeknikSession(req.cookies.get(TEKNIK_COOKIE)?.value)) {
    return NextResponse.redirect(new URL("/teknik", req.url));
  }
  const { hasClient } = getOAuthClientCredentials();
  if (!hasClient) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET ortam değişkenleri tanımlı değil. Lütfen Vercel Settings -> Environment Variables bölümünden ekleyin.",
      },
      { status: 400 },
    );
  }

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "uygulama.detaystoksayim.com";
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  const redirectUri = `${proto}://${host}/api/drive/oauth/callback`;

  const authUrl = buildGoogleOAuthUrl(redirectUri);
  return NextResponse.redirect(authUrl);
}
