"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Lock, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Field, Input, Logo } from "@/components/ui";
import { humanError } from "@/lib/utils";

export function TeknikLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/teknik/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Giriş yapılamadı");
      router.refresh();
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 py-10">
      <Link href="/">
        <Logo size="md" />
      </Link>
      <Card className="w-full max-w-sm p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-soft/40 text-[#9fb1ff]">
              <Settings2 className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold">Teknik Detaylar</h1>
              <p className="text-xs text-ink-dim">Devam etmek için giriş yapın.</p>
            </div>
          </div>
          <Field label="Gmail adresi">
            <Input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@gmail.com"
            />
          </Field>
          <Field label="Şifre">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            <Lock className="size-4" /> Giriş Yap
          </Button>
        </form>
      </Card>
      <Link href="/" className="flex items-center gap-1.5 text-xs text-ink-mute hover:text-ink">
        <ArrowLeft className="size-3.5" /> Ana sayfaya dön
      </Link>
    </main>
  );
}
