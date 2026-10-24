import { NextRequest, NextResponse } from "next/server";
import {
  computeCompareRows,
  mutateDB,
  pushToGoogleDriveWebhook,
  readDB,
  saveItemPhoto,
  syncAllOperationsToGoogleDrive,
  writeOperationExcelFile,
} from "@/lib/drive-store";
import {
  ensureOperationDriveFolders,
  isGoogleDriveConnected,
  uploadExpectedListToGoogleDrive,
} from "@/lib/google-drive-api";
import type { ExpectedItem, ItemCondition, OperationMode, OperationStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const opId = url.searchParams.get("opId");
  const db = await readDB();

  if (token) {
    const link = db.operation_links.find(
      (l) => l.token.toUpperCase() === token.trim().toUpperCase(),
    );
    if (!link) {
      return NextResponse.json({
        valid: false,
        reason: "Bağlantı bulunamadı. Lütfen QR kodu veya linki kontrol edin.",
      });
    }
    const op = db.operations.find((o) => o.id === link.operation_id);
    if (!op) {
      return NextResponse.json({ valid: false, reason: "Operasyon bulunamadı." });
    }
    const expired = link.expires_at ? new Date(link.expires_at) <= new Date() : false;
    const valid = !link.revoked_at && !expired && op.status === "active";
    const reason = link.revoked_at
      ? "Bu bağlantı yönetici tarafından iptal edildi."
      : expired
        ? "Bu bağlantının süresi doldu."
        : op.status !== "active"
          ? "Bu sayım operasyonu şu an aktif değil."
          : null;

    return NextResponse.json({
      operation_id: op.id,
      operation_code: op.code,
      operation_name: op.name,
      client_name: op.client_name ?? null,
      valid,
      reason,
    });
  }

  if (opId) {
    const op = db.operations.find((o) => o.id === opId);
    if (!op) {
      return NextResponse.json({ error: "Operasyon bulunamadı" }, { status: 404 });
    }
    const items = db.count_items
      .filter((i) => i.operation_id === opId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const expected = db.expected_items.filter((e) => e.operation_id === opId);
    const compare = op.mode === "compare" ? computeCompareRows(db, opId) : [];
    const links = db.operation_links.filter((l) => l.operation_id === opId);
    const members = db.operation_members.filter((m) => m.operation_id === opId);

    // Lokasyon önerileri
    const locMap = new Map<string, number>();
    for (const it of items) {
      locMap.set(it.location, (locMap.get(it.location) ?? 0) + 1);
    }
    const locations = Array.from(locMap.entries()).map(([location, item_count]) => ({
      location,
      item_count,
    }));

    return NextResponse.json({
      operation: op,
      categories: db.categories.sort((a, b) => a.sort - b.sort),
      product_types: db.product_types.sort((a, b) => a.sort - b.sort),
      items,
      expected,
      compare,
      links,
      members,
      locations,
      driveConfig: db.driveConfig,
    });
  }

  // Tam yönetim özeti
  return NextResponse.json({
    driveConfig: db.driveConfig,
    operations: db.operations.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    operation_links: db.operation_links,
    operation_members: db.operation_members,
    categories: db.categories.sort((a, b) => a.sort - b.sort),
    product_types: db.product_types.sort((a, b) => a.sort - b.sort),
    count_items: db.count_items.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    expected_items: db.expected_items,
  });
}

export async function POST(req: NextRequest) {
  try {
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.")
        ? "http"
        : "https");
    const baseUrl = `${proto}://${host}`;

    const body = await req.json();
    const action = body.action as string;

    if (action === "join_operation") {
      const token = String(body.token ?? "").trim();
      const fullName = String(body.full_name ?? "").trim();
      const phone = String(body.phone ?? "").replace(/\D/g, "");

      if (fullName.length < 3) {
        return NextResponse.json({ error: "Ad soyad giriniz" }, { status: 400 });
      }
      if (phone.length < 10) {
        return NextResponse.json({ error: "Geçerli bir telefon numarası giriniz" }, { status: 400 });
      }

      const res = await mutateDB((db) => {
        const link = db.operation_links.find(
          (l) => l.token.toUpperCase() === token.toUpperCase(),
        );
        if (!link) throw new Error("Bağlantı bulunamadı");
        if (link.revoked_at) throw new Error("Bu bağlantı iptal edilmiş");
        const op = db.operations.find((o) => o.id === link.operation_id);
        if (!op || op.status !== "active") throw new Error("Bu operasyon aktif değil");

        let profile = db.profiles.find((p) => p.phone === phone);
        if (!profile) {
          profile = {
            id: `prof-${ crypto.randomUUID().slice(0, 8) }`,
            full_name: fullName,
            phone,
            role: "saha",
          };
          db.profiles.push(profile);
        } else {
          profile.full_name = fullName;
        }

        const existingMember = db.operation_members.find(
          (m) => m.operation_id === op.id && m.profile_id === profile!.id,
        );
        if (!existingMember) {
          db.operation_members.push({
            operation_id: op.id,
            profile_id: profile.id,
            full_name: profile.full_name,
            phone,
            joined_at: new Date().toISOString(),
          });
        }
        link.use_count += 1;
        return { operation_id: op.id, profile };
      });

      return NextResponse.json(res);
    }

    if (action === "lookup_barcode") {
      const opId = String(body.operation_id ?? "");
      const barcode = String(body.barcode ?? "").trim();
      const db = await readDB();
      const hit = db.count_items.find(
        (c) => c.operation_id === opId && c.barcode === barcode,
      );
      const prefill = db.expected_items.find(
        (e) => e.operation_id === opId && e.barcode === barcode,
      ) ?? null;

      return NextResponse.json({
        duplicate: hit
          ? {
              id: hit.id,
              counted_by: hit.counted_by,
              counted_by_name: hit.counted_by_name ?? "Saha Personeli",
              location: hit.location,
              description: hit.description,
              created_at: hit.created_at,
            }
          : null,
        prefill,
      });
    }

    if (action === "save_item") {
      const draft = body.draft as {
        client_uuid: string;
        operation_id: string;
        barcode: string;
        description: string;
        location: string;
        category_id: string | null;
        product_type_id: string | null;
        model: string | null;
        color: string | null;
        dimensions: string | null;
        quantity: number;
        condition: ItemCondition | null;
        condition_note: string | null;
        assignee: string | null;
      };
      const updateId = (body.update_id as string | null) ?? null;
      const keepPhotoPath = (body.keep_photo_path as string | null) ?? null;
      const photoBase64 = (body.photo_base64 as string | null) ?? null;
      const countedBy = String(body.counted_by ?? "prof-saha-1");
      const countedByName = String(body.counted_by_name ?? "Saha Personeli");

      if (!draft.barcode?.trim() || !draft.description?.trim() || !draft.location?.trim()) {
        return NextResponse.json(
          { error: "Barkod, Ürün Açıklaması ve Lokasyon alanları zorunludur." },
          { status: 400 },
        );
      }

      const saved = await mutateDB(async (db) => {
        const op = db.operations.find((o) => o.id === draft.operation_id);
        if (!op) throw new Error("Operasyon bulunamadı");

        // Barkod eşsizlik kontrolü (TC kimlik kuralı)
        const dup = db.count_items.find(
          (i) =>
            i.operation_id === draft.operation_id &&
            i.barcode === draft.barcode.trim() &&
            i.id !== updateId &&
            i.client_uuid !== draft.client_uuid,
        );
        if (dup) {
          const err = new Error("Bu barkod bu operasyonda zaten kayıtlı.");
          (err as Error & { code?: string }).code = "23505";
          throw err;
        }

        let photoPath = keepPhotoPath;
        if (photoBase64) {
          const raw = photoBase64.replace(/^data:[^;]+;base64,/, "");
          const buf = Buffer.from(raw, "base64");
          photoPath = await saveItemPhoto(
            op.code,
            draft.barcode.trim(),
            buf,
            "webp",
            op.name,
            db.driveConfig.folderName || "DETAY STOK SAYIM",
          );
        }

        const cat = db.categories.find((c) => c.id === draft.category_id);
        const now = new Date().toISOString();

        let item = db.count_items.find(
          (i) => (updateId && i.id === updateId) || i.client_uuid === draft.client_uuid,
        );

        if (item) {
          Object.assign(item, {
            barcode: draft.barcode.trim(),
            description: draft.description.trim(),
            location: draft.location.trim(),
            category_id: draft.category_id,
            product_type_id: draft.product_type_id,
            category_name: cat?.name ?? item.category_name ?? null,
            model: draft.model,
            color: draft.color,
            dimensions: draft.dimensions,
            quantity: draft.quantity,
            condition: draft.condition,
            condition_note: draft.condition_note,
            assignee: draft.assignee,
            photo_path: photoPath,
            updated_at: now,
          });
        } else {
          item = {
            id: `item-${crypto.randomUUID().slice(0, 8)}`,
            client_uuid: draft.client_uuid,
            operation_id: draft.operation_id,
            barcode: draft.barcode.trim(),
            description: draft.description.trim(),
            location: draft.location.trim(),
            category_id: draft.category_id,
            product_type_id: draft.product_type_id,
            category_name: cat?.name ?? null,
            model: draft.model,
            color: draft.color,
            dimensions: draft.dimensions,
            quantity: draft.quantity || 1,
            condition: draft.condition,
            condition_note: draft.condition_note,
            assignee: draft.assignee,
            photo_path: photoPath,
            counted_by: countedBy,
            counted_by_name: countedByName,
            created_at: now,
            updated_at: now,
          };
          db.count_items.push(item);
        }

        await writeOperationExcelFile(db, op.id, baseUrl);
        await pushToGoogleDriveWebhook(db, "save_item", {
          operationCode: op.code,
          operationName: op.name,
          item,
          photoBase64,
        });

        return item;
      });

      return NextResponse.json({ item: saved });
    }

    if (action === "delete_item") {
      const id = String(body.id ?? "");
      await mutateDB(async (db) => {
        const idx = db.count_items.findIndex((i) => i.id === id);
        if (idx >= 0) {
          const opId = db.count_items[idx].operation_id;
          db.count_items.splice(idx, 1);
          await writeOperationExcelFile(db, opId);
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_operation") {
      const name = String(body.name ?? "").trim();
      const clientName = String(body.client_name ?? "").trim();
      const mode = (body.mode as OperationMode) || "blank";
      const notes = String(body.notes ?? "").trim() || null;

      if (!name) {
        return NextResponse.json({ error: "Operasyon adı zorunlu" }, { status: 400 });
      }

      const created = await mutateDB(async (db) => {
        const num = String(db.seq).padStart(4, "0");
        db.seq += 1;
        const year = new Date().getFullYear();
        const code = `OP-${year}-${num}`;
        const now = new Date().toISOString();
        const opId = `op-${crypto.randomUUID().slice(0, 8)}`;

        const op = {
          id: opId,
          code,
          name,
          client_name: clientName || null,
          mode,
          status: "active" as OperationStatus,
          count_date: now.slice(0, 10),
          client_id: null,
          notes,
          created_at: now,
        };
        db.operations.unshift(op);

        // Otomatik özel QR/Link oluştur
        const token = `${code.replace(/[^A-Z0-9]/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const link = {
          id: `link-${crypto.randomUUID().slice(0, 8)}`,
          operation_id: opId,
          token,
          label: "Varsayılan WhatsApp / QR Bağlantısı",
          expires_at: null,
          revoked_at: null,
          use_count: 0,
          created_at: now,
        };
        db.operation_links.push(link);

        if (await isGoogleDriveConnected()) {
          await ensureOperationDriveFolders(
            code,
            name,
            db.driveConfig.folderName || "DETAY STOK SAYIM",
          ).catch(() => {});
        }
        await writeOperationExcelFile(db, opId, baseUrl);
        return { op, link };
      });

      return NextResponse.json(created);
    }

    if (action === "update_operation_status") {
      const opId = String(body.operation_id ?? "");
      const status = body.status as OperationStatus;
      await mutateDB((db) => {
        const op = db.operations.find((o) => o.id === opId);
        if (op) op.status = status;
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_link") {
      const opId = String(body.operation_id ?? "");
      const label = String(body.label ?? "Ekip Bağlantısı").trim();
      const link = await mutateDB((db) => {
        const op = db.operations.find((o) => o.id === opId);
        if (!op) throw new Error("Operasyon bulunamadı");
        const token = `${op.code.replace(/[^A-Z0-9]/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
        const created = {
          id: `link-${crypto.randomUUID().slice(0, 8)}`,
          operation_id: opId,
          token,
          label,
          expires_at: null,
          revoked_at: null,
          use_count: 0,
          created_at: new Date().toISOString(),
        };
        db.operation_links.unshift(created);
        return created;
      });
      return NextResponse.json({ link });
    }

    if (action === "revoke_link") {
      const linkId = String(body.link_id ?? "");
      await mutateDB((db) => {
        const l = db.operation_links.find((x) => x.id === linkId);
        if (l) l.revoked_at = new Date().toISOString();
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "import_expected") {
      const opId = String(body.operation_id ?? "");
      const rows = (body.rows as Partial<ExpectedItem>[]) ?? [];
      const count = await mutateDB(async (db) => {
        const op = db.operations.find((o) => o.id === opId);
        if (!op) throw new Error("Operasyon bulunamadı");
        op.mode = "compare";
        db.expected_items = db.expected_items.filter((e) => e.operation_id !== opId);
        let added = 0;
        const seen = new Set<string>();
        for (const r of rows) {
          const bc = String(r.barcode ?? "").trim();
          if (!bc || seen.has(bc)) continue;
          seen.add(bc);
          db.expected_items.push({
            id: `exp-${crypto.randomUUID().slice(0, 8)}`,
            operation_id: opId,
            barcode: bc,
            category: r.category ?? null,
            description: r.description ?? null,
            model: r.model ?? null,
            color: r.color ?? null,
            dimensions: r.dimensions ?? null,
            quantity: Number(r.quantity) || 1,
            condition: r.condition ?? null,
            assignee: r.assignee ?? null,
            location: r.location ?? null,
          });
          added++;
        }
        await writeOperationExcelFile(db, opId, baseUrl);
        if (await isGoogleDriveConnected()) {
          const expRows = db.expected_items.filter((e) => e.operation_id === opId);
          await uploadExpectedListToGoogleDrive({
            opCode: op.code,
            opName: op.name,
            rows: expRows,
            rootFolderName: db.driveConfig.folderName || "DETAY STOK SAYIM",
          }).catch(() => {});
        }
        return added;
      });
      return NextResponse.json({ added: count });
    }

    if (action === "sync_drive_folders") {
      const db = await readDB();
      await syncAllOperationsToGoogleDrive(db, baseUrl);
      return NextResponse.json({ ok: true });
    }

    if (action === "add_category") {
      const name = String(body.name ?? "").trim();
      if (!name) return NextResponse.json({ error: "Kategori adı giriniz" }, { status: 400 });
      await mutateDB((db) => {
        db.categories.push({
          id: `cat-${crypto.randomUUID().slice(0, 8)}`,
          name,
          icon: "package",
          sort: db.categories.length + 1,
          is_other: false,
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "add_product_type") {
      const categoryId = String(body.category_id ?? "");
      const name = String(body.name ?? "").trim();
      if (!categoryId || !name) {
        return NextResponse.json({ error: "Kategori ve malzeme çeşidi adı zorunlu" }, { status: 400 });
      }
      await mutateDB((db) => {
        db.product_types.push({
          id: `pt-${crypto.randomUUID().slice(0, 8)}`,
          category_id: categoryId,
          name,
          sort: db.product_types.filter((p) => p.category_id === categoryId).length + 1,
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "delete_product_type") {
      const id = String(body.id ?? "");
      await mutateDB((db) => {
        db.product_types = db.product_types.filter((p) => p.id !== id);
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "save_drive_config") {
      const webhookUrl = String(body.webhookUrl ?? "").trim() || null;
      const folderName = String(body.folderName ?? "DETAY_STOK_SAYIM_DRIVE").trim();
      await mutateDB(async (db) => {
        db.driveConfig.webhookUrl = webhookUrl;
        db.driveConfig.folderName = folderName;
        db.driveConfig.mode = webhookUrl ? "apps_script" : "local_drive";
        db.driveConfig.lastSyncError = null;
        if (webhookUrl) {
          await pushToGoogleDriveWebhook(db, "ping", { message: "Detay Stok Sayım Google Drive bağlantısı aktif!" });
        }
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
  } catch (e) {
    const err = e as Error & { code?: string };
    return NextResponse.json(
      { error: err.message ?? "İşlem başarısız", code: err.code },
      { status: err.code === "23505" ? 409 : 500 },
    );
  }
}
