import { NextResponse } from "next/server";
import { getProductByHandle } from "@/lib/products";
import { translationFor } from "@/lib/translate";

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
    return NextResponse.json({ product: localized });
  } catch (error) {
    console.error("Product fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}
