
export interface Sku {
  id: string;
  name: string;
  created_at: string;
}

export interface PartGroup {
  key: string;
  name_th: string;
  name_en: string;
  sort_order: number;
  z_index: number;
}

export interface Subcategory {
  id: string; // uuid
  sku_id: string;
  group_key: string;
  name: string;
  sort_order: number;
  image_url: string | null;
  created_at: string;
}

export interface Asset {
  id: string; // uuid
  sku_id: string;
  subcategory_id: string;
  group_key: string;
  label: string;
  url: string;
  sort: number;
  created_at: string;
}

// From the 'assets_with_subcategory' view
export interface ViewAsset {
  id: string; // This is the asset_id from the database
  sku_id: string;
  sku_name: string;
  subcategory_id: string;
  subcategory_name: string;
  group_key: string;
  group_name_th: string;
  group_name_en: string;
  z_index: number;
  label: string;
  url: string;
  sort: number; // This is the asset_sort from the database
  created_at: string;
}

export type WatermarkType = 'none' | 'text' | 'image';
export type WatermarkPosition = 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface ProfileSettings {
  storeName: string;
  watermarkType: WatermarkType;
  watermarkImageUrl: string;
  watermarkOpacity: number; // 0-100
  watermarkSize: number; // in pixels
  watermarkPosition: WatermarkPosition;
  showFilterButtons: boolean; // Show/hide filter buttons
}
