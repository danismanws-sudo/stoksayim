import { cookies } from "next/headers";
import { TEKNIK_COOKIE, verifyTeknikSession } from "@/lib/teknik-auth";
import { TeknikClient } from "./teknik-client";
import { TeknikLogin } from "./teknik-login";

export const metadata = { title: "Teknik Detaylar" };

export default async function TeknikPage() {
  const cookieStore = await cookies();
  const authed = verifyTeknikSession(cookieStore.get(TEKNIK_COOKIE)?.value);
  return authed ? <TeknikClient /> : <TeknikLogin />;
}
