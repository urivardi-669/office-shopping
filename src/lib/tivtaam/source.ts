import { getByCatalogProductId, searchAutocomplete } from "./client";
import { normalizeTivTaamProduct } from "./normalize";
import { TivTaamProduct, TivTaamUnavailableError } from "./types";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_QUERY_LENGTH = 100;

type CacheEntry = { expires: number; data: TivTaamProduct[] };

/**
 * Isolated integration boundary for Tiv Taam. All Tiv Taam-specific request/response
 * shapes live behind this class; the rest of the app only sees normalized TivTaamProduct
 * objects. Swapping the underlying mechanism (a different endpoint, a local mirror, etc.)
 * only requires changes here.
 */
class TivTaamProductSource {
  private searchCache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<TivTaamProduct[]>>();

  private sanitizeQuery(query: string): string {
    return query.trim().slice(0, MAX_QUERY_LENGTH);
  }

  async searchProducts(query: string): Promise<TivTaamProduct[]> {
    const q = this.sanitizeQuery(query);
    if (q.length < 2) return [];

    const cached = this.searchCache.get(q);
    if (cached && cached.expires > Date.now()) return cached.data;

    const existing = this.inFlight.get(q);
    if (existing) return existing;

    const promise = (async () => {
      try {
        const raw = (await searchAutocomplete(q)) as {
          suggestions?: { suggestProducts?: { products?: unknown[] } };
        };
        const rawProducts = raw.suggestions?.suggestProducts?.products || [];
        const normalized = rawProducts
          .map((p) => normalizeTivTaamProduct(p as Parameters<typeof normalizeTivTaamProduct>[0]))
          .filter((p): p is TivTaamProduct => p !== null);
        this.searchCache.set(q, { expires: Date.now() + SEARCH_CACHE_TTL_MS, data: normalized });
        return normalized;
      } finally {
        this.inFlight.delete(q);
      }
    })();

    this.inFlight.set(q, promise);
    return promise;
  }

  async getProduct(sourceProductId: string): Promise<TivTaamProduct | null> {
    const id = String(sourceProductId).trim();
    if (!/^\d+$/.test(id)) throw new TivTaamUnavailableError("מזהה מוצר לא תקין");

    const raw = (await getByCatalogProductId(id)) as { products?: unknown[] };
    const rawProduct = raw.products?.[0];
    if (!rawProduct) return null;
    return normalizeTivTaamProduct(rawProduct as Parameters<typeof normalizeTivTaamProduct>[0]);
  }
}

export const tivTaamProductSource = new TivTaamProductSource();
export { TivTaamUnavailableError };
export type { TivTaamProduct };
