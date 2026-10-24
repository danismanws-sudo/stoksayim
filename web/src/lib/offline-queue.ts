"use client";

/**
 * Offline-öncelikli Google Drive kayıt kuyruğu.
 * Her sayım kaydı önce IndexedDB'ye yazılır, sonra Drive API'sine gönderilir.
 * İnternet yoksa kuyrukta bekler; bağlantı gelince otomatik gönderilir.
 * client_uuid sayesinde aynı kayıt iki kez gönderilse bile tekrar oluşmaz.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ItemDraft } from "./types";

export type QueueState = "pending" | "conflict" | "error";

export interface QueuedItem {
  client_uuid: string;
  draft: ItemDraft;
  photo: Blob | null;
  /** Mevcut bir kaydın güncellemesiyse kaydın id'si */
  update_id: string | null;
  /** Güncellemede eski fotoğraf korunacaksa */
  keep_photo_path: string | null;
  state: QueueState;
  error: string | null;
  created_at: number;
}

interface QueueDB extends DBSchema {
  queue: { key: string; value: QueuedItem; indexes: { by_op: string } };
}

let dbp: Promise<IDBPDatabase<QueueDB>> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB<QueueDB>("detay-sayim-drive", 1, {
      upgrade(d) {
        const s = d.createObjectStore("queue", { keyPath: "client_uuid" });
        s.createIndex("by_op", "draft.operation_id");
      },
    });
  }
  return dbp;
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const emit = () => listeners.forEach((l) => l());

export async function enqueue(item: Omit<QueuedItem, "state" | "error" | "created_at">) {
  await (await db()).put("queue", {
    ...item,
    state: "pending",
    error: null,
    created_at: Date.now(),
  });
  emit();
  await flush();
}

export async function listQueue(operationId: string) {
  return (await db()).getAllFromIndex("queue", "by_op", operationId);
}

export async function removeFromQueue(clientUuid: string) {
  await (await db()).delete("queue", clientUuid);
  emit();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getSavedIdentity(): { id: string; name: string; phone: string } {
  if (typeof window === "undefined") {
    return { id: "prof-saha-1", name: "Saha Personeli", phone: "" };
  }
  try {
    const raw = localStorage.getItem("detay:identity");
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; name?: string; phone?: string };
      return {
        id: parsed.id || "prof-saha-1",
        name: parsed.name || "Saha Personeli",
        phone: parsed.phone || "",
      };
    }
  } catch {
    /* yok say */
  }
  return { id: "prof-saha-1", name: "Saha Personeli", phone: "" };
}

let flushing = false;

/** Kuyruktaki bekleyen kayıtları sırayla Google Drive motoruna gönderir. */
export async function flush(): Promise<void> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  flushing = true;
  let changed = false;
  try {
    const d = await db();
    const all = (await d.getAll("queue"))
      .filter((q) => q.state !== "conflict")
      .sort((a, b) => a.created_at - b.created_at);

    if (all.length === 0) return;

    const identity = getSavedIdentity();

    for (const q of all) {
      try {
        const photoBase64 = q.photo ? await blobToBase64(q.photo) : null;
        const res = await fetch("/api/drive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_item",
            draft: q.draft,
            update_id: q.update_id,
            keep_photo_path: q.keep_photo_path,
            photo_base64: photoBase64,
            counted_by: identity.id,
            counted_by_name: identity.name,
          }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
          };
          if (res.status === 409 || errData.code === "23505") {
            await d.put("queue", {
              ...q,
              state: "conflict",
              error: "Bu barkod bu operasyonda başka biri tarafından zaten sayılmış.",
            });
            changed = true;
            continue;
          }
          throw new Error(errData.error ?? "Kayıt gönderilemedi");
        }

        await d.delete("queue", q.client_uuid);
        changed = true;
      } catch (e) {
        const msg = (e as Error)?.message ?? "Gönderilemedi";
        await d.put("queue", { ...q, state: "error", error: msg });
        changed = true;
        if (!navigator.onLine || msg.includes("fetch")) break;
      }
    }
  } finally {
    flushing = false;
    if (changed) emit();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => void flush());
  setInterval(() => void flush(), 20_000);
}
