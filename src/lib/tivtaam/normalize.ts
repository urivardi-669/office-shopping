import type { TivTaamAvailability, TivTaamProduct, TivTaamUnit } from "./types";

// Loosely typed: this mirrors the shape observed from Tiv Taam's own storefront API.
// We only read the handful of fields we need and tolerate anything else being absent.
type RawTivTaamProduct = {
  id?: number;
  productId?: number;
  names?: Record<string, { short?: string; long?: string }>;
  localName?: string;
  brand?: { names?: Record<string, string> };
  localBarcode?: string;
  barcode?: string;
  image?: { url?: string };
  isWeighable?: boolean;
  weight?: number;
  unitOfMeasure?: { defaultName?: string };
  department?: { name?: string };
  family?: {
    categoriesPaths?: { names?: Record<string, string> }[][];
  };
  branch?: { isOutOfStock?: boolean; isVisible?: boolean };
};

function buildImageUrl(templateUrl: string | undefined | null): string | null {
  if (!templateUrl) return null;
  return templateUrl.replace("{{size}}", "medium").replace(/\{\{extension.*?\}\}/, "jpg");
}

function hebrewName(names: Record<string, { short?: string; long?: string }> | undefined): string | null {
  return names?.["1"]?.short || names?.["1"]?.long || null;
}

function unitsFor(raw: RawTivTaamProduct): TivTaamUnit[] {
  if (raw.isWeighable) {
    return [
      {
        unitCode: "KG",
        unitLabel: 'ק"ג',
        packageSize: null,
        packageSizeUnit: null,
        isDefault: true,
      },
    ];
  }
  return [
    {
      unitCode: "UNIT",
      unitLabel: "יח'",
      packageSize: raw.weight ?? null,
      packageSizeUnit: raw.unitOfMeasure?.defaultName ?? null,
      isDefault: true,
    },
  ];
}

function availabilityFor(raw: RawTivTaamProduct): TivTaamAvailability {
  if (!raw.branch) return "UNKNOWN";
  if (raw.branch.isOutOfStock) return "OUT_OF_STOCK";
  return "IN_STOCK";
}

export function normalizeTivTaamProduct(raw: RawTivTaamProduct): TivTaamProduct | null {
  const sourceProductId = raw.productId ?? raw.id;
  const name = hebrewName(raw.names) || raw.localName || null;
  if (!sourceProductId || !name) return null;

  const path = raw.family?.categoriesPaths?.[0] || [];
  const sourceCategory = path[0]?.names?.["1"] || raw.department?.name || null;
  const sourceSubcategory = raw.department?.name || path[path.length - 1]?.names?.["1"] || null;

  return {
    sourceProductId: String(sourceProductId),
    sku: raw.localBarcode || raw.barcode || null,
    name,
    brand: raw.brand?.names?.["1"] || null,
    imageUrl: buildImageUrl(raw.image?.url),
    sourceUrl: `https://www.tivtaam.co.il/?catalogProduct=${sourceProductId}`,
    sourceCategory,
    sourceSubcategory,
    sourceAvailability: availabilityFor(raw),
    units: unitsFor(raw),
  };
}
