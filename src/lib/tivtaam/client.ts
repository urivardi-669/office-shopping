import { TivTaamUnavailableError } from "./types";

// Tiv Taam publishes real product pages at https://www.tivtaam.co.il/?catalogProduct=<id>
// (see /sitemaps/*.xml) and its own storefront calls this unauthenticated JSON API for
// product search-as-you-type and product lookup. robots.txt disallows crawling /search*
// (an HTML page route) but does not cover this API host path, and no auth/captcha is
// bypassed here — this is the same request the public site issues for every visitor.
const BASE_URL = "https://www.tivtaam.co.il/v2";
const RETAILER_ID = process.env.TIVTAAM_RETAILER_ID || "1062";
const BRANCH_ID = process.env.TIVTAAM_BRANCH_ID || "924";
const APP_ID = process.env.TIVTAAM_APP_ID || "4";
const REQUEST_TIMEOUT_MS = 6000;

const SEARCH_FILTERS = {
  must: {
    exists: ["family.id", "family.categoriesPaths.id", "branch.regularPrice"],
    term: { "branch.isActive": true, "branch.isVisible": true },
  },
  mustNot: {
    term: { "branch.regularPrice": 0, "branch.isOutOfStock": true },
  },
};

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new TivTaamUnavailableError();
    }
    return await res.json();
  } catch (err) {
    if (err instanceof TivTaamUnavailableError) throw err;
    throw new TivTaamUnavailableError();
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchAutocomplete(query: string, size = 12): Promise<unknown> {
  const params = new URLSearchParams({
    appId: APP_ID,
    filters: JSON.stringify(SEARCH_FILTERS),
    from: "0",
    isSearch: "true",
    languageId: "1",
    query,
    size: String(size),
  });
  const url = `${BASE_URL}/retailers/${RETAILER_ID}/branches/${BRANCH_ID}/products/autocomplete?${params.toString()}`;
  return fetchJson(url);
}

export async function getByCatalogProductId(catalogProductId: string): Promise<unknown> {
  const params = new URLSearchParams({
    appId: APP_ID,
    catalogProductId,
    ignoreBranchVisibility: "true",
  });
  const url = `${BASE_URL}/retailers/${RETAILER_ID}/branches/${BRANCH_ID}/products?${params.toString()}`;
  return fetchJson(url);
}
