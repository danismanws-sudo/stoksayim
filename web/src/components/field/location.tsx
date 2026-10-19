"use client";

import { History, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Sheet } from "@/components/ui";

/**
 * Lokasyon kilidi: sayıma başlamadan ZORUNLU.
 * Seçilen lokasyon cihazda saklanır, sayfa kapansa bile korunur.
 */
export function useLocationLock(operationId: string) {
  const key = `detay:loc:${operationId}`;
  const [location, setLocationState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocationState(localStorage.getItem(key));
    setReady(true);
  }, [key]);

  const setLocation = (v: string) => {
    const t = v.trim();
    localStorage.setItem(key, t);
    setLocationState(t);
  };
  return { location, setLocation, ready };
}

export function LocationSheet({
  open,
  operationId,
  current,
  onClose,
  onSave,
}: {
  open: boolean;
  operationId: string;
  current: string | null;
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const [value, setValue] = useState(current ?? "");
  const [suggestions, setSuggestions] = useState<{ location: string; item_count: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const mandatory = !current;

  useEffect(() => {
    if (!open) return;
    setValue("");
    setTimeout(() => inputRef.current?.focus(), 250);
    fetch(`/api/drive?opId=${encodeURIComponent(operationId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.locations)) {
          setSuggestions(data.locations);
        }
      })
      .catch(() => {});
  }, [open, operationId]);

  const filtered = suggestions.filter(
    (s) =>
      s.location !== current &&
      s.location.toLocaleLowerCase("tr").includes(value.trim().toLocaleLowerCase("tr")),
  );

  const save = (v: string) => {
    if (!v.trim()) return;
    onSave(v);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissable={!mandatory}
      title={mandatory ? "Lokasyon Seçimi (Zorunlu)" : "Lokasyonu Değiştir"}
      footer={
        <Button size="xl" className="w-full" disabled={!value.trim()} onClick={() => save(value)}>
          <MapPin className="size-5" /> Bu lokasyonda saymaya başla
        </Button>
      }
    >
      <p className="mb-4 text-sm text-ink-dim">
        Sayım yaptığınız oda / bölgeyi girin (örn. <b>3340</b> veya <b>Kaplan Toplantı Odası</b>). Okuttuğunuz her ürün bu lokasyona kilitlenir; oda değiştirdiğinizde mutlaka güncelleyin.
      </p>
      {current && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-scan-soft px-3 py-2.5 text-sm">
          <MapPin className="size-4 text-scan" /> Şu anki aktif oda: <b className="truncate">{current}</b>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(value);
        }}
      >
        <Field label="Lokasyon (Oda / Bölge Kodu veya Adı)" required>
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Örn. 3340 veya Kaplan Toplantı Odası"
            enterKeyHint="go"
          />
        </Field>
      </form>
      {filtered.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-mute">
            <History className="size-3.5" /> Bu operasyonda kullanılan lokasyonlar
          </h4>
          <div className="flex flex-col gap-1.5">
            {filtered.slice(0, 12).map((s) => (
              <button
                key={s.location}
                onClick={() => save(s.location)}
                className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-left text-sm font-semibold hover:bg-white/5"
              >
                <span className="truncate">{s.location}</span>
                <span className="ml-3 shrink-0 text-xs font-normal text-ink-mute">{s.item_count} ürün</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
