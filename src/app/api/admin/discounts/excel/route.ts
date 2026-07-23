import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getUserFromRequest } from "@/lib/auth";
import { getDiscountOverrides, setDiscount, baseSkuOf } from "@/lib/discounts";
import { getEligibilityMap } from "@/lib/eligibility";
import { getWholesaleProducts } from "@/lib/products";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — download the catalog as Excel (handle, title, type, price, discount)
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const products = await getWholesaleProducts();
    const overrides = getDiscountOverrides();
    const elig = await getEligibilityMap();
    const rows = products.map((p) => {
      const sku = baseSkuOf(p);
      const e = elig?.get(sku.toUpperCase());
      return {
        sku,
        name: p.title,
        price: parseFloat(p.price.amount),
        temperature: e?.temp ?? "",
        lots: e?.lots ?? "",
        discount: overrides.get(p.handle) ?? p.campaignDiscount ?? 0,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 44 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "urunler");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ghisa-toptan-indirimler.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Excel export error:", err);
    return NextResponse.json({ error: "Excel oluşturulamadı" }, { status: 500 });
  }
}

// POST multipart file — apply the "discount" column back per handle
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli" }, { status: 400 });
    }
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    // sku (MODEL-COLOR) -> handle
    const products = await getWholesaleProducts();
    const byBaseSku = new Map<string, string>();
    for (const pr of products) {
      const bs = baseSkuOf(pr).trim().toUpperCase();
      if (bs) byBaseSku.set(bs, pr.handle);
    }

    let applied = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const sku = String(row.sku ?? row.SKU ?? row.Sku ?? "").trim().toUpperCase();
      const raw = row.discount ?? row.indirim ?? row.Discount;
      if (!sku || raw === undefined || raw === null || raw === "") continue;
      const handle = byBaseSku.get(sku);
      if (!handle) {
        errors.push(`${sku}: ürün bulunamadı`);
        continue;
      }
      const d = Number(raw);
      if (isNaN(d) || d < 0 || d > 100) {
        errors.push(`${sku}: geçersiz değer "${raw}"`);
        continue;
      }
      setDiscount(handle, d, `${user.email} (excel)`);
      applied++;
    }
    return NextResponse.json({ ok: true, applied, errors });
  } catch (err) {
    console.error("Excel import error:", err);
    return NextResponse.json({ error: "Excel okunamadı" }, { status: 500 });
  }
}
