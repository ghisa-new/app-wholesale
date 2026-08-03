import { NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { queryOne, run } from "@/lib/db";
import { getRegisterToken, getTrRegisterToken, TR_ACCESS_DAYS } from "@/lib/settings";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { rateLimit, clientIp, sweep } from "@/lib/rate-limit";
import { isTurkishIp, clientIpFromHeaders } from "@/lib/geo";


// POST {token} — gate check only; POST {token, email, password, ...} — register
export async function POST(request: Request) {
  try {
    sweep();
    const _ip = clientIp(request);
    if (!rateLimit(`register:${_ip}`, 8, 600000)) {
      return NextResponse.json({ error: "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin." }, { status: 429 });
    }
    const b = (await request.json()) as Record<string, string>;
    const token = (b.token || "").trim();
    const isTrToken = token !== "" && token === getTrRegisterToken();
    if (!token || (token !== getRegisterToken() && !isTrToken)) {
      return NextResponse.json({ error: "Kayıt anahtarı geçersiz" }, { status: 403 });
    }
    // From a Turkish IP, only the 3-day TR code may open an account — the normal
    // code is for the export audience. (Gate check + real signup both enforce it.)
    if (!isTrToken && isTurkishIp(clientIpFromHeaders(request.headers))) {
      return NextResponse.json(
        { error: "Türkiye'den kayıt için 3 günlük erişim kodu gereklidir." },
        { status: 403 }
      );
    }
    // the TR code grants a 3-day access window from Turkish IPs
    const trAccessUntil = isTrToken
      ? new Date(Date.now() + TR_ACCESS_DAYS * 86400000).toISOString()
      : ""; // column is NOT NULL; "" = no Turkish-IP access
    if (!b.email) return NextResponse.json({ ok: true, gate: true }); // gate check

    const email = b.email.trim().toLowerCase();
    const password = b.password || "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta girin" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Şifre en az 6 karakter olmalı" }, { status: 400 });
    }
    if (!b.name?.trim()) {
      return NextResponse.json({ error: "İsim gerekli" }, { status: 400 });
    }
    for (const [f, lbl] of [["country", "Ülke"], ["city", "Şehir"], ["address", "Adres"]] as const) {
      if (!b[f]?.trim()) {
        return NextResponse.json({ error: `${lbl} gerekli` }, { status: 400 });
      }
    }
    if (queryOne("SELECT id FROM users WHERE lower(email) = ?", [email])) {
      return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 409 });
    }
    const res = run(
      `INSERT INTO users (email, password_hash, password_plain, name, company, phone, whatsapp, telegram, country, city, address, tr_access_until, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer')`,
      [
        email,
        hashSync(password, 10),
        password,
        b.name.trim(),
        (b.company || "").trim(),
        (b.phone || "").trim(),
        (b.whatsapp || "").trim(),
        (b.telegram || "").trim(),
        b.country.trim(),
        b.city.trim(),
        b.address.trim(),
        trAccessUntil,
      ]
    );
    const id = Number(res.lastInsertRowid);
    const jwt = await signToken({
      id,
      email,
      name: b.name.trim(),
      company: (b.company || "").trim(),
      phone: (b.phone || "").trim(),
      role: "customer",
      trUntil: trAccessUntil ? Date.parse(trAccessUntil) : undefined,
    });
    const response = NextResponse.json({ ok: true, id });
    response.cookies.set(COOKIE_NAME, jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_HTTP !== "1",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Kayıt başarısız" }, { status: 500 });
  }
}
