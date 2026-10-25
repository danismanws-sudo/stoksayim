"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  HardDrive,
  Image as ImageIcon,
  List,
  MapPin,
  Pencil,
  RefreshCw,
  ScanLine,
  LogOut,
  Trash2,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemSheet, type ItemSubmit } from "@/components/field/item-sheet";
import { LocationSheet, useLocationLock } from "@/components/field/location";
import { Scanner } from "@/components/field/scanner";
import { Badge, Button, Card, Field, FullScreenLoader, Input, Logo, Sheet } from "@/components/ui";
import {
  enqueue,
  flush,
  getSavedIdentity,
  listQueue,
  onQueueChange,
  removeFromQueue,
  type QueuedItem,
} from "@/lib/offline-queue";
import type { Category, CountItem, ExpectedItem, Operation, ProductType } from "@/lib/types";
import { cn, fmtDateTime, fmtTime, humanError } from "@/lib/utils";

interface Duplicate {
  id: string;
  counted_by: string;
  counted_by_name: string;
  location: string;
  description: string;
  created_at: string;
}

type Tab = "scan" | "mine";

export function FieldClient({ operationId }: { operationId: string }) {
  const [boot, setBoot] = useState<"loading" | "ok" | "denied">("loading");
  const [op, setOp] = useState<Operation | null>(null);
  const [me, setMe] = useState<{ id: string; name: string }>({
    id: "prof-saha-1",
    name: "Saha Personeli",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [items, setItems] = useState<CountItem[]>([]);
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<Tab>("scan");

  const { location, setLocation, ready: locReady } = useLocationLock(operationId);
  const [locOpen, setLocOpen] = useState(false);

  const [barcode, setBarcode] = useState<string | null>(null);
  const [editing, setEditing] = useState<CountItem | null>(null);
  const [prefill, setPrefill] = useState<ExpectedItem | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [dup, setDup] = useState<Duplicate | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState<{ name: string; count: number } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/drive?opId=${encodeURIComponent(operationId)}`);
      if (!res.ok) {
        setBoot("denied");
        return;
      }
      const data = await res.json();
      setOp(data.operation as Operation);
      setCategories((data.categories as Category[]) ?? []);
      setTypes((data.product_types as ProductType[]) ?? []);
      setItems((data.items as CountItem[]) ?? []);
      setBoot("ok");
    } catch {
      setBoot("denied");
    }
  }, [operationId]);

  const refreshQueue = useCallback(async () => {
    setQueue(await listQueue(operationId));
  }, [operationId]);

  useEffect(() => {
    const id = getSavedIdentity();
    setMe({ id: id.id, name: id.name });
    void loadData();
    void refreshQueue();
  }, [loadData, refreshQueue]);

  useEffect(() => {
    return onQueueChange(() => {
      void refreshQueue();
      void loadData();
    });
  }, [loadData, refreshQueue]);

  useEffect(() => {
    const upd = () => setOnline(navigator.onLine);
    upd();
    window.addEventListener("online", upd);
    window.addEventListener("offline", upd);
    return () => {
      window.removeEventListener("online", upd);
      window.removeEventListener("offline", upd);
    };
  }, []);

  useEffect(() => {
    if (boot === "ok" && locReady && !location) setLocOpen(true);
  }, [boot, locReady, location]);

  const openEdit = (it: CountItem) => {
    setPrefill(null);
    setEditing(it);
    setEditPhotoUrl(
      it.photo_path
        ? `/api/drive/photo/${it.photo_path}?t=${encodeURIComponent(it.updated_at)}`
        : null,
    );
    setBarcode(it.barcode);
  };

  /* ---------- barkod okundu ---------- */
  const handleBarcode = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !op) return;
      if (!location) {
        setLocOpen(true);
        return;
      }

      // 1) Kendi offline kuyruğumda var mı?
      const queued = queue.find((q) => q.draft.barcode === code && !q.update_id);
      if (queued) {
        toast.warning("Bu barkod zaten kaydedildi, Drive'a gönderilmeyi bekliyor.");
        return;
      }

      // 2) Drive'da bu operasyonda var mı? (EŞSİZ barkod kuralı)
      if (navigator.onLine) {
        try {
          const res = await fetch("/api/drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "lookup_barcode",
              operation_id: op.id,
              barcode: code,
            }),
          });
          const data = (await res.json()) as {
            duplicate: Duplicate | null;
            prefill: ExpectedItem | null;
          };
          if (data.duplicate) {
            setDup(data.duplicate);
            return;
          }
          setPrefill(data.prefill ?? null);
          if (op.mode === "compare" && data.prefill) {
            toast.success(`Eski listede bulundu: ${data.prefill.description}`);
          } else if (op.mode === "compare" && !data.prefill) {
            toast.message("Bu barkod eski listede yok — FAZLA olarak kaydedilecek.");
          }
        } catch {
          /* çevrimdışı devam */
        }
      }

      setEditing(null);
      setEditPhotoUrl(null);
      setBarcode(code);
    },
    [op, location, queue],
  );

  const closeSheet = () => {
    setBarcode(null);
    setEditing(null);
    setPrefill(null);
  };

  const submit = async ({ draft, photo, keepPhotoPath, updateId }: ItemSubmit) => {
    try {
      await enqueue({
        client_uuid: draft.client_uuid,
        draft,
        photo,
        update_id: updateId,
        keep_photo_path: keepPhotoPath,
      });
      setLastSaved(draft.barcode);
      setTimeout(() => setLastSaved((b) => (b === draft.barcode ? null : b)), 2200);
      toast.success(
        updateId
          ? "Kayıt güncellendi ve Drive'a işlendi"
          : navigator.onLine
            ? "Drive'a ve Excel'e kaydedildi"
            : "Cihaza kaydedildi — internet gelince Drive'a gönderilecek",
      );
      closeSheet();
      await loadData();
    } catch (e) {
      toast.error(humanError(e));
    }
  };

  const deleteItem = async (it: CountItem) => {
    if (!confirm(`${it.barcode} — "${it.description}" kaydı silinsin mi?`)) return;
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_item", id: it.id }),
      });
      if (!res.ok) throw new Error("Silinemedi");
      setItems((x) => x.filter((i) => i.id !== it.id));
      toast.success("Kayıt Drive'dan silindi");
    } catch (e) {
      toast.error(humanError(e));
    }
  };

  // Sayımı bitir: bekleyen kayıtlar Drive'a gönderilmeden çıkışa izin verme
  const finishCount = async () => {
    setFinishing(true);
    try {
      await flush();
      const left = (await listQueue(operationId)).filter((q) => q.state !== "conflict");
      await refreshQueue();
      if (left.length > 0) {
        toast.error(
          `${left.length} kayıt henüz Drive'a gönderilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.`,
        );
        return;
      }
      try {
        localStorage.removeItem(`detay:loc:${operationId}`);
      } catch {
        /* yoksay */
      }
      setFinished({ name: me.name, count: totalCount });
      setFinishOpen(false);
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setFinishing(false);
    }
  };

  const scannerActive =
    boot === "ok" &&
    tab === "scan" &&
    !barcode &&
    !locOpen &&
    !dup &&
    !manualOpen &&
    Boolean(location);

  const pending = queue.filter((q) => q.state !== "conflict").length;
  const conflicts = queue.filter((q) => q.state === "conflict");
  const totalCount =
    items.length + queue.filter((q) => !q.update_id && q.state !== "conflict").length;
  const hereCount = useMemo(
    () => items.filter((i) => i.location === location).length,
    [items, location],
  );

  if (boot === "loading") return <FullScreenLoader label="Sayım ekranı hazırlanıyor…" />;
  if (boot !== "ok" || !op) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <Logo />
        <Card className="p-6">
          <h1 className="text-xl font-bold">Operasyon bulunamadı</h1>
          <p className="mt-2 text-sm text-ink-dim">
            Bu sayım operasyonu kapatılmış veya bağlantı hatalı olabilir.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button variant="outline">Ana Sayfaya Dön</Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 p-6 text-center">
        <Logo />
        <Card className="w-full p-7">
          <CheckCircle2 className="mx-auto size-14 text-ok" />
          <h1 className="mt-4 text-2xl font-bold">Teşekkür ederiz{finished.name ? `, ${finished.name}` : ""}!</h1>
          <p className="mt-2 text-sm text-ink-dim">
            <b className="text-ink">{op.name}</b> sayımınız tamamlandı. Toplam{" "}
            <b className="text-ink">{finished.count}</b> ürün kaydı Google Drive&apos;a kaydedildi.
          </p>
          <p className="mt-4 text-xs text-ink-mute">Emeğiniz için teşekkürler. Bu sayfayı kapatabilirsiniz.</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden">
      {/* ---------- Üst Bar ---------- */}
      <header className="z-20 flex flex-col gap-2 border-b border-line bg-bg/85 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Logo compact />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold leading-tight">{op.name}</div>
            <div className="truncate text-xs text-ink-mute">
              <span className="font-mono">{op.code}</span>
              {op.client_name && <> · {op.client_name}</>}
              {me.name && <> · {me.name}</>}
            </div>
          </div>
          {!online ? (
            <Badge tone="warn">
              <CloudOff className="size-3.5" /> Çevrimdışı
            </Badge>
          ) : pending > 0 ? (
            <button onClick={() => void flush()}>
              <Badge tone="brand">
                <RefreshCw className="size-3.5 animate-spin" /> {pending}
              </Badge>
            </button>
          ) : (
            <Badge tone="ok">
              <HardDrive className="size-3.5" /> Drive Senkron
            </Badge>
          )}
        </div>

        {/* Zorunlu Lokasyon Kilidi */}
        <button
          onClick={() => setLocOpen(true)}
          className="flex items-center gap-2.5 rounded-2xl border border-scan/30 bg-scan-soft px-3.5 py-2.5 text-left active:scale-[0.99]"
        >
          <MapPin className="size-5 shrink-0 text-scan" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#ff9aa0]">
              Aktif Lokasyon (Oda / Bölge Kilidi)
            </div>
            <div className="truncate text-[15px] font-bold">
              {location ?? "Seçilmedi (Zorunlu)"}
            </div>
          </div>
          <span className="shrink-0 text-xs text-ink-dim">{hereCount} ürün</span>
          <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold">
            Oda Değiştir
          </span>
        </button>
      </header>

      {/* ---------- İçerik ---------- */}
      <div className="relative flex-1 overflow-hidden">
        <div className={cn("absolute inset-0", tab !== "scan" && "invisible")}>
          <Scanner
            active={scannerActive}
            onDetected={handleBarcode}
            onManual={() => {
              setManualValue("");
              setManualOpen(true);
            }}
          />

          <AnimatePresence>
            {lastSaved && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 top-4 mx-auto flex w-fit items-center gap-2 rounded-full bg-ok px-4 py-2 text-sm font-bold text-black shadow-xl"
              >
                <CheckCircle2 className="size-4" /> {lastSaved} Drive&apos;a kaydedildi
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {tab === "mine" && (
          <div className="absolute inset-0 overflow-y-auto px-4 pb-28 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Sayılan Ürünler</h2>
              <span className="text-sm text-ink-mute">{totalCount} kayıt</span>
            </div>

            {conflicts.map((q) => (
              <Card key={q.client_uuid} className="mb-2 border-scan/40 p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-scan" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm">{q.draft.barcode}</div>
                    <div className="text-xs text-ink-dim">{q.error}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeFromQueue(q.client_uuid)}
                  >
                    Kaldır
                  </Button>
                </div>
              </Card>
            ))}

            {queue
              .filter((q) => q.state !== "conflict")
              .map((q) => (
                <Row
                  key={q.client_uuid}
                  barcode={q.draft.barcode}
                  description={q.draft.description}
                  location={q.draft.location}
                  meta={
                    q.state === "error"
                      ? "Gönderilemedi, tekrar denenecek"
                      : "Drive'a gönderiliyor"
                  }
                  details={
                    [
                      q.draft.model && `Model: ${q.draft.model}`,
                      q.draft.color && `Renk: ${q.draft.color}`,
                      q.draft.dimensions && `Ölçü: ${q.draft.dimensions}`,
                      q.draft.quantity > 1 && `Adet: ${q.draft.quantity}`,
                      q.draft.assignee && `Zimmet: ${q.draft.assignee}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  pending
                  hasPhoto={Boolean(q.photo)}
                />
              ))}

            {items.map((it) => (
              <Row
                key={it.id}
                barcode={it.barcode}
                description={it.description}
                location={it.location}
                meta={`${it.category_name ?? "Kategori yok"} · ${fmtTime(it.created_at)}`}
                details={
                  [
                    it.model && `Model: ${it.model}`,
                    it.color && `Renk: ${it.color}`,
                    it.dimensions && `Ölçü: ${it.dimensions}`,
                    it.quantity > 1 && `Adet: ${it.quantity}`,
                    it.assignee && `Zimmet: ${it.assignee}`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                hasPhoto={Boolean(it.photo_path)}
                photoUrl={
                  it.photo_path
                    ? `/api/drive/photo/${it.photo_path}?t=${encodeURIComponent(it.updated_at)}`
                    : undefined
                }
                onEdit={() => openEdit(it)}
                onDelete={() => deleteItem(it)}
              />
            ))}

            {totalCount === 0 && conflicts.length === 0 && (
              <div className="mt-16 flex flex-col items-center gap-2 text-center text-ink-mute">
                <ScanLine className="size-10" />
                <p className="text-sm">Henüz ürün sayılmadı.</p>
              </div>
            )}

            <Button
              variant="danger"
              size="lg"
              className="mt-6 w-full"
              onClick={() => setFinishOpen(true)}
            >
              <LogOut className="size-5" /> Sayımı Bitir / Çıkış Yap
            </Button>
          </div>
        )}
      </div>

      {/* ---------- Alt Sekmeler ---------- */}
      <nav className="safe-bottom absolute inset-x-0 bottom-0 z-20 px-4 pt-2">
        <div className="glass mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-2xl p-1.5">
          {(
            [
              ["scan", "Barkod Tara", ScanLine],
              ["mine", `Kayıtlar (${totalCount})`, List],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold transition",
                tab === k
                  ? k === "scan"
                    ? "bg-scan text-white"
                    : "bg-brand text-white"
                  : "text-ink-dim",
              )}
            >
              <Icon className="size-4.5" /> {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ---------- Sayımı Bitir Onayı ---------- */}
      <Sheet
        open={finishOpen}
        onClose={() => !finishing && setFinishOpen(false)}
        title="Sayımı bitirmek istediğinize emin misiniz?"
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm text-ink-dim">
            Toplam <b className="text-ink">{totalCount}</b> ürün saydınız. Çıkış yaptıktan sonra bu
            operasyona tekrar katılmak için QR kodu veya linki yeniden açmanız gerekir.
          </p>
          {pending > 0 && (
            <p className="rounded-xl bg-warn-soft p-3 text-xs text-warn">
              {pending} kayıt henüz Drive&apos;a gönderilmedi; çıkmadan önce gönderilecek.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={finishing} onClick={() => setFinishOpen(false)}>
              Vazgeç
            </Button>
            <Button variant="danger" loading={finishing} onClick={() => void finishCount()}>
              Evet, Bitir
            </Button>
          </div>
        </div>
      </Sheet>

      {/* ---------- Alt Paneller ---------- */}
      <LocationSheet
        open={locOpen}
        operationId={op.id}
        current={location}
        onClose={() => setLocOpen(false)}
        onSave={setLocation}
      />

      <ItemSheet
        open={Boolean(barcode)}
        onClose={closeSheet}
        barcode={barcode ?? ""}
        operationId={op.id}
        location={editing?.location ?? location ?? ""}
        categories={categories}
        productTypes={types}
        existing={editing}
        prefill={prefill}
        existingPhotoUrl={editPhotoUrl}
        onSubmit={submit}
      />

      {/* Eşsiz Barkod Mükerrer Uyarısı */}
      <Sheet
        open={Boolean(dup)}
        onClose={() => setDup(null)}
        title="Bu barkod zaten sayıldı!"
      >
        {dup && (
          <div className="flex flex-col gap-3 pb-2">
            <div className="flex items-center gap-3 rounded-2xl bg-warn-soft p-4">
              <AlertTriangle className="size-6 shrink-0 text-warn" />
              <p className="text-sm">
                Barkodlar TC Kimlik numarası gibi <b>eşsizdir</b>. Bu ürün bu operasyonda daha önce kaydedilmiş:
              </p>
            </div>
            <InfoLine
              icon={<ScanLine className="size-4" />}
              label="Ürün"
              value={dup.description}
            />
            <InfoLine
              icon={<UserRound className="size-4" />}
              label="Sayan"
              value={dup.counted_by_name}
            />
            <InfoLine
              icon={<MapPin className="size-4" />}
              label="Lokasyon"
              value={dup.location}
            />
            <InfoLine
              icon={<RefreshCw className="size-4" />}
              label="Zaman"
              value={fmtDateTime(dup.created_at)}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  const found = items.find((i) => i.id === dup.id);
                  setDup(null);
                  if (found) openEdit(found);
                }}
              >
                <Pencil className="size-4" /> Kaydı Düzenle
              </Button>
              <Button size="lg" onClick={() => setDup(null)}>
                Tamam
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* Elle Barkod Girişi */}
      <Sheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Barkodu Elle Gir"
        footer={
          <Button
            size="xl"
            className="w-full"
            disabled={!manualValue.trim()}
            onClick={() => {
              setManualOpen(false);
              void handleBarcode(manualValue);
            }}
          >
            Devam Et
          </Button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manualValue.trim()) return;
            setManualOpen(false);
            void handleBarcode(manualValue);
          }}
          className="space-y-4"
        >
          <Field label="Barkod Numarası" required>
            <Input
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              className="font-mono text-lg"
              placeholder="Örn. 869873245700"
            />
          </Field>
        </form>
      </Sheet>
    </main>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-sm">
      <span className="text-ink-mute">{icon}</span>
      <span className="w-20 shrink-0 text-ink-mute">{label}</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{value}</span>
    </div>
  );
}

function Row({
  barcode,
  description,
  location,
  meta,
  details,
  hasPhoto,
  photoUrl,
  pending,
  onEdit,
  onDelete,
}: {
  barcode: string;
  description: string;
  location: string;
  meta: string;
  details?: string;
  hasPhoto: boolean;
  photoUrl?: string;
  pending?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "mb-2 flex items-center gap-3 rounded-2xl border border-line bg-white/[0.02] p-3",
        pending && "border-brand/30 bg-brand-soft/40",
      )}
    >
      <button
        onClick={onEdit}
        disabled={!onEdit}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl",
            hasPhoto ? "bg-ok-soft text-ok" : "bg-white/5 text-ink-mute",
          )}
        >
          {pending ? (
            <RefreshCw className="size-4.5 animate-spin text-[#9fb1ff]" />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={description} className="size-12 object-cover" />
          ) : hasPhoto ? (
            <ImageIcon className="size-4.5" />
          ) : (
            <ScanLine className="size-4.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">{description}</div>
          <div className="truncate text-xs text-ink-mute">
            <span className="font-mono">{barcode}</span> · {location} · {meta}
          </div>
          {details && (
            <div className="mt-0.5 truncate text-xs font-medium text-[#9fb1ff]">{details}</div>
          )}
        </div>
        {onEdit && <ChevronRight className="size-4 shrink-0 text-ink-mute" />}
      </button>
      {onEdit && (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="grid size-9 place-items-center rounded-lg text-ink-dim hover:bg-white/5"
            aria-label="Düzenle"
          >
            <Pencil className="size-4" />
          </button>
          <button
            onClick={onDelete}
            className="grid size-9 place-items-center rounded-lg text-ink-dim hover:bg-scan-soft hover:text-scan"
            aria-label="Sil"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
