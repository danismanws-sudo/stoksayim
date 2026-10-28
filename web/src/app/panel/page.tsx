import { cookies } from "next/headers";
import { Suspense } from "react";
import { FullScreenLoader } from "@/components/ui";
import { PANEL_COOKIE, verifyPanelSession } from "@/lib/panel-auth";
import { PanelClient } from "./panel-client";
import { PanelLogin } from "./panel-login";

export const metadata = { title: "Operasyon Kontrol Merkezi" };

export default async function PanelPage() {
  const cookieStore = await cookies();
  if (!verifyPanelSession(cookieStore.get(PANEL_COOKIE)?.value)) {
    return <PanelLogin />;
  }
  return (
    <Suspense fallback={<FullScreenLoader label="Yönetici paneli yükleniyor…" />}>
      <PanelClient />
    </Suspense>
  );
}
