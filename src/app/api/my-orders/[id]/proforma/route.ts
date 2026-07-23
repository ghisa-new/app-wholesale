import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { buildOrderPdf } from "@/lib/order-pdf";

// GET — proforma PDF for the customer's OWN order only
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owner = queryOne<{ user_id: number }>(
    "SELECT user_id FROM orders WHERE order_id = ?",
    [Number(id)]
  );
  if (!owner || (owner.user_id !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  const lang = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "tr";
  const pdf = await buildOrderPdf(Number(id), "proforma", lang);
  if (!pdf) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ghisa-proforma-${id}-${lang}.pdf"`,
    },
  });
}
