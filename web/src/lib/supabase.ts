"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * Tarayıcı Supabase istemcisi (tekil).
 * Güvenlik veritabanındaki RLS kurallarıyla sağlanır; bu anahtar herkese açık olabilir.
 */
export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase ayarları eksik (.env.local).");
  }
  if (!client) client = createBrowserClient(url!, key!);
  return client;
}

export const PHOTO_BUCKET = "item-photos";
