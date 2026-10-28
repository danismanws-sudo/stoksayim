"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, KeyRound, Lock, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Logo } from "@/components/ui";
import { humanError } from "@/lib/utils";

export function PanelLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"password" | "code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  // Güvenlik: tarayıcı otomatik doldurmasın diye kutular odaklanana kadar salt okunur
  const [unlocked, setUnlocked] = useState(false);

  const call = async (payload: Record<string, string>) => {
    const res = await fetch("/api/panel/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; restart?: boolean };
    return { ok: res.ok, ...data };
  };

  const submitPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await call({ step: "password", email, password });
      if (!r.ok) {
        setPassword("");
        throw new Error(r.error || "Giriş yapılamadı");
      }
      setPassword("");
      setCode("");
      setStep("code");
      toast.success("Doğrulama kodu e-posta adresinize gönderildi.");
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await call({ step: "code", code });
      if (!r.ok) {
        setCode("");
        if (r.restart) setStep("password");
        throw new Error(r.error || "Kod doğrulanamadı");
      }
      setEmail("");
      setCode("");
      router.refresh();
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setLoading(false);
    }
  };

  const noFill = {
    "data-lpignore": "true",
    "data-1p-ignore": true,
    readOnly: !unlocked,
    onFocus: () => setUnlocked(true),
  } as const;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 py-10">
      <Logo size="md" />
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft/40 text-[#9fb1ff]">
            {step === "password" ? <ShieldCheck className="size-5" /> : <MailCheck className="size-5" />}
          </div>
          <div>
            <h1 className="text-base font-bold">Operasyon Kontrol Merkezi</h1>
            <p className="text-xs text-ink-dim">
              {step === "password"
                ? "Devam etmek için giriş yapın."
                : "E-postanıza gelen 6 haneli kodu girin."}
            </p>
          </div>
        </div>

        {step === "password" ? (
          <form onSubmit={submitPassword} autoComplete="off" className="space-y-4">
            <Field label="E-posta adresi">
              <Input
                type="email"
                name="panel-e"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@gmail.com"
                {...noFill}
              />
            </Field>
            <Field label="Şifre">
              <Input
                type="password"
                name="panel-p"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...noFill}
              />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              <Lock className="size-4" /> Devam Et
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} autoComplete="off" className="space-y-4">
            <p className="rounded-xl bg-brand-soft/30 px-3 py-2 text-xs text-ink-dim">
              Kod <b className="text-ink">{email}</b> adresine gönderildi. 10 dakika geçerlidir.
            </p>
            <Field label="Doğrulama kodu">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center font-mono text-2xl tracking-[0.5em]"
                placeholder="••••••"
              />
            </Field>
            <Button type="submit" loading={loading} disabled={code.length !== 6} className="w-full">
              <KeyRound className="size-4" /> Giriş Yap
            </Button>
            <button
              type="button"
              onClick={() => {
                setStep("password");
                setCode("");
              }}
              className="w-full text-center text-xs text-ink-mute hover:text-ink"
            >
              Kod gelmedi mi? Şifreyi tekrar girip yeni kod isteyin
            </button>
          </form>
        )}
      </Card>
      <Link href="/" className="flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink">
        <ArrowLeft className="size-3.5" /> Ana sayfaya dön
      </Link>
    </main>
  );
}
