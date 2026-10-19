import { Suspense } from "react";
import { FullScreenLoader } from "@/components/ui";
import { PanelClient } from "./panel-client";

export const metadata = { title: "Yönetici & Patron Paneli" };

export default function PanelPage() {
  return (
    <Suspense fallback={<FullScreenLoader label="Yönetici paneli yükleniyor…" />}>
      <PanelClient />
    </Suspense>
  );
}
