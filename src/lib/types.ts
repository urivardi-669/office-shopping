export type Category = { id: number; name: string };

export type ProductUnit = {
  unitCode: string;
  unitLabel: string;
  packageSize: number | null;
  packageSizeUnit: string | null;
  isDefault: number;
};

export type Product = {
  id: number;
  name: string;
  active: number;
  categoryId: number;
  categoryName: string;
  source?: "MANUAL" | "TIV_TAAM";
  brand?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  sourceUrl?: string | null;
  sourceProductId?: string | null;
  units?: ProductUnit[];
};

export type MyRequestItem = {
  id: number;
  quantity: number;
  createdAt: string;
  cycleId: number;
  productName: string;
  categoryName: string;
  cycleStatus: "OPEN" | "CLOSED";
  unitLabel?: string | null;
  imageUrlSnapshot?: string | null;
};

export type Suggestion = {
  id: number;
  productName: string;
  categoryName: string;
  categoryId?: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedQuantity: number;
  createdAt: string;
  suggestedBy?: string;
  rejectionReason?: string | null;
  source?: "MANUAL" | "TIV_TAAM";
  brand?: string | null;
  imageUrl?: string | null;
  sku?: string | null;
  unitLabel?: string | null;
};

export type OrderItem = {
  productId: number;
  productName: string;
  categoryName: string;
  demand: number;
  requesters: string[];
  finalQuantity: number;
  imageUrl?: string | null;
  unitLabel?: string | null;
};
