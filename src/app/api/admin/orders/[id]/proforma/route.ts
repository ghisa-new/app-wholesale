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
  const pdf = await buildOrderPdf(Number(id), "proforma");
  if (!pdf) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ghisa-proforma-${id}.pdf"`,
    },
  });
}
