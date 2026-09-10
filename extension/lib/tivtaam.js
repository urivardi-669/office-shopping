// Plain-JS port of the web app's src/lib/tivtaam/{client,normalize}.ts.
//
// This runs inside the extension popup, i.e. in the employee's own browser on
// their own network — the same request their browser would make visiting
// tivtaam.co.il directly. That's the whole point of this extension: Tiv Taam's
// bot-protection blocks Vercel's server IPs, but never blocks a real visitor's
// browser, and an extension page (unlike a normal webpage) isn't restricted by
// CORS for hosts listed in its manifest's host_permissions.

const TIVTAAM_BASE_URL = "https://www.tivtaam.co.il/v2";
const TIVTAAM_RETAILER_ID = "1062";
const TIVTAAM_BRANCH_ID = "924";
const TIVTAAM_APP_ID = "4";

const TIVTAAM_SEARCH_FILTERS = {
  must: {
    exists: ["family.id", "family.categoriesPaths.id", "branch.regularPrice"],
    term: { "branch.isActive": true, "branch.isVisible": true },
  },
  mustNot: {
    term: { "branch.regularPrice": 0, "branch.isOutOfStock": true },
  },
};

function tivtaamBuildImageUrl(templateUrl) {
  if (!templateUrl) return null;
  return templateUrl.replace("{{size}}", "medium").replace(/\{\{extension.*?\}\}/, "jpg");
}

function tivtaamHebrewName(names) {
  return (names && names["1"] && (names["1"].short || names["1"].long)) || null;
}

function tivtaamUnitsFor(raw) {
  if (raw.isWeighable) {
    return [{ unitCode: "KG", unitLabel: 'ק"ג', packageSize: null, packageSizeUnit: null, isDefault: true }];
  }
  return [
    {
      unitCode: "UNIT",
      unitLabel: "יח'",
      packageSize: raw.weight ?? null,
      packageSizeUnit: (raw.unitOfMeasure && raw.unitOfMeasure.defaultName) ?? null,
      isDefault: true,
    },
  ];
}

function tivtaamAvailabilityFor(raw) {
  if (!raw.branch) return "UNKNOWN";
  return raw.branch.isOutOfStock ? "OUT_OF_STOCK" : "IN_STOCK";
}

function normalizeTivTaamProduct(raw) {
  const sourceProductId = raw.productId ?? raw.id;
  const name = tivtaamHebrewName(raw.names) || raw.localName || null;
  if (!sourceProductId || !name) return null;

  const path = (raw.family && raw.family.categoriesPaths && raw.family.categoriesPaths[0]) || [];
  const sourceCategory = (path[0] && path[0].names && path[0].names["1"]) || (raw.department && raw.department.name) || null;
  const sourceSubcategory =
    (raw.department && raw.department.name) || (path[path.length - 1] && path[path.length - 1].names && path[path.length - 1].names["1"]) || null;

  return {
    sourceProductId: String(sourceProductId),
    sku: raw.localBarcode || raw.barcode || null,
    name,
    brand: (raw.brand && raw.brand.names && raw.brand.names["1"]) || null,
    imageUrl: tivtaamBuildImageUrl(raw.image && raw.image.url),
    sourceUrl: `https://www.tivtaam.co.il/?catalogProduct=${sourceProductId}`,
    sourceCategory,
    sourceSubcategory,
    sourceAvailability: tivtaamAvailabilityFor(raw),
    units: tivtaamUnitsFor(raw),
  };
}

/** Searches Tiv Taam directly from this browser and returns normalized products. */
async function searchTivTaam(query, size) {
  const params = new URLSearchParams({
    appId: TIVTAAM_APP_ID,
    filters: JSON.stringify(TIVTAAM_SEARCH_FILTERS),
    from: "0",
    isSearch: "true",
    languageId: "1",
    query,
    size: String(size || 12),
  });
  const url = `${TIVTAAM_BASE_URL}/retailers/${TIVTAAM_RETAILER_ID}/branches/${TIVTAAM_BRANCH_ID}/products/autocomplete?${params.toString()}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`תיאור טיב טעם החזיר שגיאה (${res.status})`);
  }
  const data = await res.json();
  const rawProducts = (data.suggestions && data.suggestions.suggestProducts && data.suggestions.suggestProducts.products) || [];
  return rawProducts.map(normalizeTivTaamProduct).filter(Boolean);
}
