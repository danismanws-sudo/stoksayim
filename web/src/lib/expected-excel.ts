import ExcelJS from "exceljs";

/**
 * Önceki sayımın uygulamadan indirilen Excel dosyasını (`Sayım Datası` sayfası)
 * beklenen envanter listesine çevirir. Sütunlar başlık adından tanınır, bu yüzden
 * sütun sırası değişse veya dosya elle düzenlenmiş olsa da çalışır.
 */

export interface ExpectedExcelRow {
  barcode: string;
  category: string | null;
  description: string | null;
  model: string | null;
  color: string | null;
  dimensions: string | null;
  quantity: number;
  condition: string | null;
  assignee: string | null;
  location: string | null;
}

type Field = keyof ExpectedExcelRow;

// Sıra önemli: "Zimmet Durumu" durum'dan önce zimmet olarak eşleşmeli
const HEADER_RULES: [RegExp, Field][] = [
  [/barkod/, "barcode"],
  [/zimmet/, "assignee"],
  [/cins|kategori/, "category"],
  [/ürün ad|urun ad|açıklama|aciklama/, "description"],
  [/mo+del/, "model"],
  [/renk|reng/, "color"],
  [/ölçü|olcu/, "dimensions"],
  [/miktar|adet/, "quantity"],
  [/hurda|sağlam|saglam|durum/, "condition"],
  [/lokasyon|oda|bölge|bolge/, "location"],
];

function cellText(cell: ExcelJS.Cell): string {
  return String(cell.text ?? "").trim();
}

function clean(v: string): string | null {
  return v && v !== "-" ? v : null;
}

export async function parseExpectedExcel(bytes: Buffer): Promise<ExpectedExcelRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs'in Buffer tipi Node'un güncel Buffer tipiyle uyuşmuyor
    await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new Error("Dosya okunamadı. Lütfen .xlsx uzantılı bir Excel dosyası seçin.");
  }
  const ws = wb.getWorksheet("Sayım Datası") ?? wb.worksheets[0];
  if (!ws) throw new Error("Excel dosyasında sayfa bulunamadı.");

  // Başlık satırı: ilk 10 satırda "Barkod" içeren satır
  let headerRow = 0;
  const columns = new Map<Field, number>();
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRow; r++) {
    const found = new Map<Field, number>();
    ws.getRow(r).eachCell((cell, col) => {
      const h = cellText(cell).toLocaleLowerCase("tr");
      const rule = HEADER_RULES.find(([re, field]) => re.test(h) && !found.has(field));
      if (rule) found.set(rule[1], col);
    });
    if (found.has("barcode")) {
      headerRow = r;
      found.forEach((col, field) => columns.set(field, col));
    }
  }
  if (!headerRow) {
    throw new Error('Excel dosyasında "Barkodu" sütunu bulunamadı.');
  }

  const rows: ExpectedExcelRow[] = [];
  const seen = new Set<string>();
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (f: Field) => (columns.has(f) ? cellText(row.getCell(columns.get(f)!)) : "");
    const barcode = get("barcode");
    if (!barcode || seen.has(barcode)) continue;
    seen.add(barcode);
    rows.push({
      barcode,
      category: clean(get("category")),
      description: clean(get("description")),
      model: clean(get("model")),
      color: clean(get("color")),
      dimensions: clean(get("dimensions")),
      quantity: Number(get("quantity").replace(",", ".")) || 1,
      condition: clean(get("condition")),
      assignee: clean(get("assignee")),
      location: clean(get("location")),
    });
  }
  return rows;
}
