"use client";

import {
  ArrowRight,
  LayoutDashboard,
  QrCode,
  ScanLine,
  Shield,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Scanner } from "@/components/field/scanner";
import { Button, Input, Logo, Sheet } from "@/components/ui";

function parseQrToken(raw: string): string {
  const val = raw.trim();
  const match = val.match(/\/j\/([^/?#]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return val;
}

export default function HomePage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const revealRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);

  // Lazer yukarıdan aşağı indikçe logoyu açar, aşağıdan yukarı çıktıkça siler (CSS/OS bağımsız 60fps)
  useEffect(() => {
    let raf = 0;
    const duration = 7600; // 7.6 saniyede tam tur (yavaş ve akıcı)

    const tick = (now: number) => {
      const t = (now % duration) / duration; // 0..1
      // Yumuşak sinüs eğrisi: 0 -> 1 (iniş) -> 0 (çıkış)
      const raw = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      const pct = Math.max(0, Math.min(100, raw * 100));

      if (revealRef.current) {
        revealRef.current.style.clipPath = `inset(0% 0% ${(100 - pct).toFixed(2)}% 0%)`;
      }
      if (beamRef.current) {
        beamRef.current.style.top = `${pct.toFixed(2)}%`;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="relative flex min-h-dvh w-full flex-col justify-between overflow-hidden px-6 py-7 sm:px-10">
      {/* Arka plan ince barkod ızgara ve ışık efektleri */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 14px)",
        }}
      />

      {/* Üst Bar — Sade ve Güçlü */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between">
        <Logo size="md" />
        <Link href="/panel">
          <Button size="md" variant="outline" className="rounded-2xl border-white/15 bg-white/[0.03] px-5">
            <LayoutDashboard className="size-4 text-[#9fb1ff]" />
            <span>Yönetici Girişi</span>
          </Button>
        </Link>
      </header>

      {/* Orta Alan — Sol: Marka & Barkod Tarama Vizörü | Sağ: 2 Ana İşlev */}
      <section className="relative z-10 mx-auto my-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 py-8 lg:grid-cols-12 lg:gap-12">
        {/* SOL TARAF: Büyük Metalik Logo & Canlı Barkod Tarama Sahnesi */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="lg:col-span-7"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1118]/90 p-6 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] sm:p-9">
            {/* Ortam ışığı */}
            <div className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-scan/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-20 size-80 rounded-full bg-brand/20 blur-3xl" />

            {/* Kırmızı Barkod Okuma Vizör Köşeleri */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-black/50 p-4 sm:p-6">
              <span className="pointer-events-none absolute left-3 top-3 size-8 rounded-tl-xl border-l-[3px] border-t-[3px] border-scan" />
              <span className="pointer-events-none absolute right-3 top-3 size-8 rounded-tr-xl border-r-[3px] border-t-[3px] border-scan" />
              <span className="pointer-events-none absolute bottom-3 left-3 size-8 rounded-bl-xl border-b-[3px] border-l-[3px] border-scan" />
              <span className="pointer-events-none absolute bottom-3 right-3 size-8 rounded-br-xl border-b-[3px] border-r-[3px] border-scan" />

              {/* Lazerle Taranarak Açılan & Silinen Koyu Metalik Logo Alanı */}
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#090c12]">
                {/* Taranmamış karanlık zemin dokusu (çok silik barkod kılavuz çizgileri) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 18px)",
                  }}
                />

                {/* Lazer yukarıdan aşağı indikçe görünür olan, yukarı çıktıkça silinen logo */}
                <div
                  ref={revealRef}
                  style={{ clipPath: "inset(0% 0% 100% 0%)" }}
                  className="absolute inset-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo-metal.png"
                    alt="Detay Stok Sayım"
                    className="h-full w-full object-cover brightness-105 contrast-105"
                  />
                </div>

                {/* Lazer çizgisi — logonun açılma/silinme sınırıyla birebir senkron */}
                <div
                  ref={beamRef}
                  aria-hidden="true"
                  style={{ top: "0%" }}
                  className="pointer-events-none absolute inset-x-0 z-20 -translate-y-1/2"
                >
                  {/* Lazerin etrafındaki kırmızı optik hale */}
                  <div className="h-8 w-full bg-gradient-to-b from-transparent via-scan/45 to-transparent blur-sm" />
                  {/* Keskin lazer çekirdeği */}
                  <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-gradient-to-r from-transparent via-[#ff3b47] to-transparent shadow-[0_0_22px_5px_rgb(229_36_47/0.95),0_0_8px_2px_rgb(255_255_255/0.85)]" />
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
              </div>

              {/* Alt Canlı Barkod Sinyal Çubuğu */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-scan opacity-75" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-scan" />
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-widest text-ink-dim uppercase">
                    OPTİK BARKOD & DEMİRBAŞ SAYIM SİSTEMİ
                  </span>
                </div>

                {/* Dekoratif Barkod Çizgileri */}
                <div className="flex items-center gap-[3px] opacity-60" aria-hidden="true">
                  {[3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 2].map((w, i) => (
                    <span
                      key={i}
                      style={{ width: `${w * 2}px` }}
                      className="h-4 rounded-[1px] bg-ink-dim"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* SAĞ TARAF: İki Ana İşlev — Premium Kartlar */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08 }}
          className="flex flex-col gap-5 lg:col-span-5"
        >
          {/* KART 1: YÖNETİCİ DASHBOARD PANELİ */}
          <div className="group relative overflow-hidden rounded-[1.75rem] border border-brand/35 bg-gradient-to-b from-[#161e31]/95 to-[#0f1420]/95 p-6 shadow-[0_24px_60px_-15px_rgba(35,62,160,0.35)] transition hover:border-brand/60 sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-brand/20 blur-2xl transition group-hover:bg-brand/30" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/15 px-3 py-1 text-[11px] font-bold tracking-wider text-[#b4c3ff] uppercase">
                  <Shield className="size-3.5" /> Yönetim & Kontrol
                </div>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white">
                  Yönetici Dashboard Paneli
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
                  Operasyonları yönetin, özel QR/bağlantı üretin ve tüm sayım verilerini canlı tabloda inceleyin.
                </p>
              </div>
              <div className="grid size-13 shrink-0 place-items-center rounded-2xl border border-brand/40 bg-brand/20 text-[#9fb1ff] shadow-inner">
                <LayoutDashboard className="size-6" />
              </div>
            </div>

            <Link href="/panel" className="relative mt-6 block">
              <Button size="xl" className="w-full rounded-2xl text-base font-bold">
                <span>Dashboard Paneline Gir</span>
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {/* KART 2: SAHA PERSONELİ — OPERASYON LİNKİ / QR İLE KATIL */}
          <div className="group relative overflow-hidden rounded-[1.75rem] border border-scan/35 bg-gradient-to-b from-[#231319]/95 to-[#120e14]/95 p-6 shadow-[0_24px_60px_-15px_rgba(229,36,47,0.25)] transition hover:border-scan/60 sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-scan/15 blur-2xl transition group-hover:bg-scan/25" />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-scan/40 bg-scan/15 px-3 py-1 text-[11px] font-bold tracking-wider text-[#ff9aa0] uppercase">
                  <ScanLine className="size-3.5" /> Saha Sayım Ekibi
                </div>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white">
                  Operasyon Linki / QR ile Katıl
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
                  Operasyona özel davet linkini yapıştırarak veya QR butonuna tıklayıp operasyona ait QR kodu okutarak giriş yapın.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                title="Operasyon QR Kodunu Kamera ile Okut"
                aria-label="Operasyon QR Kodunu Kamera ile Okut"
                className="grid size-13 shrink-0 cursor-pointer place-items-center rounded-2xl border border-scan/50 bg-scan/20 text-[#ff7a82] shadow-[0_0_24px_-4px_rgba(229,36,47,0.45)] transition hover:scale-105 hover:border-scan hover:bg-scan/35 hover:text-white active:scale-95"
              >
                <QrCode className="size-6" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = parseQrToken(token);
                if (!parsed) return;
                router.push(`/j/${encodeURIComponent(parsed)}`);
              }}
              className="relative mt-6 flex gap-2.5"
            >
              <Input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Operasyon Davet Linkini Yapıştırın"
                className="h-13 rounded-2xl border-white/15 bg-black/40 font-mono text-sm font-semibold"
              />
              <Button
                type="submit"
                variant="scan"
                size="lg"
                className="h-13 shrink-0 rounded-2xl px-6 font-bold"
              >
                <span>Katıl</span>
                <ArrowRight className="size-4.5" />
              </Button>
            </form>
          </div>
        </motion.div>
      </section>

      {/* Operasyon QR Okutma Penceresi */}
      <Sheet
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title="Operasyon QR Kodunu Okut"
      >
        <div className="space-y-3 pb-2">
          <p className="text-xs text-ink-dim">
            Yöneticinizin paylaştığı operasyona özel QR kodu kameraya gösterin. Okunduğu anda giriş ekranına yönlendirileceksiniz.
          </p>
          <div className="relative h-[58dvh] max-h-[440px] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            <Scanner
              active={qrOpen}
              onDetected={(code) => {
                const parsed = parseQrToken(code);
                if (!parsed) return;
                setQrOpen(false);
                setToken(parsed);
                router.push(`/j/${encodeURIComponent(parsed)}`);
              }}
              onManual={() => setQrOpen(false)}
            />
          </div>
        </div>
      </Sheet>

      {/* Alt Bilgi — Çok Sade */}
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between border-t border-white/[0.06] pt-4 text-xs text-ink-mute">
        <span>© 2026 Detay Stok Sayım</span>
        <span className="font-mono tracking-wider">DETAY ENVANTER & SAYIM PORTALI</span>
      </footer>
    </main>
  );
}
