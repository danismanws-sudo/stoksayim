export type UserRole = "patron" | "yonetici" | "saha";
export type OperationMode = "blank" | "compare";
export type OperationStatus = "draft" | "active" | "closed";
export type ItemCondition = "saglam" | "hurda" | "arizali";

export const CONDITION_LABEL: Record<ItemCondition, string> = {
  saglam: "Sağlam",
  hurda: "Hurda",
  arizali: "Arızalı",
};

export const STATUS_LABEL: Record<OperationStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  closed: "Kapalı",
};

export const MODE_LABEL: Record<OperationMode, string> = {
  blank: "Sıfırdan Boş Sayım",
  compare: "Eski Liste Karşılaştırmalı (Fire Modu)",
};

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
}

export interface Client {
  id: string;
  name: string;
}

export interface Operation {
  id: string;
  code: string;
  name: string;
  client_name?: string | null;
  mode: OperationMode;
  status: OperationStatus;
  count_date: string;
  client_id: string | null;
  notes: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

export interface OperationLink {
  id: string;
  operation_id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  use_count: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort: number;
  is_other: boolean;
}

export interface ProductType {
  id: string;
  category_id: string;
  name: string;
  sort: number;
}

export interface CountItem {
  id: string;
  client_uuid: string | null;
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
  photo_path: string | null;
  counted_by: string;
  counted_by_name?: string | null;
  category_name?: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string } | null;
  categories?: { name: string } | null;
}

export interface ExpectedItem {
  id: string;
  operation_id: string;
  barcode: string;
  category: string | null;
  description: string | null;
  model: string | null;
  color: string | null;
  dimensions: string | null;
  quantity: number | null;
  condition: string | null;
  assignee: string | null;
  location: string | null;
}

export interface CompareRow {
  operation_id: string;
  barcode: string;
  status: "bulunan" | "fire" | "fazla";
  expected_description: string | null;
  expected_location: string | null;
  counted_description: string | null;
  counted_location: string | null;
  count_item_id: string | null;
  counted_at: string | null;
}

/** Saha formunun girdisi (offline kuyrukta da bu şekilde saklanır). */
export interface ItemDraft {
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
}
