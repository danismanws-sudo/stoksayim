"use client";

import imageCompression from "browser-image-compression";
import {
  Armchair, Camera, Car, ChevronDown, CircleHelp, ImagePlus, MapPin, Monitor, Package, Refrigerator, RotateCcw, Shirt, Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Sheet } from "@/components/ui";
import type { Category, CountItem, ExpectedItem, ItemCondition, ItemDraft, ProductType } from "@/lib/types";
import { CONDITION_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Package> = {
  armchair: Armchair, monitor: Monitor, refrigerator: Refrigerator, car: Car, shirt: Shirt, "circle-help": CircleHelp,
};

export interface ItemSubmit {
  draft: ItemDraft;
  photo: Blob | null;
  keepPhotoPath: string | null;
  updateId: string | null;
}

export function ItemSheet({
  open,
  onClose,
  barcode,
  operationId,
  location,
  categories,
  productTypes,
  existing,
  prefill,
  existingPhotoUrl,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  barcode: string;
  operationId: string;
  location: string;
  categories: Category[];
  productTypes: ProductType[];
  existing: CountItem | null;
  prefill: ExpectedItem | null;
  existingPhotoUrl: string | null;
  onSubmit: (s: ItemSubmit) => Promise<void>;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<ItemCondition | null>(null);
  const [conditionNote, setConditionNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  // Form açıldığında mevcut kayıt / beklenen liste ile doldur
  useEffect(() => {
    if (!open) return;
    const src = existing;
    setCategoryId(src?.category_id ?? null);
    setTypeId(src?.product_type_id ?? null);
    setDescription(src?.description ?? prefill?.description ?? "");
    setModel(src?.model ?? prefill?.model ?? "");
    setColor(src?.color ?? prefill?.color ?? "");
    setDimensions(src?.dimensions ?? prefill?.dimensions ?? "");
    setQuantity(String(src?.quantity ?? prefill?.quantity ?? 1));
    setCondition(src?.condition ?? null);
    setConditionNote(src?.condition_note ?? "");
    setAssignee(src?.assignee ?? prefill?.assignee ?? "");
    setPhoto(null);
    setPhotoPreview(null);
    setKeepPhoto(true);
    setShowDetails(Boolean(src?.model || src?.color || src?.dimensions || src?.condition || src?.assignee || prefill));
    if (!src && prefill?.category) {
      const c = categories.find((x) => x.name.toLocaleLowerCase("tr") === prefill.category!.toLocaleLowerCase("tr"));
      if (c) setCategoryId(c.id);
    }
  }, [open, existing, prefill, categories]);

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const types = useMemo(() => productTypes.filter((t) => t.category_id === categoryId), [productTypes, categoryId]);

  const pickCategory = (c: Category) => {
    setCategoryId(c.id);
    setTypeId(null);
    if (c.is_other) {
      setDescription("");
      setTimeout(() => descRef.current?.focus(), 50);
    }
  };

  const pickType = (t: ProductType) => {
    setTypeId(t.id);
    setDescription(t.name);
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setCompressing(true);
    try {
      const out = await imageCompression(f, {
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1600,
        fileType: "image/webp",
        initialQuality: 0.8,
        useWebWorker: true,
      });
      setPhoto(out);
      setPhotoPreview(URL.createObjectURL(out));
    } catch {
      toast.error("Fotoğraf işlenemedi");
    } finally {
      setCompressing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const currentPhoto = photoPreview ?? (keepPhoto ? existingPhotoUrl : null);
  const canSave = barcode.trim() && description.trim() && location.trim();

  const submit = async () => {
    if (!canSave) {
      toast.error("Ürün açıklaması zorunlu");
      descRef.current?.focus();
      return;
    }
    const q = Number(quantity.replace(",", "."));
    setSaving(true);
    try {
      await onSubmit({
        draft: {
          client_uuid: crypto.randomUUID(),
          operation_id: operationId,
          barcode: barcode.trim(),
          description: description.trim(),
          location: location.trim(),
          category_id: categoryId,
          product_type_id: typeId,
          model: model.trim() || null,
          color: color.trim() || null,
          dimensions: dimensions.trim() || null,
          quantity: Number.isFinite(q) && q > 0 ? q : 1,
          condition,
          condition_note: conditionNote.trim() || null,
          assignee: assignee.trim() || null,
        },
        photo,
        keepPhotoPath: !photo && keepPhoto ? existing?.photo_path ?? null : null,
        updateId: existing?.id ?? null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{existing ? "Kaydı düzenle" : "Yeni ürün"}</span>
          <span className="font-mono text-lg tracking-wide">{barcode}</span>
        </div>
      }
      footer={
        <Button size="xl" className="w-full" onClick={submit} loading={saving} disabled={!canSave || compressing}>
          {existing ? "Güncelle" : "Kaydet"}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-ink-dim">
          <MapPin className="size-4 text-scan" /> <span className="truncate">{location}</span>
          {prefill && <span className="ml-auto shrink-0 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">Listede var</span>}
        </div>

        {/* 1) Ürün cinsi */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-dim">Ürün cinsi</h3>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((c) => {
              const Icon = ICONS[c.icon ?? ""] ?? Package;
              const on = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  onClick={() => pickCategory(c)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-[12px] font-semibold transition",
                    on ? "border-brand bg-brand-soft text-ink" : "border-line bg-white/[0.02] text-ink-dim hover:bg-white/5",
                    c.is_other && !on && "border-dashed",
                  )}
                >
                  <Icon className={cn("size-5", on ? "text-[#9fb1ff]" : "text-ink-mute")} />
                  <span className="leading-tight">{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2) Ürün adı */}
        <AnimatePresence initial={false}>
          {category && !category.is_other && types.length > 0 && (
            <motion.section initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <h3 className="mb-2 text-[13px] font-semibold text-ink-dim">Ürün adı</h3>
              <div className="flex flex-wrap gap-2">
                {types.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickType(t)}
                    className={cn(
                      "h-10 rounded-full border px-4 text-sm font-semibold transition",
                      t.id === typeId ? "border-brand bg-brand text-white" : "border-line bg-white/[0.03] text-ink-dim hover:bg-white/5",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* 3) Açıklama (zorunlu) */}
        <Field
          label={category?.is_other ? "Ürün nedir? (DİĞER)" : "Ürün açıklaması"}
          required
          hint={!category ? "Yukarıdan seçin veya doğrudan yazın" : undefined}
        >
          <Input
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Örn. Toplantı masası"
            enterKeyHint="done"
          />
        </Field>

        {/* 4) Fotoğraf (tek kare, opsiyonel) */}
        <section>
          <h3 className="mb-2 text-[13px] font-semibold text-ink-dim">Fotoğraf</h3>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {currentPhoto ? (
            <div className="relative overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={currentPhoto} alt="Ürün fotoğrafı" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="backdrop-blur">
                  <RotateCcw className="size-4" /> Yeniden çek
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                    setKeepPhoto(false);
                  }}
                >
                  <Trash2 className="size-4" /> Kaldır
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={compressing}
              className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-white/[0.02] text-sm font-semibold text-ink-dim transition hover:bg-white/5"
            >
              {compressing ? <ImagePlus className="size-6 animate-pulse" /> : <Camera className="size-6" />}
              {compressing ? "Hazırlanıyor…" : "Fotoğraf çek"}
            </button>
          )}
        </section>

        {/* 5) Detaylar (opsiyonel) */}
        <section className="rounded-2xl border border-line">
          <button onClick={() => setShowDetails((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
            <span>Detaylar <span className="font-normal text-ink-mute">(isteğe bağlı)</span></span>
            <ChevronDown className={cn("size-4 transition", showDetails && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {showDetails && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                  <Field label="Modeli"><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Lenovo" /></Field>
                  <Field label="Rengi"><Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Siyah" /></Field>
                  <Field label="Ölçüleri"><Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="70x30 cm" /></Field>
                  <Field label="Miktar"><Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
                  <div className="col-span-2">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-dim">Durumu</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(CONDITION_LABEL) as ItemCondition[]).map((k) => (
                        <button
                          key={k}
                          onClick={() => setCondition(condition === k ? null : k)}
                          className={cn(
                            "h-11 rounded-xl border text-sm font-semibold transition",
                            condition === k
                              ? k === "saglam" ? "border-ok/40 bg-ok-soft text-ok" : k === "hurda" ? "border-scan/40 bg-scan-soft text-[#ff7a82]" : "border-warn/40 bg-warn-soft text-warn"
                              : "border-line bg-white/[0.02] text-ink-dim",
                          )}
                        >
                          {CONDITION_LABEL[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {condition && condition !== "saglam" && (
                    <Field label="Durum notu" className="col-span-2">
                      <Input value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} placeholder="Örn. Ayağı kırık" />
                    </Field>
                  )}
                  <Field label="Zimmet (kişi veya yer)" className="col-span-2">
                    <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Örn. Sinan Aktaşöz / Genel Ofis" />
                  </Field>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </Sheet>
  );
}
