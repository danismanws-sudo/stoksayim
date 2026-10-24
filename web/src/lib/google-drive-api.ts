import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * DETAY STOK SAYIM — Resmi Google Drive REST API v3 Motoru
 *
 * Klasör Mimarisi (Google Drive):
 * 📁 DETAY STOK SAYIM
 *  ├── 📁 _Sistem
 *  │    └── 📄 db.json
 *  └── 📁 Operasyonlar
 *       └── 📁 {OP_KODU} - {OPERASYON_ADI}
 *            ├── 📊 {OP_KODU}_Duran_Varlik_Sayim_Datasi.xlsx
 *            ├── 📁 Fotograflar
 *            │    └── 🖼️ {BARKOD}.webp
 *            └── 📁 Beklenen_Liste
 *                 └── 📄 {OP_KODU}_Beklenen_Liste.json
 */

const TOKEN_CACHE_FILE = path.join(os.tmpdir(), "detay-drive-oauth.json");
const FOLDER_MIME = "application/vnd.google-apps.folder";

interface CachedOAuth {
  refreshToken?: string;
  rootFolderId?: string;
  connectedEmail?: string;
  updatedAt?: string;
}

let memoryAccessToken: { token: string; expiresAt: number } | null = null;
const folderIdCache = new Map<string, string>();
const fileIdCache = new Map<string, string>();

export async function readCachedOAuth(): Promise<CachedOAuth> {
  try {
    const raw = await fs.readFile(TOKEN_CACHE_FILE, "utf8");
    return JSON.parse(raw) as CachedOAuth;
  } catch {
    return {};
  }
}

export async function saveCachedOAuth(patch: Partial<CachedOAuth>): Promise<CachedOAuth> {
  const current = await readCachedOAuth();
  const next: CachedOAuth = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function getOAuthClientCredentials() {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
  return {
    clientId,
    clientSecret,
    hasClient: Boolean(clientId && clientSecret),
  };
}

export async function getRefreshToken(): Promise<string | null> {
  const envToken = (process.env.GOOGLE_REFRESH_TOKEN ?? "").trim();
  if (envToken) return envToken;
  const cached = await readCachedOAuth();
  return cached.refreshToken?.trim() || null;
}

export async function isGoogleDriveConnected(): Promise<boolean> {
  const { hasClient } = getOAuthClientCredentials();
  if (!hasClient) return false;
  const rt = await getRefreshToken();
  return Boolean(rt);
}

export function buildGoogleOAuthUrl(redirectUri: string): string {
  const { clientId } = getOAuthClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file email profile",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getOAuthClientCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth token alınamadı");
  }

  memoryAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3500) * 1000 - 60_000,
  };

  let email: string | undefined;
  try {
    const uRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (uRes.ok) {
      const u = (await uRes.json()) as { email?: string };
      email = u.email;
    }
  } catch {
    /* ignore */
  }

  if (data.refresh_token) {
    await saveCachedOAuth({
      refreshToken: data.refresh_token,
      connectedEmail: email,
    });
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? (await getRefreshToken()),
    email,
  };
}

export async function getAccessToken(): Promise<string | null> {
  if (memoryAccessToken && Date.now() < memoryAccessToken.expiresAt) {
    return memoryAccessToken.token;
  }
  const { clientId, clientSecret, hasClient } = getOAuthClientCredentials();
  if (!hasClient) return null;
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;

  memoryAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3500) * 1000 - 60_000,
  };
  return data.access_token;
}

function escapeDriveQuery(val: string): string {
  return val.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Belirtilen üst klasör içinde `name` adında bir klasör arar; yoksa oluşturur.
 */
export async function ensureDriveFolder(
  name: string,
  parentId?: string,
): Promise<string> {
  const cacheKey = `${parentId ?? "root"}::${name}`;
  const cached = folderIdCache.get(cacheKey);
  if (cached) return cached;

  const token = await getAccessToken();
  if (!token) throw new Error("Google Drive bağlantısı aktif değil");

  const qParts = [
    `mimeType = '${FOLDER_MIME}'`,
    `name = '${escapeDriveQuery(name)}'`,
    "trashed = false",
  ];
  if (parentId) {
    qParts.push(`'${escapeDriveQuery(parentId)}' in parents`);
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    qParts.join(" and "),
  )}&fields=files(id,name)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (searchRes.ok) {
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    if (searchData.files?.[0]?.id) {
      folderIdCache.set(cacheKey, searchData.files[0].id);
      return searchData.files[0].id;
    }
  }

  // Yoksa oluştur
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Drive klasörü oluşturulamadı (${name}): ${errText}`);
  }
  const created = (await createRes.json()) as { id: string };
  folderIdCache.set(cacheKey, created.id);
  return created.id;
}

/**
 * Ana klasör hiyerarşisini (`DETAY STOK SAYIM` -> `_Sistem` ve `Operasyonlar`) garanti eder.
 */
export async function ensureDriveRootStructure(rootFolderName = "DETAY STOK SAYIM") {
  const rootId = await ensureDriveFolder(rootFolderName);
  const [systemFolderId, operationsFolderId] = await Promise.all([
    ensureDriveFolder("_Sistem", rootId),
    ensureDriveFolder("Operasyonlar", rootId),
  ]);
  return { rootId, systemFolderId, operationsFolderId };
}

/**
 * Bir operasyon için tüm alt klasörleri (`{OP_KODU} - {OP_ADI}` -> `Fotograflar`, `Beklenen_Liste`) oluşturur.
 */
export async function ensureOperationDriveFolders(
  opCode: string,
  opName?: string,
  rootFolderName = "DETAY STOK SAYIM",
) {
  const { operationsFolderId } = await ensureDriveRootStructure(rootFolderName);
  // Önce aynı operasyon koduyla başlayan klasör var mı kontrol et
  const folderTitle = opName ? `${opCode} - ${opName}` : opCode;
  const opFolderId = await ensureOperationFolderByCode(
    operationsFolderId,
    opCode,
    folderTitle,
  );
  const [photosFolderId, expectedFolderId] = await Promise.all([
    ensureDriveFolder("Fotograflar", opFolderId),
    ensureDriveFolder("Beklenen_Liste", opFolderId),
  ]);
  return { opFolderId, photosFolderId, expectedFolderId };
}

async function ensureOperationFolderByCode(
  operationsFolderId: string,
  opCode: string,
  desiredTitle: string,
): Promise<string> {
  const cacheKey = `opfolder::${operationsFolderId}::${opCode}`;
  const cached = folderIdCache.get(cacheKey);
  if (cached) return cached;

  const token = await getAccessToken();
  if (!token) throw new Error("Google Drive bağlantısı aktif değil");

  const q = [
    `mimeType = '${FOLDER_MIME}'`,
    `'${escapeDriveQuery(operationsFolderId)}' in parents`,
    `name contains '${escapeDriveQuery(opCode)}'`,
    "trashed = false",
  ].join(" and ");

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.ok) {
    const data = (await res.json()) as { files?: { id: string }[] };
    if (data.files?.[0]?.id) {
      folderIdCache.set(cacheKey, data.files[0].id);
      return data.files[0].id;
    }
  }

  const createdId = await ensureDriveFolder(desiredTitle, operationsFolderId);
  folderIdCache.set(cacheKey, createdId);
  return createdId;
}

export async function findDriveFile(
  name: string,
  parentId: string,
): Promise<string | null> {
  const cacheKey = `${parentId}::${name}`;
  const cached = fileIdCache.get(cacheKey);
  if (cached) return cached;

  const token = await getAccessToken();
  if (!token) return null;

  const q = [
    `name = '${escapeDriveQuery(name)}'`,
    `'${escapeDriveQuery(parentId)}' in parents`,
    "trashed = false",
  ].join(" and ");

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: { id: string }[] };
  const id = data.files?.[0]?.id ?? null;
  if (id) fileIdCache.set(cacheKey, id);
  return id;
}

/**
 * Google Drive'da belirtilen klasöre dosya yükler (varsa üzerine yazar, yoksa oluşturur).
 */
export async function upsertDriveFile({
  name,
  parentId,
  mimeType,
  body,
}: {
  name: string;
  parentId: string;
  mimeType: string;
  body: Buffer | string;
}): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Google Drive bağlantısı aktif değil");

  const existingId = await findDriveFile(name, parentId);
  const contentBuffer = typeof body === "string" ? Buffer.from(body, "utf8") : body;

  if (existingId) {
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media&fields=id`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": mimeType,
        },
        body: new Uint8Array(contentBuffer),
      },
    );
    if (updateRes.ok) {
      return existingId;
    }
    // Silinmişse önbellekten temizle ve yeniden oluştur
    fileIdCache.delete(`${parentId}::${name}`);
  }

  const boundary = `detay_boundary_${Date.now()}`;
  const metadata = JSON.stringify({
    name,
    parents: [parentId],
    mimeType,
  });

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8",
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`, "utf8");
  const multipartBody = Buffer.concat([preamble, contentBuffer, epilogue]);

  const createRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(multipartBody),
    },
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Drive dosya yükleme hatası (${name}): ${errText}`);
  }
  const created = (await createRes.json()) as { id: string };
  fileIdCache.set(`${parentId}::${name}`, created.id);
  return created.id;
}

export async function downloadDriveFileBuffer(fileId: string): Promise<Buffer | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/**
 * `_Sistem/db.json` dosyasını Google Drive'dan okur.
 */
export async function readDBFromGoogleDrive(
  rootFolderName = "DETAY STOK SAYIM",
): Promise<string | null> {
  if (!(await isGoogleDriveConnected())) return null;
  const { systemFolderId } = await ensureDriveRootStructure(rootFolderName);
  const fileId = await findDriveFile("db.json", systemFolderId);
  if (!fileId) return null;
  const buf = await downloadDriveFileBuffer(fileId);
  return buf ? buf.toString("utf8") : null;
}

/**
 * `_Sistem/db.json` dosyasını Google Drive'a yazar.
 */
export async function writeDBToGoogleDrive(
  jsonText: string,
  rootFolderName = "DETAY STOK SAYIM",
): Promise<void> {
  if (!(await isGoogleDriveConnected())) return;
  const { systemFolderId } = await ensureDriveRootStructure(rootFolderName);
  await upsertDriveFile({
    name: "db.json",
    parentId: systemFolderId,
    mimeType: "application/json",
    body: jsonText,
  });
}

/**
 * Ürün fotoğrafını (`{BARKOD}.webp`) ilgili operasyonun `Fotograflar` klasörüne yükler.
 */
export async function uploadPhotoToGoogleDrive({
  opCode,
  opName,
  filename,
  bytes,
  rootFolderName = "DETAY STOK SAYIM",
}: {
  opCode: string;
  opName?: string;
  filename: string;
  bytes: Buffer;
  rootFolderName?: string;
}): Promise<string | null> {
  if (!(await isGoogleDriveConnected())) return null;
  const { photosFolderId } = await ensureOperationDriveFolders(
    opCode,
    opName,
    rootFolderName,
  );
  return upsertDriveFile({
    name: filename,
    parentId: photosFolderId,
    mimeType: "image/webp",
    body: bytes,
  });
}

/**
 * Ürün fotoğrafını Google Drive'dan indirir (Vercel'de soğuk başlangıçta bile fotoğrafların her zaman açılmasını sağlar).
 */
export async function downloadPhotoFromGoogleDrive({
  opCode,
  filename,
  rootFolderName = "DETAY STOK SAYIM",
}: {
  opCode: string;
  filename: string;
  rootFolderName?: string;
}): Promise<Buffer | null> {
  if (!(await isGoogleDriveConnected())) return null;
  const { photosFolderId } = await ensureOperationDriveFolders(
    opCode,
    undefined,
    rootFolderName,
  );
  const fileId = await findDriveFile(filename, photosFolderId);
  if (!fileId) return null;
  return downloadDriveFileBuffer(fileId);
}

/**
 * Operasyonun güncel Excel (`.xlsx`) dosyasını Google Drive'daki operasyon klasörüne yazar.
 */
export async function uploadExcelToGoogleDrive({
  opCode,
  opName,
  fileName,
  bytes,
  rootFolderName = "DETAY STOK SAYIM",
}: {
  opCode: string;
  opName?: string;
  fileName: string;
  bytes: Buffer;
  rootFolderName?: string;
}): Promise<string | null> {
  if (!(await isGoogleDriveConnected())) return null;
  const { opFolderId } = await ensureOperationDriveFolders(
    opCode,
    opName,
    rootFolderName,
  );
  return upsertDriveFile({
    name: fileName,
    parentId: opFolderId,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: bytes,
  });
}

/**
 * Beklenen demirbaş listesini (`Beklenen_Liste/{OP_KODU}_Beklenen_Liste.json`) Google Drive'a kaydeder.
 */
export async function uploadExpectedListToGoogleDrive({
  opCode,
  opName,
  rows,
  rootFolderName = "DETAY STOK SAYIM",
}: {
  opCode: string;
  opName?: string;
  rows: unknown;
  rootFolderName?: string;
}): Promise<string | null> {
  if (!(await isGoogleDriveConnected())) return null;
  const { expectedFolderId } = await ensureOperationDriveFolders(
    opCode,
    opName,
    rootFolderName,
  );
  return upsertDriveFile({
    name: `${opCode}_Beklenen_Liste.json`,
    parentId: expectedFolderId,
    mimeType: "application/json",
    body: JSON.stringify(rows, null, 2),
  });
}
