import { NextResponse } from "next/server";
import { getWholesaleProducts } from "@/lib/products";
import { baseSkuOf, seasonOfModel } from "@/lib/discounts";
import { translationMap } from "@/lib/translate";
import { extractCategories } from "@/lib/categories";

export async function GET(request: Request) {
  try {
    const locale = new URL(request.url).searchParams.get("locale") || "tr";
    const tx = translationMap(locale);
    const products = await getWholesaleProducts();
    const categories = extractCategories(products);
    const withSeason = products.map((p) => ({
      ...p,
      title: tx.get(p.handle)?.title ?? p.title,
      season: seasonOfModel(baseSkuOf(p)),
    }));
    return NextResponse.json({ products: withSeason, categories });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", products: [], categories: [] },
      { status: 500 }
    );
  }
}
