/**
 * Parses Pixa-formatted product description HTML into structured data.
 * Ported from ghisa-shopify-theme/snippets/product-description-parser.liquid.
 */

export interface ParsedDescription {
  description: string | null;
  specs: Array<{ key: string; value: string }>;
}

export function parseProductDescription(
  html: string | undefined | null
): ParsedDescription {
  if (!html || !html.trim()) {
    return { description: null, specs: [] };
  }

  // Step 1: Normalize HTML
  let content = html
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "")
    .replace(/<br\s*\/?>/gi, "|||BR|||");

  // Step 2: Split into lines
  const lines = content.split("|||BR|||");

  // Step 3: Parse lines
  let description: string | null = null;
  const specs: Array<{ key: string; value: string }> = [];

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;

    // First non-empty line becomes description
    if (description === null) {
      description = clean.replace(/<[^>]*>/g, "").trim();
      continue;
    }

    // Process key-value pairs
    if (clean.includes(":")) {
      const text = clean.replace(/<[^>]*>/g, "");
      const colonIdx = text.indexOf(":");
      if (colonIdx > 0) {
        const key = text.substring(0, colonIdx).trim();
        const value = text.substring(colonIdx + 1).trim();
        if (key && value) {
          specs.push({ key, value });
        }
      }
    }
  }

  return { description, specs };
}
