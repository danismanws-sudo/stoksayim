"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Copy, FolderGit2, HardDrive, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Field, FullScreenLoader, Input, Logo } from "@/components/ui";
import type { DriveConfig } from "@/lib/drive-store";
import type { Operation } from "@/lib/types";
import { humanError } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

/**
 * TEKNİK DETAYLAR — Google Drive Veritabanı & Otomatik Klasör Sistemi
 * (Ana sayfadaki ayar ikonundan, e-posta + şifre girişiyle açılır)
 */
export function TeknikClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [driveConfig, setDriveConfig] = useState<DriveConfig | null>(null);
  const [exampleOp, setExampleOp] = useState<Operation | null>(null);
  const [webhookInput, setWebhookInput] = useState("");
  const [folderInput, setFolderInput] = useState("DETAY STOK SAYIM");
  const [oauthRefreshToken, setOauthRefreshToken] = useState<string | null>(null);
  const [syncingDrive, setSyncingDrive] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/drive", { cache: "no-store" });
      const data = (await res.json()) as { driveConfig?: DriveConfig; operations?: Operation[] };
      setDriveConfig(data.driveConfig ?? null);
      setExampleOp(data.operations?.[0] ?? null);
      if (data.driveConfig) {
        setWebhookInput(data.driveConfig.webhookUrl ?? "");
        setFolderInput(data.driveConfig.folderName || "DETAY STOK SAYIM");
      }
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive_connected") === "1") {
      const rt = params.get("refresh_token");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL'den tek seferlik okuma
      if (rt) setOauthRefreshToken(rt);
      toast.success("Google Drive bağlantısı kuruldu ve tüm operasyon klasörleri oluşturuldu!");
      window.history.replaceState({}, "", "/teknik");
    } else if (params.get("drive_error")) {
      toast.error(`Google Drive bağlantı hatası: ${params.get("drive_error")}`);
      window.history.replaceState({}, "", "/teknik");
    }
    void load();
  }, [load]);

  const logout = async () => {
    await fetch("/api/teknik/login", { method: "DELETE" });
    router.refresh();
  };

  if (loading) return <FullScreenLoader label="Teknik detaylar yükleniyor…" />;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Logo />
            </Link>
            <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-mute">
              {APP_VERSION}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button size="sm" variant="ghost">
                <ArrowLeft className="size-4" /> Ana Sayfa
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => void logout()}>
              <LogOut className="size-4" /> Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-6">
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold">
                Google Drive Veritabanı & Klasör Yapısı
              </h3>
              <p className="text-xs text-ink-dim">
                Tüm operasyonlar, çekilen fotoğraflar ve Excel dosyaları doğrudan Google Drive hesabınızdaki ilgili klasörlere kaydedilir.
              </p>
            </div>
            {driveConfig?.oauthConnected ? (
              <Badge tone="ok">
                <HardDrive className="size-3.5" /> Google Drive Bağlı
              </Badge>
            ) : (
              <Badge tone="warn">
                <HardDrive className="size-3.5" /> Yetkilendirme Bekleniyor
              </Badge>
            )}
          </div>

          {/* OAuth Bağlantı & Klasör Senkronizasyon Kartı */}
          <div className="rounded-2xl border border-brand/35 bg-brand-soft/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">
                  Resmi Google Drive API Bağlantısı
                </div>
                <div className="text-xs text-ink-dim">
                  {driveConfig?.oauthConnected
                    ? `Aktif klasör: ${driveConfig.folderName || "DETAY STOK SAYIM"}${driveConfig.connectedEmail ? ` (${driveConfig.connectedEmail})` : ""}`
                    : "Aşağıdaki butona tıklayıp Google hesabınızla izin vererek klasörleri otomatik oluşturun."}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/api/drive/oauth/start">
                  <Button size="sm" variant={driveConfig?.oauthConnected ? "outline" : "primary"}>
                    <HardDrive className="size-4" />
                    <span>
                      {driveConfig?.oauthConnected
                        ? "Google Hesabını Yeniden Bağla"
                        : "Google Drive'a Bağlan & Klasörleri Aç"}
                    </span>
                  </Button>
                </a>
                {driveConfig?.oauthConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={syncingDrive}
                    onClick={async () => {
                      setSyncingDrive(true);
                      try {
                        const res = await fetch("/api/drive", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "sync_drive_folders" }),
                        });
                        if (!res.ok) throw new Error("Senkronizasyon başarısız");
                        toast.success("Tüm klasörler ve Excel tabloları Google Drive'a senkronize edildi!");
                        await load();
                      } catch (e) {
                        toast.error(humanError(e));
                      } finally {
                        setSyncingDrive(false);
                      }
                    }}
                  >
                    <RefreshCw className="size-4" /> Şimdi Senkronize Et
                  </Button>
                )}
              </div>
            </div>

            {oauthRefreshToken && (
              <div className="rounded-xl border border-ok/40 bg-ok-soft/20 p-3 text-xs space-y-2">
                <div className="font-bold text-ok">
                  Kalıcı Bağlantı Anahtarı (GOOGLE_REFRESH_TOKEN) Üretildi:
                </div>
                <p className="text-ink-dim">
                  Bağlantının sunucu yeniden başlasa bile hiç kopmaması için bu değeri kopyalayıp Vercel → Settings → Environment Variables bölümüne <b>GOOGLE_REFRESH_TOKEN</b> adıyla ekleyin:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={oauthRefreshToken}
                    className="h-9 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(oauthRefreshToken);
                      toast.success("GOOGLE_REFRESH_TOKEN kopyalandı!");
                    }}
                  >
                    <Copy className="size-4" /> Kopyala
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-xs space-y-1.5">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <FolderGit2 className="size-4 text-[#9fb1ff]" /> Google Drive Klasör Hiyerarşisi:
            </div>
            <div className="font-mono text-ink-dim">
              📁 {folderInput || "DETAY STOK SAYIM"}/
            </div>
            <div className="font-mono text-ink-dim pl-4">
              ├── 📁 _Sistem/db.json <span className="text-ink-mute">(Ana Veritabanı)</span>
            </div>
            <div className="font-mono text-ink-dim pl-4">
              └── 📁 Operasyonlar/{exampleOp ? `${exampleOp.code} - ${exampleOp.name}` : "{OP_KODU} - {OPERASYON_ADI}"}/
            </div>
            <div className="font-mono text-ink-dim pl-10">
              ├── 📊 {exampleOp?.code ?? "{OP_KODU}"}_Duran_Varlik_Sayim_Datasi.xlsx
            </div>
            <div className="font-mono text-ink-dim pl-10">
              ├── 📁 Fotograflar/ <span className="text-ink-mute">(Örn: 869897310865.webp)</span>
            </div>
            <div className="font-mono text-ink-dim pl-10">
              └── 📁 Beklenen_Liste/ <span className="text-ink-mute">({exampleOp?.code ?? "{OP_KODU}"}_Beklenen_Liste.json)</span>
            </div>
          </div>

          <Field label="Google Drive Ana Klasör Adı">
            <Input
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              className="h-10"
            />
          </Field>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/drive", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "save_drive_config",
                    webhookUrl: webhookInput,
                    folderName: folderInput,
                  }),
                });
                if (!res.ok) {
                  toast.error("Ayarlar kaydedilemedi");
                  return;
                }
                toast.success("Google Drive klasör ayarları kaydedildi!");
                await load();
              }}
            >
              Klasör Adını Kaydet
            </Button>
          </div>
        </Card>

      </main>
    </div>
  );
}
