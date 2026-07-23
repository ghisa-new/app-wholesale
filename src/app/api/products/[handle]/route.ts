import { NextResponse } from "next/server";
import { getProductByHandle } from "@/lib/products";
import { translationFor, translateStrings } from "@/lib/translate";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  try {
    const product = await getProductByHandle(handle);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }
    const locale = new URL(request.url).searchParams.get("locale") || "tr";
    const tx = product ? translationFor(product.handle, locale) : null;
    const localized = product && tx
      ? { ...product, title: tx.title, descriptionHtml: tx.description_html || product.descriptionHtml }
      : product;

    // color names via the translation memory — short strings, translated once
    // ever, then served from SQLite
    let colorMap: Record<string, string> | null = null;
    if (product && (locale === "en" || locale === "ar")) {
      const colors = [
        ...new Set(
          product.variants
            .flatMap((v) => v.selectedOptions ?? [])
            .filter((o) => {
              const n = o.name.toLowerCase();
              return n === "color" || n === "renk";
            })
            .map((o) => o.value)
        ),
      ];
      if (colors.length) {
        try {
          const m = await translateStrings(colors, locale);
          colorMap = Object.fromEntries(m);
        } catch (e) {
          console.error("Color translate failed:", e);
        }
      }
    }
    return NextResponse.json({ product: localized, colorMap });
  } catch (error) {
    console.error("Product fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
