import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryOne, run } from "@/lib/db";
import { sendResetEmail } from "@/lib/email";
import { rateLimit, clientIp, sweep } from "@/lib/rate-limit";


// POST { email } — always answers 200 (no account enumeration); if the email
// exists, a 1-hour reset link is sent.
export async function POST(request: Request) {
  try {
    sweep();
    const _ip = clientIp(request);
    if (!rateLimit(`forgot:${_ip}`, 5, 900000)) {
      return NextResponse.json({ error: "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin." }, { status: 429 });
    }
    const { email } = (await request.json()) as { email?: string };
    const clean = (email || "").trim().toLowerCase();
    if (!clean) return NextResponse.json({ ok: true });

    const user = queryOne<{ id: number; name: string }>(
      "SELECT id, name FROM users WHERE lower(email) = ?",
      [clean]
    );
    if (user) {
      const token = crypto.randomBytes(24).toString("hex");
      run("DELETE FROM reset_tokens WHERE user_id = ?", [user.id]);
      run(
        "INSERT INTO reset_tokens (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 hour'))",
        [token, user.id]
      );
      const base = process.env.PUBLIC_URL || "https://wholesale.verioku.dev";
      await sendResetEmail(clean, user.name, `${base}/reset?token=${token}`);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ ok: true }); // never leak
  }
}
