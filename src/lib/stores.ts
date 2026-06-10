import { shopifyFetch } from "./shopify";

export interface Store {
  handle: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  hours: string;
  lat: string | null;
  lng: string | null;
  mapUrl: string;
}

interface MetaobjectsResponse {
  metaobjects: {
    edges: Array<{
      node: {
        handle: string;
        fields: Array<{ key: string; value: string | null }>;
      };
    }>;
  };
}

// Stores are Shopify metaobjects of type "magaza" — the same source the retail
// theme's store locator uses. Field keys are Turkish (adi, adres, sehir, ...).
const STORES_QUERY = `
  query stores {
    metaobjects(type: "magaza", first: 100) {
      edges {
        node {
          handle
          fields { key value }
        }
      }
    }
  }
`;

// Strip Unicode directional formatting marks that sometimes wrap phone numbers.
function clean(value: string): string {
  return value.replace(/[‎‏‪-‮]/g, "").trim();
}

let cached: Store[] | null = null;
let cacheTs = 0;
const CACHE_TTL = 30 * 60 * 1000;

export async function getStores(): Promise<Store[]> {
  if (cached && Date.now() - cacheTs < CACHE_TTL) return cached;

  const data = await shopifyFetch<MetaobjectsResponse>(STORES_QUERY);

  const stores: Store[] = data.metaobjects.edges.map(({ node }) => {
    const f: Record<string, string> = {};
    for (const field of node.fields) {
      if (field.value != null) f[field.key] = field.value;
    }
    const name = clean(f.adi || node.handle);
    const address = clean(f.adres || "");
    const lat = f.kuzey_enlemi ? clean(f.kuzey_enlemi) : null;
    const lng = f.dogu_boylami ? clean(f.dogu_boylami) : null;
    const mapUrl =
      lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${name} ${address}`
          )}`;

    return {
      handle: node.handle,
      name,
      city: clean(f.sehir || ""),
      address,
      phone: clean(f.telefon_numarasi || ""),
      hours: clean(f.calisma_saatleri || ""),
      lat,
      lng,
      mapUrl,
    };
  });

  stores.sort(
    (a, b) =>
      a.city.localeCompare(b.city, "tr") || a.name.localeCompare(b.name, "tr")
  );

  cached = stores;
  cacheTs = Date.now();
  return stores;
}
