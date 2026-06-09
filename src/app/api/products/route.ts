import { NextResponse } from "next/server";
import { getWholesaleProducts, extractCategories } from "@/lib/products";

export async function GET() {
  try {
    const products = await getWholesaleProducts();
    const categories = extractCategories(products);
    return NextResponse.json({ products, categories });
  } catch (error) {
    console.error("Products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products", products: [], categories: [] },
      { status: 500 }
    );
  }
}
