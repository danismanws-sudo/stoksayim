"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  HardDrive,
  Tags,
  Image as ImageIcon,
  Layers,
  Link2,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  Search,
  Send,
  Smartphone,
  LogOut,
  PauseCircle,
  PlayCircle,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemSheet, type ItemSubmit } from "@/components/field/item-sheet";
import { Badge, Button, Card, Field, FullScreenLoader, Input, Logo, Sheet } from "@/components/ui";
import type { OperationMemberRecord } from "@/lib/drive-store";
import type {
  Category,
  CompareRow,
  CountItem,
  ExpectedItem,
  Operation,
  OperationLink,
  OperationMode,
  ProductType,
} from "@/lib/types";
import { CONDITION_LABEL, MODE_LABEL, STATUS_LABEL } from "@/lib/types";
import { cn, fmtDateTime, humanError } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

type PanelTab = "table" | "compare" | "qr" | "materials";

const APPS_SCRIPT_CODE = `// Google Drive -> Yeni -> Google Apps Script içine yapıştırıp "Web Uygulaması Olarak Dağıt" (Herkes erişebilir) seçin:
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var rootName = data.folderName || "DETAY_STOK_SAYIM_DRIVE";
  var roots = DriveApp.getFoldersByName(rootName);
  var root = roots.hasNext() ? roots.next() : DriveApp.createFolder(rootName);

  if (data.event === "save_item" && data.item) {
    var opFolderName = data.operationCode + " - " + (data.operationName || "");
    var opFolders = root.getFoldersByName(opFolderName);
    var opFolder = opFolders.hasNext() ? opFolders.next() : root.createFolder(opFolderName);

    if (data.photoBase64) {
      var raw = data.photoBase64.replace(/^data:image\\/\\w+;base64,/, "");
      var blob = Utilities.newBlob(Utilities.base64Decode(raw), "image/webp", data.item.barcode + ".webp");
      opFolder.createFile(blob);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}`;

export function PanelClient() {
  const [loading, setLoading] = useState(true);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [selectedOpId, setSelectedOpId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [items, setItems] = useState<CountItem[]>([]);
  const [expected, setExpected] = useState<ExpectedItem[]>([]);
  const [compareRows, setCompareRows] = useState<CompareRow[]>([]);
  const [links, setLinks] = useState<OperationLink[]>([]);
  const [members, setMembers] = useState<OperationMemberRecord[]>([]);

  const [tab, setTab] = useState<PanelTab>("table");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterQuick, setFilterQuick] = useState<"all" | "with_photo" | "no_photo" | "damaged">("all");
  const [compareFilter, setCompareFilter] = useState<"all" | "fire" | "bulunan" | "fazla">("all");

  // Modallar
  const [newOpOpen, setNewOpOpen] = useState(false);
  const [opName, setOpName] = useState("");
  const [opClient, setOpClient] = useState("");
  const [opMode, setOpMode] = useState<OperationMode>("compare");
  const [opNotes, setOpNotes] = useState("");
  const [opLocations, setOpLocations] = useState("");
  const [locEditOpen, setLocEditOpen] = useState(false);
  const [locEditValue, setLocEditValue] = useState("");
  const [opBusy, setOpBusy] = useState(false);

  // PC'den ürün ekleme / düzenleme
  const [pcEditOpen, setPcEditOpen] = useState(false);
  const [pcBarcode, setPcBarcode] = useState("");
  const [pcLocation, setPcLocation] = useState("Genel Ofis");
  const [editingItem, setEditingItem] = useState<CountItem | null>(null);
  const [lightboxItem, setLightboxItem] = useState<CountItem | null>(null);

  // QR Görselleri
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});

  // Beklenen liste içe aktarma
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  // Kategori / Çeşit yönetimi
  const [newCatName, setNewCatName] = useState("");
  const [selectedCatForType, setSelectedCatForType] = useState<string>("");
  const [newTypeName, setNewTypeName] = useState("");

  // Drive ayarları
  const loadAll = useCallback(async (targetOpId?: string) => {
    try {
      const res = await fetch("/api/drive");
      const data = await res.json();
      const ops = (data.operations as Operation[]) ?? [];
      setOperations(ops);
      setCategories((data.categories as Category[]) ?? []);
      setProductTypes((data.product_types as ProductType[]) ?? []);

      const activeId = targetOpId || selectedOpId || ops[0]?.id || "";
      if (activeId) {
        setSelectedOpId(activeId);
        const opRes = await fetch(`/api/drive?opId=${encodeURIComponent(activeId)}`);
        if (opRes.ok) {
          const opData = await opRes.json();
          setItems((opData.items as CountItem[]) ?? []);
          setExpected((opData.expected as ExpectedItem[]) ?? []);
          setCompareRows((opData.compare as CompareRow[]) ?? []);
          setLinks((opData.links as OperationLink[]) ?? []);
          setMembers((opData.members as OperationMemberRecord[]) ?? []);
        }
      }
    } catch (e) {
      toast.error(humanError(e));
    } finally {
      setLoading(false);
    }
  }, [selectedOpId]);

  useEffect(() => {
    void loadAll();
    const timer = setInterval(() => void loadAll(), 10_000);
    return () => clearInterval(timer);
  }, [loadAll]);

  useEffect(() => {
    if (!selectedCatForType && categories.length > 0) {
      const firstNonOther = categories.find((c) => !c.is_other);
      if (firstNonOther) setSelectedCatForType(firstNonOther.id);
    }
  }, [categories, selectedCatForType]);

  // QR kodlarını üret
  useEffect(() => {
    if (typeof window === "undefined" || links.length === 0) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const l of links) {
        const joinUrl = `${window.location.origin}/j/${l.token}`;
        map[l.id] = await QRCode.toDataURL(joinUrl, {
          width: 360,
          margin: 2,
          color: { dark: "#0a0d13", light: "#ffffff" },
        });
      }
      setQrDataUrls(map);
    })();
  }, [links]);

  const currentOp = operations.find((o) => o.id === selectedOpId) ?? null;

  const uniqueLocations = useMemo(
    () => Array.from(new Set(items.map((i) => i.location))).sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (filterCategory !== "all" && it.category_id !== filterCategory) return false;
      if (filterLocation !== "all" && it.location !== filterLocation) return false;
      if (filterQuick === "with_photo" && !it.photo_path) return false;
      if (filterQuick === "no_photo" && it.photo_path) return false;
      if (filterQuick === "damaged" && (!it.condition || it.condition === "saglam")) return false;
      if (search.trim()) {
        const q = search.trim().toLocaleLowerCase("tr");
        const hay = [
          it.barcode,
          it.description,
          it.category_name,
          it.location,
          it.model,
          it.color,
          it.assignee,
          it.counted_by_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("tr");
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterCategory, filterLocation, filterQuick, search]);

  const filteredCompare = useMemo(
    () =>
      compareRows.filter((r) =>
        compareFilter === "all" ? true : r.status === compareFilter,
      ),
    [compareRows, compareFilter],
  );

  const stats = useMemo(() => {
    const withPhoto = items.filter((i) => i.photo_path).length;
    const fireCount = compareRows.filter((r) => r.status === "fire").length;
    const bulunanCount = compareRows.filter((r) => r.status === "bulunan").length;
    const fazlaCount = compareRows.filter((r) => r.status === "fazla").length;
    return {
      totalItems: items.length,
      withPhoto,
      fireCount,
      bulunanCount,
      fazlaCount,
    };
  }, [items, compareRows]);

  const createOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opName.trim()) return;
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_operation",
          name: opName.trim(),
          client_name: opClient.trim(),
          mode: opMode,
          notes: opNotes.trim(),
          locations: opLocations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.op.code} operasyonu ve özel QR kodu oluşturuldu!`);
      setNewOpOpen(false);
      setOpName("");
      setOpClient("");
      setOpNotes("");
      setOpLocations("");
      await loadAll(data.op.id);
    } catch (err) {
      toast.error(humanError(err));
    }
  };

  const postAction = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || "İşlem başarısız");
    return data;
  };

  const toggleOperationStatus = async () => {
    if (!currentOp) return;
    const toPassive = currentOp.status === "active";
    const msg = toPassive
      ? `"${currentOp.name}" pasife alınsın mı?\n\nSaha personeli bu operasyona QR/link ile giremez ve yeni kayıt yapamaz. Kayıtlar silinmez, istediğiniz zaman tekrar aktifleştirebilirsiniz.`
      : `"${currentOp.name}" tekrar aktifleştirilsin mi?`;
    if (!confirm(msg)) return;
    setOpBusy(true);
    try {
      await postAction({
        action: "update_operation_status",
        operation_id: currentOp.id,
        status: toPassive ? "closed" : "active",
      });
      toast.success(toPassive ? "Operasyon pasife alındı" : "Operasyon aktifleştirildi");
      await loadAll(currentOp.id);
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setOpBusy(false);
    }
  };

  const deleteOperation = async () => {
    if (!currentOp) return;
    const typed = prompt(
      `DİKKAT: "${currentOp.name}" operasyonu ve uygulamadaki tüm sayım kayıtları, QR bağlantıları ve beklenen listesi kalıcı olarak silinecek.\n(Google Drive'daki fotoğraf ve Excel klasörü arşiv olarak kalır.)\n\nOnaylamak için operasyon kodunu yazın: ${currentOp.code}`,
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== currentOp.code.toUpperCase()) {
      toast.error("Operasyon kodu eşleşmedi, silinmedi.");
      return;
    }
    setOpBusy(true);
    try {
      await postAction({ action: "delete_operation", operation_id: currentOp.id });
      toast.success(`${currentOp.code} silindi`);
      const next = operations.find((o) => o.id !== currentOp.id);
      setSelectedOpId(next?.id ?? "");
      await loadAll(next?.id ?? "");
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setOpBusy(false);
    }
  };

  const saveOperationLocations = async () => {
    if (!currentOp) return;
    setOpBusy(true);
    try {
      await postAction({
        action: "update_operation_locations",
        operation_id: currentOp.id,
        locations: locEditValue,
      });
      toast.success("Lokasyonlar kaydedildi");
      setLocEditOpen(false);
      await loadAll(currentOp.id);
    } catch (err) {
      toast.error(humanError(err));
    } finally {
      setOpBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/panel/login", { method: "DELETE" });
    window.location.reload();
  };

  const handlePcSaveItem = async ({ draft, photo, keepPhotoPath, updateId }: ItemSubmit) => {
    let photoBase64: string | null = null;
    if (photo) {
      photoBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ""));
        reader.onerror = reject;
        reader.readAsDataURL(photo);
      });
    }
    const res = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_item",
        draft,
        update_id: updateId,
        keep_photo_path: keepPhotoPath,
        photo_base64: photoBase64,
        counted_by: "prof-patron",
        counted_by_name: "Yönetici Paneli",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Kaydedilemedi");
      return;
    }
    toast.success("Ürün Drive ve Excel tablosuna kaydedildi");
    setPcEditOpen(false);
    setEditingItem(null);
    await loadAll(selectedOpId);
  };

  const handleDeleteItem = async (it: CountItem) => {
    if (!confirm(`${it.barcode} (${it.description}) silinsin mi?`)) return;
    await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_item", id: it.id }),
    });
    toast.success("Kayıt silindi");
    await loadAll(selectedOpId);
  };

  const handleImportExpected = async () => {
    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return toast.error("En az 1 satır giriniz");

    const rows = lines.map((line) => {
      const parts = line.split(/\t|;|,/).map((p) => p.trim());
      return {
        barcode: parts[0] ?? "",
        category: parts[1] ?? "Mobilya",
        description: parts[2] ?? "Ürün",
        location: parts[3] ?? "Genel Ofis",
        assignee: parts[4] ?? "",
      };
    });

    const res = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "import_expected",
        operation_id: selectedOpId,
        rows,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error);
    toast.success(`${data.added} beklenen ürün yüklendi, Fire karşılaştırması güncellendi!`);
    setImportOpen(false);
    await loadAll(selectedOpId);
  };

  if (loading) return <FullScreenLoader label="Yönetici paneli hazırlanıyor…" />;

  return (
    <div className="min-h-dvh flex flex-col">
      {/* ---------- Üst Bar ---------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Logo />
            </Link>
            <span className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-mute">
              {APP_VERSION}
            </span>
            <span className="hidden h-6 w-px bg-line sm:block" />
            <div className="hidden text-sm font-bold text-ink sm:block">Operasyon Kontrol Merkezi</div>
          </div>

          {/* Operasyon Seçici + Yeni Operasyon */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedOpId}
              onChange={(e) => void loadAll(e.target.value)}
              className="h-11 rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm font-semibold text-ink outline-none focus:border-brand"
            >
              {operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.code} — {op.name} ({STATUS_LABEL[op.status]})
                </option>
              ))}
            </select>

            <Button size="md" onClick={() => setNewOpOpen(true)}>
              <Plus className="size-4" /> Yeni Operasyon Aç
            </Button>

            {currentOp && (
              <Link href={`/sayim/${currentOp.id}`}>
                <Button size="md" variant="scan">
                  <Smartphone className="size-4" /> Saha Kamera Ekranı
                </Button>
              </Link>
            )}

            <Button size="md" variant="ghost" onClick={() => void logout()} title="Çıkış yap">
              <LogOut className="size-4" /> Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-5 py-6">
        {currentOp && (
          <>
            {/* ---------- Operasyon Özet & KPI Kartları ---------- */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                    Seçili Operasyon
                  </span>
                  <Badge tone={currentOp.status === "active" ? "ok" : "warn"}>
                    {STATUS_LABEL[currentOp.status]}
                  </Badge>
                </div>
                <div className="mt-1 font-mono text-lg font-extrabold text-[#9fb1ff]">
                  {currentOp.code}
                </div>
                <div className="truncate text-sm font-semibold">{currentOp.name}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge tone="brand">{MODE_LABEL[currentOp.mode]}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={opBusy}
                    onClick={() => {
                      setLocEditValue((currentOp.locations ?? []).join("\n"));
                      setLocEditOpen(true);
                    }}
                    title="Saha personelinin seçeceği odaları düzenle"
                  >
                    <MapPin className="size-3.5" /> Lokasyonlar ({currentOp.locations?.length ?? 0})
                  </Button>
                  <Button size="sm" variant="outline" disabled={opBusy} onClick={() => void toggleOperationStatus()}>
                    {currentOp.status === "active" ? (
                      <>
                        <PauseCircle className="size-3.5" /> Pasife Al
                      </>
                    ) : (
                      <>
                        <PlayCircle className="size-3.5" /> Aktifleştir
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="danger" disabled={opBusy} onClick={() => void deleteOperation()}>
                    <Trash2 className="size-3.5" /> Operasyonu Sil
                  </Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                  Sayılan Toplam Ürün
                </div>
                <div className="mt-1 tabular text-3xl font-extrabold">{stats.totalItems}</div>
                <div className="mt-1 text-xs text-ink-dim">
                  {uniqueLocations.length} farklı oda/lokasyonda
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                  Fotoğraflı Ürün (Barkod ID)
                </div>
                <div className="mt-1 tabular text-3xl font-extrabold text-ok">
                  {stats.withPhoto}
                </div>
                <div className="mt-1 text-xs text-ink-dim">
                  Tek kare fotoğraf barkoda bağlı
                </div>
              </Card>

              <Card className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                  Fire / Karşılaştırma Özeti
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="tabular text-2xl font-extrabold text-ok">
                    {stats.bulunanCount} Bulunan
                  </span>
                  <span className="tabular text-lg font-bold text-scan">
                    {stats.fireCount} Fire
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-dim">
                  {stats.fazlaCount} liste dışı fazla ürün
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                    Google Drive Veritabanı
                  </span>
                  <HardDrive className="size-4 text-ok" />
                </div>
                <div className="mt-1 text-sm font-bold text-ok">Canlı Senkron Aktif</div>
                <div className="mt-1 truncate text-xs text-ink-mute">
                  Klasör: Operasyonlar/{currentOp.code}
                </div>
                <a
                  href={`/api/drive/excel/${currentOp.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#9fb1ff] hover:underline"
                >
                  <Download className="size-3.5" /> Excel (.xlsx) İndir
                </a>
              </Card>
            </div>

            {/* ---------- Ana Sekmeler ---------- */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["table", `Excel Sayım Tablosu (${items.length})`, FileSpreadsheet],
                    [
                      "compare",
                      `Fire & Liste Karşılaştırma (${stats.fireCount} Fire)`,
                      Layers,
                    ],
                    ["qr", `Operasyona Özel QR & Link (${links.length})`, QrCode],
                    ["materials", "Malzeme Çeşitleri", Tags],
                  ] as const
                ).map(([k, label, Icon]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition",
                      tab === k
                        ? "bg-brand text-white shadow-lg shadow-brand/25"
                        : "bg-white/[0.03] text-ink-dim hover:bg-white/10",
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null);
                    setPcBarcode(`869${Math.floor(100000000 + Math.random() * 900000000)}`);
                    setPcEditOpen(true);
                  }}
                >
                  <Plus className="size-4" /> PC&apos;den Ürün Gir
                </Button>
                <a href={`/api/drive/excel/${currentOp.id}`}>
                  <Button size="sm" variant="primary">
                    <Download className="size-4" /> Excel&apos;e Aktar (.xlsx)
                  </Button>
                </a>
              </div>
            </div>

            {/* =====================================================================
                SEKME 1: EXCEL SAYIM TABLOSU (Duran Varlık Sayım Datası Şablonu)
            ===================================================================== */}
            {tab === "table" && (
              <div className="flex flex-col gap-4">
                {/* Filtre Çubuğu */}
                <Card className="flex flex-wrap items-center gap-3 p-3.5">
                  <div className="relative min-w-[240px] flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-mute" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Barkod, ürün adı, zimmetli kişi, oda/lokasyon, model ara…"
                      className="h-10 pl-10 text-sm"
                    />
                  </div>

                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink"
                  >
                    <option value="all">Tüm Ürün Cinsleri</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-ink"
                  >
                    <option value="all">Tüm Lokasyonlar ({uniqueLocations.length})</option>
                    {uniqueLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["all", "Tümü"],
                        ["with_photo", "Fotoğraflı"],
                        ["no_photo", "Fotoğrafsız"],
                        ["damaged", "Hurda / Arızalı"],
                      ] as const
                    ).map(([k, label]) => (
                      <button
                        key={k}
                        onClick={() => setFilterQuick(k)}
                        className={cn(
                          "h-9 rounded-lg border px-3 text-xs font-semibold transition",
                          filterQuick === k
                            ? "border-brand bg-brand-soft text-[#9fb1ff]"
                            : "border-line bg-white/[0.02] text-ink-dim hover:bg-white/5",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Excel Görünümlü Tablo */}
                <Card className="overflow-hidden">
                  <div className="scroll-thin overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-line-strong bg-surface-2/90 text-[12px] font-bold uppercase tracking-wider text-ink-dim">
                          <th className="px-3.5 py-3">Sırası</th>
                          <th className="px-3.5 py-3">Barkodu (Eşsiz ID)</th>
                          <th className="px-3.5 py-3">Lokasyon</th>
                          <th className="px-3.5 py-3">Ürün Cinsi</th>
                          <th className="px-3.5 py-3">Ürün Adı / Açıklaması</th>
                          <th className="px-3.5 py-3">Modeli</th>
                          <th className="px-3.5 py-3">Rengi</th>
                          <th className="px-3.5 py-3">Ölçüleri</th>
                          <th className="px-3.5 py-3">Miktar</th>
                          <th className="px-3.5 py-3">Hurda-Sağlam Bilgisi</th>
                          <th className="px-3.5 py-3">Zimmet Durumu</th>
                          <th className="px-3.5 py-3">Resmi</th>
                          <th className="px-3.5 py-3">Sayan</th>
                          <th className="px-3.5 py-3 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredItems.map((it, idx) => (
                          <tr
                            key={it.id}
                            className="transition hover:bg-white/[0.025]"
                          >
                            <td className="px-3.5 py-3 font-mono text-xs text-ink-mute">
                              {idx + 1}
                            </td>
                            <td className="px-3.5 py-3 font-mono font-bold text-[#9fb1ff]">
                              {it.barcode}
                            </td>
                            <td className="px-3.5 py-3">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-scan-soft px-2 py-0.5 text-xs font-semibold text-[#ff9aa0]">
                                <MapPin className="size-3" /> {it.location}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-ink-dim">
                              {it.category_name ?? "-"}
                            </td>
                            <td className="px-3.5 py-3 font-semibold text-ink">
                              {it.description}
                            </td>
                            <td className="px-3.5 py-3 text-ink-dim">{it.model || "-"}</td>
                            <td className="px-3.5 py-3 text-ink-dim">{it.color || "-"}</td>
                            <td className="px-3.5 py-3 text-ink-dim">
                              {it.dimensions || "-"}
                            </td>
                            <td className="px-3.5 py-3 font-mono">{it.quantity}</td>
                            <td className="px-3.5 py-3">
                              {it.condition ? (
                                <Badge
                                  tone={
                                    it.condition === "saglam"
                                      ? "ok"
                                      : it.condition === "hurda"
                                        ? "scan"
                                        : "warn"
                                  }
                                >
                                  {CONDITION_LABEL[it.condition]}
                                  {it.condition_note ? ` · ${it.condition_note}` : ""}
                                </Badge>
                              ) : (
                                <span className="text-ink-mute">-</span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-ink-dim">
                              {it.assignee || "-"}
                            </td>
                            <td className="px-3.5 py-3">
                              {it.photo_path ? (
                                <button
                                  onClick={() => setLightboxItem(it)}
                                  className="group flex items-center gap-2 rounded-lg border border-ok/30 bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok hover:brightness-110"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`/api/drive/photo/${it.photo_path}`}
                                    alt={it.description}
                                    className="size-6 rounded object-cover"
                                  />
                                  <span>Gör ({it.barcode}.webp)</span>
                                </button>
                              ) : (
                                <span className="text-xs text-ink-mute">Fotoğraf yok</span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-xs text-ink-dim">
                              <div>{it.counted_by_name ?? "-"}</div>
                              <div className="text-[11px] text-ink-mute">
                                {fmtDateTime(it.created_at)}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <button
                                  onClick={() => {
                                    setEditingItem(it);
                                    setPcBarcode(it.barcode);
                                    setPcLocation(it.location);
                                    setPcEditOpen(true);
                                  }}
                                  className="grid size-8 place-items-center rounded-lg text-ink-dim hover:bg-white/10"
                                  title="Düzenle"
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  onClick={() => void handleDeleteItem(it)}
                                  className="grid size-8 place-items-center rounded-lg text-ink-dim hover:bg-scan-soft hover:text-scan"
                                  title="Sil"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={14}
                              className="py-12 text-center text-sm text-ink-mute"
                            >
                              Bu filtreye uygun sayım kaydı bulunamadı.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* =====================================================================
                SEKME 2: FİRE & ESKİ LİSTE KARŞILAŞTIRMA
            ===================================================================== */}
            {tab === "compare" && (
              <div className="flex flex-col gap-4">
                <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div>
                    <h3 className="text-base font-bold">
                      Eski Liste & Fire Karşılaştırma Motoru
                    </h3>
                    <p className="text-xs text-ink-dim">
                      Eski envanter listesini yükleyerek sahada bulunamayan (Fire) ve listede olmayıp yeni bulunan (Fazla) demirbaşları anında tespit edin.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setImportText(
                          expected
                            .map(
                              (e) =>
                                `${e.barcode};${e.category ?? "Mobilya"};${e.description ?? "Ürün"};${e.location ?? "Genel Ofis"};${e.assignee ?? ""}`,
                            )
                            .join("\n"),
                        );
                        setImportOpen(true);
                      }}
                    >
                      <Upload className="size-4" /> Eski Liste Yükle / Düzenle (
                      {expected.length} kayıt)
                    </Button>
                  </div>
                </Card>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", `Tümü (${compareRows.length})`],
                      ["fire", `FİRE / Eksik (${stats.fireCount})`],
                      ["bulunan", `Bulunan (${stats.bulunanCount})`],
                      ["fazla", `Liste Dışı Fazla (${stats.fazlaCount})`],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setCompareFilter(k)}
                      className={cn(
                        "h-10 rounded-xl border px-4 text-sm font-bold transition",
                        compareFilter === k
                          ? k === "fire"
                            ? "border-scan bg-scan text-white"
                            : "border-brand bg-brand text-white"
                          : "border-line bg-white/[0.03] text-ink-dim",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <Card className="overflow-hidden">
                  <div className="scroll-thin overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-line-strong bg-surface-2 text-xs font-bold uppercase tracking-wider text-ink-dim">
                          <th className="px-4 py-3">Durum</th>
                          <th className="px-4 py-3">Barkodu</th>
                          <th className="px-4 py-3">Beklenen Ürün (Eski Liste)</th>
                          <th className="px-4 py-3">Sayılan Ürün (Saha)</th>
                          <th className="px-4 py-3">Beklenen Lokasyon</th>
                          <th className="px-4 py-3">Sayılan Lokasyon</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {filteredCompare.map((r) => (
                          <tr key={r.barcode} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              {r.status === "bulunan" && (
                                <Badge tone="ok">
                                  <CheckCircle2 className="size-3.5" /> BULUNDU
                                </Badge>
                              )}
                              {r.status === "fire" && (
                                <Badge tone="scan">
                                  <AlertTriangle className="size-3.5" /> FİRE (BULUNAMADI)
                                </Badge>
                              )}
                              {r.status === "fazla" && (
                                <Badge tone="warn">FAZLA (LİSTEDE YOK)</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold">
                              {r.barcode}
                            </td>
                            <td className="px-4 py-3">
                              {r.expected_description ?? "-"}
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {r.counted_description ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-ink-dim">
                              {r.expected_location ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-ink-dim">
                              {r.counted_location ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* =====================================================================
                SEKME 3: OPERASYONA ÖZEL QR KOD VE WHATSAPP LİNK YÖNETİMİ
            ===================================================================== */}
            {tab === "qr" && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <Card className="flex items-center justify-between p-4">
                    <div>
                      <h3 className="text-base font-bold">
                        {currentOp.code} Operasyonuna Özel QR & WhatsApp Bağlantıları
                      </h3>
                      <p className="text-xs text-ink-dim">
                        Üretilen her bağlantı ve QR kod <b>yalnızca {currentOp.name}</b> operasyonu için geçerlidir.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/drive", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "create_link",
                            operation_id: currentOp.id,
                            label: `Saha Ekip Linki #${links.length + 1}`,
                          }),
                        });
                        toast.success("Yeni operasyon bağlantısı ve QR kod üretildi");
                        await loadAll(currentOp.id);
                      }}
                    >
                      <Plus className="size-4" /> Yeni QR / Link Üret
                    </Button>
                  </Card>

                  {links.map((l) => {
                    const joinUrl =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/j/${l.token}`
                        : `/j/${l.token}`;
                    const qrSrc = qrDataUrls[l.id];

                    return (
                      <Card
                        key={l.id}
                        className={cn(
                          "flex flex-col gap-5 p-5 sm:flex-row sm:items-center",
                          l.revoked_at && "opacity-50",
                        )}
                      >
                        <div className="flex flex-col items-center gap-2">
                          {qrSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrSrc}
                              alt="Operasyon QR Kodu"
                              className="size-40 rounded-2xl border border-line bg-white p-2 shadow-lg"
                            />
                          ) : (
                            <div className="grid size-40 place-items-center rounded-2xl bg-white/5">
                              <QrCode className="size-10 text-ink-mute" />
                            </div>
                          )}
                          {qrSrc && (
                            <a
                              href={qrSrc}
                              download={`${currentOp.code}_QR_${l.token}.png`}
                              className="text-xs font-semibold text-[#9fb1ff] hover:underline"
                            >
                              QR Görselini İndir (.png)
                            </a>
                          )}
                        </div>

                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold">
                              {l.label ?? "Saha Bağlantısı"}
                            </span>
                            {l.revoked_at ? (
                              <Badge tone="scan">İptal Edildi</Badge>
                            ) : (
                              <Badge tone="ok">Aktif · {l.use_count} giriş</Badge>
                            )}
                          </div>

                          <div className="rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-xs text-ink-dim break-all">
                            {joinUrl}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(joinUrl);
                                toast.success("Bağlantı panoya kopyalandı!");
                              }}
                            >
                              <Copy className="size-4" /> Linki Kopyala
                            </Button>

                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(
                                `Detay Stok Sayım — ${currentOp.name} (${currentOp.code}) sayımına katılmak için tıklayın:\n${joinUrl}`,
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Button size="sm" variant="outline">
                                <Send className="size-4" /> WhatsApp&apos;ta Paylaş
                              </Button>
                            </a>

                            <Link href={`/j/${l.token}`}>
                              <Button size="sm" variant="ghost">
                                <ExternalLink className="size-4" /> Giriş Ekranını Aç
                              </Button>
                            </Link>

                            {!l.revoked_at && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={async () => {
                                  await fetch("/api/drive", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      action: "revoke_link",
                                      link_id: l.id,
                                    }),
                                  });
                                  toast.success("Bağlantı iptal edildi");
                                  await loadAll(currentOp.id);
                                }}
                              >
                                İptal Et
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Katılan Saha Personelleri */}
                <Card className="p-5">
                  <h3 className="flex items-center gap-2 text-base font-bold">
                    <Users className="size-5 text-brand" /> Bu Operasyona Katılan Personel (
                    {members.length})
                  </h3>
                  <p className="mt-1 text-xs text-ink-dim">
                    WhatsApp linki veya QR kod üzerinden Ad-Soyad ve Telefon ile giriş yapan saha çalışanları:
                  </p>
                  <div className="mt-4 space-y-2.5">
                    {members.map((m) => {
                      const count = items.filter((i) => i.counted_by === m.profile_id).length;
                      return (
                        <div
                          key={m.profile_id}
                          className="flex items-center justify-between rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5"
                        >
                          <div>
                            <div className="text-sm font-bold">{m.full_name}</div>
                            <div className="font-mono text-xs text-ink-mute">{m.phone}</div>
                          </div>
                          <Badge tone="brand">{count} ürün saydı</Badge>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* =====================================================================
                SEKME 4: MALZEME ÇEŞİTLERİ
            ===================================================================== */}
            {tab === "materials" && (
              <div className="mx-auto w-full max-w-3xl">
                {/* Malzeme Seçimi ve DİĞER Kuralı Yönetimi */}
                <Card className="p-5 space-y-5">
                  <div>
                    <h3 className="text-base font-bold">
                      Malzeme Başlıkları & Çeşitleri (Masa, Sandalye, Keson + DİĞER)
                    </h3>
                    <p className="text-xs text-ink-dim">
                      Saha çalışanlarının barkod okuttuktan sonra tek dokunuşla seçtiği ana başlık ve malzeme çeşitlerini buradan özelleştirin.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Yeni ana başlık (Örn. Laboratuvar Ekipmanı)"
                      className="h-10"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!newCatName.trim()) return;
                        await fetch("/api/drive", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "add_category",
                            name: newCatName.trim(),
                          }),
                        });
                        setNewCatName("");
                        toast.success("Ana başlık eklendi");
                        await loadAll(selectedOpId);
                      }}
                    >
                      <Plus className="size-4" /> Ekle
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={selectedCatForType}
                      onChange={(e) => setSelectedCatForType(e.target.value)}
                      className="h-10 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm"
                    >
                      {categories
                        .filter((c) => !c.is_other)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                    <Input
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="Yeni malzeme çeşidi (Örn. Toplantı Koltuğu)"
                      className="h-10 flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!newTypeName.trim() || !selectedCatForType) return;
                        await fetch("/api/drive", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "add_product_type",
                            category_id: selectedCatForType,
                            name: newTypeName.trim(),
                          }),
                        });
                        setNewTypeName("");
                        toast.success("Malzeme çeşidi eklendi");
                        await loadAll(selectedOpId);
                      }}
                    >
                      <Plus className="size-4" /> Çeşit Ekle
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {categories.map((c) => {
                      const cTypes = productTypes.filter((t) => t.category_id === c.id);
                      return (
                        <div
                          key={c.id}
                          className="rounded-xl border border-line bg-white/[0.02] p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold">{c.name}</span>
                            {c.is_other && (
                              <Badge tone="scan">Serbest Klavye Girişi (Zorunlu Sekme)</Badge>
                            )}
                          </div>
                          {!c.is_other && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {cTypes.map((t) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold"
                                >
                                  {t.name}
                                  <button
                                    onClick={async () => {
                                      await fetch("/api/drive", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          action: "delete_product_type",
                                          id: t.id,
                                        }),
                                      });
                                      await loadAll(selectedOpId);
                                    }}
                                    className="text-ink-mute hover:text-scan"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

          </>
        )}
      </main>

      {/* ---------- Modal: Yeni Operasyon Aç ---------- */}
      <Sheet
        open={newOpOpen}
        onClose={() => setNewOpOpen(false)}
        title="Yeni Sayım Operasyonu Aç"
        footer={
          <Button size="xl" className="w-full" onClick={createOperation} disabled={!opName.trim()}>
            Operasyonu ve Özel QR Kodu Oluştur
          </Button>
        }
      >
        <form onSubmit={createOperation} className="space-y-4">
          <Field label="Operasyon / Proje Adı" required>
            <Input
              value={opName}
              onChange={(e) => setOpName(e.target.value)}
              placeholder="Örn. X Firması - Ekim 2026 Sayımı"
            />
          </Field>
          <Field label="Müşteri Firma İsmi">
            <Input
              value={opClient}
              onChange={(e) => setOpClient(e.target.value)}
              placeholder="Örn. X Holding A.Ş."
            />
          </Field>
          <Field label="Sayım Modu (Esnek Yapı)">
            <select
              value={opMode}
              onChange={(e) => setOpMode(e.target.value as OperationMode)}
              className="h-12 w-full rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink"
            >
              <option value="blank">Sıfırdan Boş Listeye Sayım</option>
              <option value="compare">Eski Liste Karşılaştırmalı (Fire Bulma Modu)</option>
            </select>
          </Field>
          <Field
            label="Lokasyonlar (Oda / Bölge)"
            hint="Her satıra bir oda yazın. Saha personeli listeden seçer; listede olmayan odayı kendisi de ekleyebilir. Boş bırakılabilir."
          >
            <textarea
              value={opLocations}
              onChange={(e) => setOpLocations(e.target.value)}
              rows={4}
              placeholder={"3340\nKaplan Toplantı Odası\nMutfak"}
              className="w-full rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-ink outline-none focus:border-brand"
            />
          </Field>
          <Field label="Notlar">
            <Input
              value={opNotes}
              onChange={(e) => setOpNotes(e.target.value)}
              placeholder="İsteğe bağlı operasyon notu"
            />
          </Field>
        </form>
      </Sheet>

      {/* ---------- Modal: Operasyon Lokasyonları ---------- */}
      <Sheet
        open={locEditOpen}
        onClose={() => setLocEditOpen(false)}
        title={`Lokasyonlar — ${currentOp?.code ?? ""}`}
        footer={
          <Button size="xl" className="w-full" loading={opBusy} onClick={() => void saveOperationLocations()}>
            Lokasyonları Kaydet
          </Button>
        }
      >
        <Field
          label="Oda / Bölge Listesi"
          hint="Her satıra bir oda yazın. Saha personeli sayıma başlarken bu listeden seçer; listede olmayan odayı kendisi de ekleyebilir."
        >
          <textarea
            value={locEditValue}
            onChange={(e) => setLocEditValue(e.target.value)}
            rows={10}
            placeholder={"3340\nKaplan Toplantı Odası\nMutfak"}
            className="w-full rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-ink outline-none focus:border-brand"
          />
        </Field>
      </Sheet>

      {/* ---------- Modal: PC'den Ürün Ekle / Düzenle ---------- */}
      <ItemSheet
        open={pcEditOpen}
        onClose={() => {
          setPcEditOpen(false);
          setEditingItem(null);
        }}
        barcode={editingItem?.barcode ?? pcBarcode}
        operationId={selectedOpId}
        location={editingItem?.location ?? pcLocation}
        categories={categories}
        productTypes={productTypes}
        existing={editingItem}
        prefill={null}
        existingPhotoUrl={
          editingItem?.photo_path ? `/api/drive/photo/${editingItem.photo_path}` : null
        }
        onSubmit={handlePcSaveItem}
      />

      {/* ---------- Modal: Eski Liste Yükle ---------- */}
      <Sheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Eski Envanter Listesi Yükle (Fire Karşılaştırması)"
        footer={
          <Button size="xl" className="w-full" onClick={handleImportExpected}>
            Listeyi Kaydet ve Fireleri Hesapla
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-ink-dim">
            Her satıra <code>Barkod;Ürün Cinsi;Ürün Adı;Lokasyon;Zimmet</code> formatında yapıştırın (Excel&apos;den kopyalayıp doğrudan yapıştırabilirsiniz):
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-line-strong bg-surface-2 p-3 font-mono text-xs text-ink outline-none focus:border-brand"
            placeholder="869897310865;Teknolojik Alet;Bilgisayar;3340;Ahmet YILMAZ"
          />
        </div>
      </Sheet>

      {/* ---------- Modal: Fotoğraf Büyütme (Lightbox) ---------- */}
      <Sheet
        open={Boolean(lightboxItem)}
        onClose={() => setLightboxItem(null)}
        title={
          lightboxItem
            ? `${lightboxItem.barcode} — ${lightboxItem.description}`
            : "Ürün Fotoğrafı"
        }
      >
        {lightboxItem?.photo_path && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/drive/photo/${lightboxItem.photo_path}`}
              alt={lightboxItem.description}
              className="max-h-[65dvh] w-full rounded-2xl object-contain bg-black"
            />
            <div className="flex items-center justify-between text-xs text-ink-dim">
              <span>Lokasyon: {lightboxItem.location}</span>
              <span className="font-mono">Dosya ID: {lightboxItem.barcode}.webp</span>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
