/** A vehicle as the admin API returns it. */

export type Img = { id: string; url: string; isCover: boolean; sortOrder: number };

export type Row = Record<string, any> & { id: string; images: Img[]; event_type_ids: string[]; addon_ids: string[] };
