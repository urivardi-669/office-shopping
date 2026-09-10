export type TivTaamUnit = {
  unitCode: string;
  unitLabel: string;
  packageSize: number | null;
  packageSizeUnit: string | null;
  isDefault: boolean;
};

export type TivTaamAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";

export type TivTaamProduct = {
  sourceProductId: string;
  sku: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  sourceUrl: string;
  sourceCategory: string | null;
  sourceSubcategory: string | null;
  sourceAvailability: TivTaamAvailability;
  units: TivTaamUnit[];
  /** Populated by the search API route only: the office product id, if this Tiv Taam item is already in our catalog. */
  officeProductId?: number | null;
};

export class TivTaamUnavailableError extends Error {
  constructor(message = "שירות טיב טעם אינו זמין כרגע") {
    super(message);
    this.name = "TivTaamUnavailableError";
  }
}
