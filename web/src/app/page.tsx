"use client";

import {
  ArrowRight,
  Camera,
  FileSpreadsheet,
  HardDrive,
  LayoutDashboard,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, Input, Logo } from "@/components/ui";

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState("MERKEZ2026");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-between px-5 py-8">
      {/* Üst Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-2.5">
          <Badge tone="ok">
            <HardDrive className="size-3.5" /> Google Drive Veritabanı Aktif
          </Badge>
          <Link href="/panel">
            <Button size="sm" variant="outline">
              <LayoutDashboard className="size-4" /> Yönetici Paneli
            </Button>
          </Link>
        </div>
      </header>

      {/* Orta Hero + Hızlı Giriş Kartları */}
      <div className="my-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-7">
          <Badge tone="scan">
            <ScanLine className="size-3.5" /> Mobil · Tablet · Masaüstü Bulut Sayım Sistemi
          </Badge>

          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Kamera ile Barkod Okut,{" "}
            <span className="text-[#9fb1ff]">Fotoğrafı Barkod ID&apos;sine Bağla</span>, Drive & Excel&apos;de Canlı Yönet.
          </h1>

          <p className="max-w-2xl text-base text-ink-dim">
            Detay Stok Sayım saha ekipleri uygulama indirmeden WhatsApp QR/Link ile operasyona katılır; oda/lokasyon kilidiyle barkod okutup malzeme seçer, ürün fotoğrafını çeker. Patron ve yöneticiler tüm verileri Excel formatında ve Google Drive klasörlerinde anlık takip eder.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
            <div className="glass rounded-2xl p-3.5">
              <QrCode className="size-5 text-scan" />
              <div className="mt-2 text-sm font-bold">Operasyona Özel QR</div>
              <div className="mt-0.5 text-xs text-ink-mute">
                Her link sadece kendi operasyonunda geçerlidir
              </div>
            </div>
            <div className="glass rounded-2xl p-3.5">
              <MapPin className="size-5 text-[#9fb1ff]" />
              <div className="mt-2 text-sm font-bold">Zorunlu Oda Kilidi</div>
              <div className="mt-0.5 text-xs text-ink-mute">
                Oda değiştiğinde lokasyon state bazlı güncellenir
              </div>
            </div>
            <div className="glass rounded-2xl p-3.5 col-span-2 sm:col-span-1">
              <Camera className="size-5 text-ok" />
              <div className="mt-2 text-sm font-bold">Eşsiz Barkod + Foto</div>
              <div className="mt-0.5 text-xs text-ink-mute">
                TC Kimlik gibi eşsiz barkod ve barkod ID&apos;li tek fotoğraf
              </div>
            </div>
          </div>
        </div>

        {/* Sağ Giriş Kartları */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          {/* 1) Patron & Yönetici Paneli Kartı */}
          <Card className="border-brand/40 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="brand">Patron & Yetkili Yöneticiler</Badge>
                <h2 className="mt-2 text-xl font-extrabold">
                  Yönetici Dashboard Paneli
                </h2>
                <p className="mt-1 text-xs text-ink-dim">
                  Operasyon oluşturun, özel QR/WhatsApp linki üretin, Excel tablosunda tüm ürünleri, fotoğrafları ve Fire (eksik) raporlarını inceleyin.
                </p>
              </div>
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-[#9fb1ff]">
                <FileSpreadsheet className="size-6" />
              </div>
            </div>

            <Link href="/panel" className="mt-5 block">
              <Button size="lg" className="w-full">
                Dashboard Paneline Gir <ArrowRight className="size-4.5" />
              </Button>
            </Link>
          </Card>

          {/* 2) Saha Çalışanı QR / Link Giriş Kartı */}
          <Card className="border-scan/30 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="scan">Saha Personeli (Mobil / Tablet)</Badge>
                <h2 className="mt-2 text-xl font-extrabold">
                  Operasyon Kodu / QR ile Katıl
                </h2>
                <p className="mt-1 text-xs text-ink-dim">
                  WhatsApp&apos;tan gelen operasyon davet kodunu girin veya doğrudan örnek operasyonda kamera ile sayıma başlayın.
                </p>
              </div>
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-scan-soft text-scan">
                <Smartphone className="size-6" />
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!token.trim()) return;
                router.push(`/j/${encodeURIComponent(token.trim())}`);
              }}
              className="mt-4 flex gap-2"
            >
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Operasyon davet kodu (Örn: MERKEZ2026)"
                className="font-mono text-sm"
              />
              <Button type="submit" variant="scan" className="shrink-0">
                Katıl <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-mute">
              <span>Hızlı Test:</span>
              <Link
                href="/sayim/op-demo-0001"
                className="font-bold text-[#ff9aa0] hover:underline"
              >
                Doğrudan Kamera Sayım Ekranını Aç →
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Alt Bilgi */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-xs text-ink-mute">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Detay Stok Sayım"
            width={92}
            height={28}
            className="rounded bg-white px-1.5 py-0.5"
          />
          <span>Detay Stok Sayım — Duran Varlık & Envanter Sayım Sistemi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-ok" />
          <span>Google Drive & Excel (.xlsx) Senkron Altyapısı</span>
        </div>
      </footer>
    </main>
  );
}
