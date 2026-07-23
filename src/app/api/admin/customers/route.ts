import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { getUserFromRequest } from "@/lib/auth";
import { queryAll, queryOne, run } from "@/lib/db";
import { getCustomerStats } from "@/lib/nebim-stock";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — all customer accounts (credentials visible: Murathan hands them out).
// ?stats=CARI returns the NEBIM stats for one cari code instead.
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const statsFor = url.searchParams.get("stats");
    if (statsFor) {
      return NextResponse.json(await getCustomerStats(statsFor.trim()));
    }
    const customers = queryAll(
      `SELECT id, email, name, company, phone, role, curr_acc_code, password_plain, whatsapp, telegram, contact_email, created_at
       FROM users ORDER BY role = 'admin' DESC, company, name`
    );
    return NextResponse.json({ customers });
  } catch (err) {
    console.error("Admin customers error:", err);
    return NextResponse.json({ error: "Liste alınamadı" }, { status: 500 });
  }
}

// POST { email, password, name, company, phone, currAccCode } — create customer
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const b = (await request.json()) as Record<string, string>;
    const email = (b.email || "").trim().toLowerCase();
    const password = b.password || "";
    if (!email || password.length < 6 || !b.name) {
      return NextResponse.json(
        { error: "email, isim ve en az 6 karakter şifre gerekli" },
        { status: 400 }
      );
    }
    if (queryOne("SELECT id FROM users WHERE lower(email) = ?", [email])) {
      return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 409 });
    }
    const res = run(
      `INSERT INTO users (email, password_hash, password_plain, name, company, phone, role, curr_acc_code)
       VALUES (?, ?, ?, ?, ?, ?, 'customer', ?)`,
      [
        email,
        hashSync(password, 10),
        password,
        b.name.trim(),
        (b.company || "").trim(),
        (b.phone || "").trim(),
        (b.currAccCode || "").trim(),
      ]
    );
    return NextResponse.json({ ok: true, id: Number(res.lastInsertRowid) });
  } catch (err) {
    console.error("Admin customer create error:", err);
    return NextResponse.json({ error: "Oluşturulamadı" }, { status: 500 });
  }
}

// PATCH { id, ...fields } — update customer (password optional)
export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  try {
    const b = (await request.json()) as Record<string, string | number>;
    const id = Number(b.id);
    if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [col, key] of [
      ["name", "name"],
      ["company", "company"],
      ["phone", "phone"],
      ["curr_acc_code", "currAccCode"],
      ["whatsapp", "whatsapp"],
      ["telegram", "telegram"],
      ["contact_email", "contactEmail"],
    ] as const) {
      if (b[key] !== undefined) {
        sets.push(`${col} = ?`);
        params.push(String(b[key]).trim());
      }
    }
    if (b.password) {
      const pw = String(b.password);
      if (pw.length < 6) {
        return NextResponse.json({ error: "Şifre en az 6 karakter" }, { status: 400 });
      }
      sets.push("password_hash = ?", "password_plain = ?");
      params.push(hashSync(pw, 10), pw);
    }
    if (sets.length === 0) return NextResponse.json({ ok: true });
    params.push(id);
    run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin customer update error:", err);
    return NextResponse.json({ error: "Güncellenemedi" }, { status: 500 });
  }
}

// DELETE ?id= — remove a customer account (orders stay for history)
export async function DELETE(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
  const target = queryOne<{ role: string }>("SELECT role FROM users WHERE id = ?", [id]);
  if (target?.role === "admin") {
    return NextResponse.json({ error: "Admin hesabı silinemez" }, { status: 400 });
  }
  run("DELETE FROM users WHERE id = ?", [id]);
  return NextResponse.json({ ok: true });
}
