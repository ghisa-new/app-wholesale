import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { queryOne, run } from "@/lib/db";

// POST { token, password }
export async function POST(request: Request) {
  try {
    const { token, password } = (await request.json()) as {
      token?: string;
      password?: string;
    };
    if (!token || !password || password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalı" },
        { status: 400 }
      );
    }
    const row = queryOne<{ user_id: number }>(
      "SELECT user_id FROM reset_tokens WHERE token = ? AND expires_at > datetime('now')",
      [token]
    );
    if (!row) {
      return NextResponse.json(
        { error: "Bağlantı geçersiz veya süresi dolmuş" },
        { status: 400 }
      );
    }
    run("UPDATE users SET password_hash = ?, password_plain = ? WHERE id = ?", [
      hashSync(password, 10),
      password,
      row.user_id,
    ]);
    run("DELETE FROM reset_tokens WHERE user_id = ?", [row.user_id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: "İşlem başarısız" }, { status: 500 });
  }
}
