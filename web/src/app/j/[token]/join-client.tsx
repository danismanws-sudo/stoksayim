"use client";

import { ArrowRight, Building2, Hash, ShieldCheck, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Field, FullScreenLoader, Input, Logo } from "@/components/ui";
import { humanError } from "@/lib/utils";

interface LinkInfo {
  operation_id: string | null;
  operation_code: string | null;
  operation_name: string | null;
  client_name: string | null;
  valid: boolean;
  reason: string | null;
}

const IDENTITY_KEY = "detay:identity";

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").replace(/^90/, "").replace(/^0/, "").slice(0, 10);
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return p.length ? `0${p.join(" ")}` : "";
}

export function JoinClient({ token }: { token: string }) {
  const router = useRouter();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(IDENTITY_KEY) ?? "null") as {
        name?: string;
        phone?: string;
      } | null;
      if (saved?.name && saved?.phone) {
        setName(saved.name);
        setPhone(saved.phone);
        setKvkk(true);
      }
    } catch {
      /* yok say */
    }
    (async () => {
      try {
        const res = await fetch(`/api/drive?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as LinkInfo;
        setInfo(data);
      } catch (e) {
        toast.error(humanError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) return <FullScreenLoader label="Operasyon bağlantısı doğrulanıyor…" />;

  const digits = phone.replace(/\D/g, "");
  const canSubmit = name.trim().split(/\s+/).length >= 2 && digits.length >= 11 && kvkk;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !info?.valid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join_operation",
          token,
          full_name: name.trim(),
          phone: digits,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Giriş yapılamadı");

      localStorage.setItem(
        IDENTITY_KEY,
        JSON.stringify({
          id: data.profile.id,
          name: data.profile.full_name,
          phone,
        }),
      );
      toast.success("Sayıma hoş geldiniz!");
      router.replace(`/sayim/${data.operation_id}`);
    } catch (err) {
      toast.error(humanError(err));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <span className="rounded-full border border-line bg-white/[0.03] px-3 py-1 font-mono text-xs text-ink-dim">
          QR / Link Girişi
        </span>
      </div>

      {!info?.valid ? (
        <Card className="mt-10 p-6 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-scan-soft">
            <TriangleAlert className="size-7 text-scan" />
          </div>
          <h1 className="text-xl font-bold">Bağlantı geçersiz</h1>
          <p className="mt-2 text-sm text-ink-dim">
            {info?.reason ?? "Bağlantı bulunamadı"}. Lütfen yöneticinizden aktif operasyon bağlantısını isteyin.
          </p>
          <Link href="/" className="mt-5 inline-block">
            <Button variant="outline">Ana Sayfaya Dön</Button>
          </Link>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 flex flex-1 flex-col"
        >
          <span className="text-sm font-semibold text-scan">Operasyona Özel Davet</span>
          <h1 className="mt-1 text-[28px] font-extrabold leading-tight">{info.operation_name}</h1>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {info.client_name && (
              <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ink-dim">
                <Building2 className="size-4" /> {info.client_name}
              </span>
            )}
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-ink-dim">
              <Hash className="size-4" /> {info.operation_code}
            </span>
          </div>

          <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-4">
            <Field label="Ad Soyad" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn. Sinan Aktaşöz"
                autoComplete="name"
                autoCapitalize="words"
              />
            </Field>
            <Field label="Cep Telefonu" required>
              <Input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="05xx xxx xx xx"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>

            <label className="mt-1 flex items-start gap-3 rounded-xl border border-line bg-white/[0.02] p-3 text-[13px] text-ink-dim cursor-pointer">
              <input
                type="checkbox"
                checked={kvkk}
                onChange={(e) => setKvkk(e.target.checked)}
                className="mt-0.5 size-5 accent-[#3552c8]"
              />
              <span>
                Ad, soyad ve telefon bilgilerimin sayım operasyonunun yürütülmesi amacıyla Detay Stok Sayım tarafından işlenmesini kabul ediyorum (KVKK).
              </span>
            </label>

            <div className="mt-auto pt-6">
              <Button type="submit" size="xl" className="w-full" loading={busy} disabled={!canSubmit}>
                Sayıma Başla <ArrowRight className="size-5" />
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-mute">
                <ShieldCheck className="size-3.5" /> Bu bağlantı yalnızca <b>{info.operation_code}</b> operasyonu için geçerlidir
              </p>
            </div>
          </form>
        </motion.div>
      )}
    </main>
  );
}
