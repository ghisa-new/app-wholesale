import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { buildOrderPdf } from "@/lib/order-pdf";

// GET — proforma invoice PDF for one order (admin)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const { id } = await params;
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "tr";
  const includeTry = url.searchParams.get("try") === "1";
  const pdf = await buildOrderPdf(Number(id), "proforma", lang, includeTry);
  if (!pdf) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ghisa-proforma-${id}-${lang}.pdf"`,
    },
  });
}
