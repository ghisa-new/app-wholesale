import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { queryOne, run } from "@/lib/db";

const PLACEHOLDER = "@toptan.ghisa.com";

export function hasRealContact(u: {
  email: string;
  whatsapp: string;
  telegram: string;
  contact_email: string;
}): boolean {
  return Boolean(
    (u.email && !u.email.endsWith(PLACEHOLDER)) ||
      u.contact_email ||
      u.whatsapp ||
      u.telegram
  );
}

// GET — the logged-in customer's contact channels
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = queryOne<{
    email: string;
    whatsapp: string;
    telegram: string;
    contact_email: string;
  }>("SELECT email, whatsapp, telegram, contact_email FROM users WHERE id = ?", [user.id]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    whatsapp: row.whatsapp,
    telegram: row.telegram,
    email: row.email.endsWith(PLACEHOLDER) ? row.contact_email : row.email,
    hasContact: hasRealContact(row),
  });
}

// POST { whatsapp?, telegram?, email? } — update contact channels
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const b = (await request.json()) as Record<string, string>;
    run(
      "UPDATE users SET whatsapp = ?, telegram = ?, contact_email = ? WHERE id = ?",
      [
        (b.whatsapp || "").trim(),
        (b.telegram || "").trim(),
        (b.email || "").trim(),
        user.id,
      ]
    );
    const row = queryOne<{
      email: string;
      whatsapp: string;
      telegram: string;
      contact_email: string;
    }>("SELECT email, whatsapp, telegram, contact_email FROM users WHERE id = ?", [user.id])!;
    return NextResponse.json({ ok: true, hasContact: hasRealContact(row) });
  } catch (err) {
    console.error("Contact update error:", err);
    return NextResponse.json({ error: "Kaydedilemedi" }, { status: 500 });
  }
}
