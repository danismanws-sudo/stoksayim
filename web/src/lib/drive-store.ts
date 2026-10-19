import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import type {
  Category,
  CompareRow,
  CountItem,
  ExpectedItem,
  ItemCondition,
  Operation,
  OperationLink,
  OperationMode,
  OperationStatus,
  ProductType,
  Profile,
} from "./types";
import { CONDITION_LABEL } from "./types";
import { safePathPart } from "./utils";

/**
 * DETAY STOK SAYIM — Google Drive & Yerel Drive Senkron Veritabanı Motoru
 *
 * Nasıl çalışır?
 * 1. Tüm veriler `drive-data/` klasöründe gerçek Google Drive klasör hiyerarşisiyle tutulur:
 *    - `drive-data/db.json` -> Tüm operasyonlar, ürünler, beklenen listeler, QR linkler, kategoriler
 *    - `drive-data/Operasyonlar/{OP_KODU}/Fotograflar/{BARKOD}.webp` -> Barkod ID'li ürün fotoğrafları
 *    - `drive-data/Operasyonlar/{OP_KODU}/{OP_KODU}_Duran_Varlik_Sayim_Datasi.xlsx` -> Otomatik güncellenen Excel
 * 2. Eğer Google Drive Apps Script Webhook URL'si (`driveConfig.webhookUrl`) tanımlıysa
 *    veya Google Drive masaüstü klasörü seçiliyse, her kayıt ve fotoğraf anında buluttaki
 *    Google Drive'a ve Google E-Tablolar'a (Sheets) da senkronize edilir.
 */

export interface DriveConfig {
  mode: "local_drive" | "apps_script";
  webhookUrl: string | null;
  folderName: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

export interface OperationMemberRecord {
  operation_id: string;
  profile_id: string;
  full_name: string;
  phone: string;
  joined_at: string;
}

export interface DatabaseState {
  seq: number;
  driveConfig: DriveConfig;
  profiles: Profile[];
  operations: Operation[];
  operation_links: OperationLink[];
  operation_members: OperationMemberRecord[];
  categories: Category[];
  product_types: ProductType[];
  expected_items: ExpectedItem[];
  count_items: CountItem[];
}

const DATA_ROOT = process.env.DRIVE_LOCAL_DIR
  ? path.resolve(process.env.DRIVE_LOCAL_DIR)
  : path.join(process.cwd(), "drive-data");

const DB_FILE = path.join(DATA_ROOT, "db.json");

function defaultSeed(): DatabaseState {
  const now = new Date().toISOString();
  const catMobilya = "cat-mobilya";
  const catTeknoloji = "cat-teknoloji";
  const catBeyazEsya = "cat-beyazesya";
  const catOfis = "cat-ofis";
  const catOtomobil = "cat-otomobil";
  const catTekstil = "cat-tekstil";
  const catDiger = "cat-diger";

  const op1Id = "op-demo-0001";

  return {
    seq: 2,
    driveConfig: {
      mode: process.env.GOOGLE_DRIVE_WEBHOOK_URL ? "apps_script" : "local_drive",
      webhookUrl: process.env.GOOGLE_DRIVE_WEBHOOK_URL ?? null,
      folderName: "DETAY_STOK_SAYIM_DRIVE",
      lastSyncAt: now,
      lastSyncError: null,
    },
    profiles: [
      {
        id: "prof-patron",
        full_name: "Detay Stok Yönetici",
        phone: "05000000000",
        role: "patron",
      },
      {
        id: "prof-saha-1",
        full_name: "Sinan Aktaşöz",
        phone: "05321112233",
        role: "saha",
      },
    ],
    operations: [
      {
        id: op1Id,
        code: "OP-2026-0001",
        name: "Merkez Ofis Duran Varlık Sayımı",
        client_name: "Detay Kurumsal A.Ş.",
        mode: "compare",
        status: "active",
        count_date: now.slice(0, 10),
        client_id: null,
        notes: "Örnek operasyon — Excel şablonundaki verilerle hazır kurulu.",
        created_at: now,
      },
    ],
    operation_links: [
      {
        id: "link-demo-1",
        operation_id: op1Id,
        token: "MERKEZ2026",
        label: "WhatsApp Saha Grubu Linki",
        expires_at: null,
        revoked_at: null,
        use_count: 3,
        created_at: now,
      },
    ],
    operation_members: [
      {
        operation_id: op1Id,
        profile_id: "prof-saha-1",
        full_name: "Sinan Aktaşöz",
        phone: "05321112233",
        joined_at: now,
      },
    ],
    categories: [
      { id: catMobilya, name: "Mobilya", icon: "armchair", sort: 1, is_other: false },
      { id: catTeknoloji, name: "Teknolojik Alet", icon: "monitor", sort: 2, is_other: false },
      { id: catBeyazEsya, name: "Beyaz Eşya", icon: "refrigerator", sort: 3, is_other: false },
      { id: catOfis, name: "Ofis Malzemesi", icon: "package", sort: 4, is_other: false },
      { id: catOtomobil, name: "Otomobil", icon: "car", sort: 5, is_other: false },
      { id: catTekstil, name: "Tekstil", icon: "shirt", sort: 6, is_other: false },
      { id: catDiger, name: "DİĞER", icon: "circle-help", sort: 99, is_other: true },
    ],
    product_types: [
      { id: "pt-1", category_id: catMobilya, name: "Masa", sort: 1 },
      { id: "pt-2", category_id: catMobilya, name: "Sandalye", sort: 2 },
      { id: "pt-3", category_id: catMobilya, name: "Kanepe", sort: 3 },
      { id: "pt-4", category_id: catMobilya, name: "Keson", sort: 4 },
      { id: "pt-5", category_id: catMobilya, name: "Askılık", sort: 5 },
      { id: "pt-6", category_id: catMobilya, name: "Dolap", sort: 6 },
      { id: "pt-7", category_id: catMobilya, name: "Saat", sort: 7 },
      { id: "pt-8", category_id: catTeknoloji, name: "Bilgisayar", sort: 1 },
      { id: "pt-9", category_id: catTeknoloji, name: "Monitör", sort: 2 },
      { id: "pt-10", category_id: catTeknoloji, name: "Yazıcı", sort: 3 },
      { id: "pt-11", category_id: catTeknoloji, name: "Telefon", sort: 4 },
      { id: "pt-12", category_id: catTeknoloji, name: "Projeksiyon", sort: 5 },
      { id: "pt-13", category_id: catBeyazEsya, name: "Buzdolabı", sort: 1 },
      { id: "pt-14", category_id: catBeyazEsya, name: "Klima", sort: 2 },
      { id: "pt-15", category_id: catBeyazEsya, name: "Kahve Makinesi", sort: 3 },
      { id: "pt-16", category_id: catOfis, name: "Kesici / Evrak İmha", sort: 1 },
      { id: "pt-17", category_id: catOfis, name: "Beyaz Tahta", sort: 2 },
      { id: "pt-18", category_id: catOtomobil, name: "Binek Araç", sort: 1 },
      { id: "pt-19", category_id: catOtomobil, name: "Ticari Araç", sort: 2 },
      { id: "pt-20", category_id: catTekstil, name: "Bilgisayar Çantası", sort: 1 },
      { id: "pt-21", category_id: catTekstil, name: "Perde", sort: 2 },
      { id: "pt-22", category_id: catTekstil, name: "Halı", sort: 3 },
    ],
    expected_items: [
      {
        id: "exp-1",
        operation_id: op1Id,
        barcode: "869897310865",
        category: "Teknolojik Alet",
        description: "Bilgisayar",
        model: "Lenovo",
        color: "Siyah",
        dimensions: "-",
        quantity: 1,
        condition: "Sağlam",
        assignee: "Sinan Aktaşöz",
        location: "3340",
      },
      {
        id: "exp-2",
        operation_id: op1Id,
        barcode: "869873245699",
        category: "Mobilya",
        description: "Masa",
        model: "-",
        color: "Kahverengi",
        dimensions: "70-30 cm",
        quantity: 1,
        condition: "Sağlam",
        assignee: "Genel Ofis",
        location: "Kaplan Toplantı Odası",
      },
      {
        id: "exp-3",
        operation_id: op1Id,
        barcode: "8698976537252",
        category: "Beyaz Eşya",
        description: "Buzdolabı",
        model: "Arçelik",
        color: "Beyaz",
        dimensions: "100-120 cm",
        quantity: 1,
        condition: "Hurda Ayağı kırık",
        assignee: "Aydoğan Gençoğlu",
        location: "Mutfak",
      },
      {
        id: "exp-4",
        operation_id: op1Id,
        barcode: "869873245700",
        category: "Otomobil",
        description: "Opel",
        model: "Astra",
        color: "Siyah",
        dimensions: "-",
        quantity: 1,
        condition: "Sağlam",
        assignee: "Sinan Aktaşöz",
        location: "Otopark",
      },
      {
        id: "exp-5",
        operation_id: op1Id,
        barcode: "869897310900",
        category: "Tekstil",
        description: "Bilgisayar Çantası",
        model: "Sırt Çantası",
        color: "Siyah",
        dimensions: "-",
        quantity: 100,
        condition: "Sağlam",
        assignee: "Sinan Aktaşöz",
        location: "Depo 1",
      },
    ],
    count_items: [
      {
        id: "item-1",
        client_uuid: "seed-uuid-1",
        operation_id: op1Id,
        barcode: "869897310865",
        description: "Bilgisayar",
        location: "3340",
        category_id: catTeknoloji,
        product_type_id: "pt-8",
        model: "Lenovo",
        color: "Siyah",
        dimensions: "-",
        quantity: 1,
        condition: "saglam",
        condition_note: null,
        assignee: "Sinan Aktaşöz",
        photo_path: null,
        counted_by: "prof-saha-1",
        counted_by_name: "Sinan Aktaşöz",
        category_name: "Teknolojik Alet",
        created_at: now,
        updated_at: now,
      },
      {
        id: "item-2",
        client_uuid: "seed-uuid-2",
        operation_id: op1Id,
        barcode: "869873245699",
        description: "Masa",
        location: "Kaplan Toplantı Odası",
        category_id: catMobilya,
        product_type_id: "pt-1",
        model: "-",
        color: "Kahverengi",
        dimensions: "70-30 cm",
        quantity: 1,
        condition: "saglam",
        condition_note: null,
        assignee: "Genel Ofis",
        photo_path: null,
        counted_by: "prof-saha-1",
        counted_by_name: "Sinan Aktaşöz",
        category_name: "Mobilya",
        created_at: now,
        updated_at: now,
      },
      {
        id: "item-3",
        client_uuid: "seed-uuid-3",
        operation_id: op1Id,
        barcode: "8698976537252",
        description: "Buzdolabı",
        location: "Mutfak",
        category_id: catBeyazEsya,
        product_type_id: "pt-13",
        model: "Arçelik",
        color: "Beyaz",
        dimensions: "100-120 cm",
        quantity: 1,
        condition: "hurda",
        condition_note: "Ayağı kırık",
        assignee: "Aydoğan Gençoğlu",
        photo_path: null,
        counted_by: "prof-saha-1",
        counted_by_name: "Sinan Aktaşöz",
        category_name: "Beyaz Eşya",
        created_at: now,
        updated_at: now,
      },
    ],
  };
}

let writeQueue: Promise<unknown> = Promise.resolve();

async function ensureDirs() {
  await fs.mkdir(DATA_ROOT, { recursive: true });
}

export async function readDB(): Promise<DatabaseState> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    return JSON.parse(raw) as DatabaseState;
  } catch {
    const seed = defaultSeed();
    await fs.writeFile(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
    await writeOperationExcelFile(seed, seed.operations[0].id).catch(() => {});
    return seed;
  }
}

export async function mutateDB<T>(fn: (db: DatabaseState) => Promise<T> | T): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await readDB();
    const result = await fn(db);
    db.driveConfig.lastSyncAt = new Date().toISOString();
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
    return result;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export function getOperationDir(opCode: string) {
  return path.join(DATA_ROOT, "Operasyonlar", safePathPart(opCode));
}

export function getPhotosDir(opCode: string) {
  return path.join(getOperationDir(opCode), "Fotograflar");
}

/**
 * Fotoğrafı barkod numarası ID'si ile Drive klasörüne kaydeder.
 * Örn: drive-data/Operasyonlar/OP-2026-0001/Fotograflar/869897310865.webp
 */
export async function saveItemPhoto(opCode: string, barcode: string, bytes: Buffer, ext = "webp"): Promise<string> {
  const dir = getPhotosDir(opCode);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${safePathPart(barcode)}.${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, bytes);
  return `${safePathPart(opCode)}/${filename}`;
}

export function resolvePhotoFilePath(photoPath: string): string {
  const [opCode, filename] = photoPath.split("/");
  return path.join(getPhotosDir(opCode), safePathPart(filename ?? ""));
}

/**
 * Operasyonun Excel dosyasını (`Duran Varlık Sayım Datası.xlsx` şablonuyla birebir)
 * üretir ve Drive klasöründeki Excel dosyasını günceller.
 */
export async function buildOperationExcelBuffer(db: DatabaseState, operationId: string): Promise<Buffer> {
  const op = db.operations.find((o) => o.id === operationId);
  if (!op) throw new Error("Operasyon bulunamadı");

  const items = db.count_items
    .filter((i) => i.operation_id === operationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Detay Stok Sayım";
  wb.created = new Date();

  // 1) Ana Sayım Sayfası (Duran Varlık Sayım Datası.xlsx ile birebir + Lokasyon ve Sayan)
  const ws = wb.addWorksheet("Sayım Datası");
  ws.columns = [
    { header: "Sırası", key: "idx", width: 9 },
    { header: "Barkodu", key: "barcode", width: 20 },
    { header: "Ürün Cinsi", key: "category", width: 18 },
    { header: "Ürün Adı", key: "description", width: 24 },
    { header: "Moodeli", key: "model", width: 16 },
    { header: "Rengi", key: "color", width: 14 },
    { header: "Ölçüleri", key: "dimensions", width: 16 },
    { header: "Miktar", key: "quantity", width: 12 },
    { header: "Hurda -Sağlam Bilgiisi", key: "condition", width: 24 },
    { header: "Zimmet Durumu", key: "assignee", width: 22 },
    { header: "Resmi", key: "photo", width: 26 },
    { header: "Lokasyon (Oda/Bölge)", key: "location", width: 22 },
    { header: "Sayan Personel", key: "counter", width: 20 },
    { header: "Sayım Zamanı", key: "time", width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C3F95" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 24;

  items.forEach((it, idx) => {
    const condText = [
      it.condition ? CONDITION_LABEL[it.condition] : "",
      it.condition_note ?? "",
    ]
      .filter(Boolean)
      .join(" - ") || "-";

    ws.addRow({
      idx: idx + 1,
      barcode: it.barcode,
      category: it.category_name ?? "-",
      description: it.description,
      model: it.model || "-",
      color: it.color || "-",
      dimensions: it.dimensions || "-",
      quantity: it.quantity ?? 1,
      condition: condText,
      assignee: it.assignee || "-",
      photo: it.photo_path ? `Fotograflar/${it.photo_path.split("/")[1]}` : "Fotoğraf yok",
      location: it.location,
      counter: it.counted_by_name ?? "-",
      time: new Date(it.created_at).toLocaleString("tr-TR"),
    });
  });

  // 2) Eğer karşılaştırmalı (Fire) moddaysa Fire & Karşılaştırma sekmesi ekle
  if (op.mode === "compare") {
    const compareRows = computeCompareRows(db, operationId);
    const wsComp = wb.addWorksheet("Fire ve Karşılaştırma");
    wsComp.columns = [
      { header: "Durum", key: "status", width: 16 },
      { header: "Barkodu", key: "barcode", width: 20 },
      { header: "Beklenen Ürün", key: "exp_desc", width: 24 },
      { header: "Sayılan Ürün", key: "cnt_desc", width: 24 },
      { header: "Beklenen Lokasyon", key: "exp_loc", width: 20 },
      { header: "Sayılan Lokasyon", key: "cnt_loc", width: 20 },
    ];
    const h2 = wsComp.getRow(1);
    h2.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD10000" } };
    h2.height = 22;

    compareRows.forEach((r) => {
      wsComp.addRow({
        status: r.status === "bulunan" ? "BULUNDU" : r.status === "fire" ? "FİRE (EKSİK)" : "FAZLA (LİSTEDE YOK)",
        barcode: r.barcode,
        exp_desc: r.expected_description ?? "-",
        cnt_desc: r.counted_description ?? "-",
        exp_loc: r.expected_location ?? "-",
        cnt_loc: r.counted_location ?? "-",
      });
    });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function writeOperationExcelFile(db: DatabaseState, operationId: string): Promise<string | null> {
  const op = db.operations.find((o) => o.id === operationId);
  if (!op) return null;
  const dir = getOperationDir(op.code);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${safePathPart(op.code)}_Duran_Varlik_Sayim_Datasi.xlsx`);
  const buf = await buildOperationExcelBuffer(db, operationId);
  await fs.writeFile(filePath, buf);
  return filePath;
}

/**
 * Google Drive Apps Script Webhook senkronizasyonu (tanımlıysa arka planda gönderir).
 */
export async function pushToGoogleDriveWebhook(
  db: DatabaseState,
  event: string,
  payload: Record<string, unknown>,
) {
  const url = db.driveConfig.webhookUrl;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folderName: db.driveConfig.folderName,
        event,
        at: new Date().toISOString(),
        ...payload,
      }),
    });
  } catch (e) {
    db.driveConfig.lastSyncError = (e as Error)?.message ?? "Google Drive webhook bağlantı hatası";
  }
}

export function computeCompareRows(db: DatabaseState, operationId: string): CompareRow[] {
  const expected = db.expected_items.filter((e) => e.operation_id === operationId);
  const counted = db.count_items.filter((c) => c.operation_id === operationId);

  const expMap = new Map(expected.map((e) => [e.barcode, e]));
  const cntMap = new Map(counted.map((c) => [c.barcode, c]));
  const barcodes = new Set<string>([...expMap.keys(), ...cntMap.keys()]);

  const rows: CompareRow[] = [];
  for (const barcode of barcodes) {
    const e = expMap.get(barcode);
    const c = cntMap.get(barcode);
    const status: CompareRow["status"] = e && c ? "bulunan" : e && !c ? "fire" : "fazla";
    rows.push({
      operation_id: operationId,
      barcode,
      status,
      expected_description: e?.description ?? null,
      expected_location: e?.location ?? null,
      counted_description: c?.description ?? null,
      counted_location: c?.location ?? null,
      count_item_id: c?.id ?? null,
      counted_at: c?.created_at ?? null,
    });
  }
  return rows.sort((a, b) => {
    const order = { fire: 0, fazla: 1, bulunan: 2 };
    return order[a.status] - order[b.status] || a.barcode.localeCompare(b.barcode);
  });
}

export type {
  Category,
  CompareRow,
  CountItem,
  ExpectedItem,
  ItemCondition,
  Operation,
  OperationLink,
  OperationMode,
  OperationStatus,
  ProductType,
  Profile,
};
