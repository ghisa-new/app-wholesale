import { NextResponse } from "next/server";
import { getWholesaleProducts } from "@/lib/products";
import { extractCategories } from "@/lib/categories";

export async function GET() {
  try {
    const products = await getWholesaleProducts();
    const categories = extractCategories(products);
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Categories fetch error:", error);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
