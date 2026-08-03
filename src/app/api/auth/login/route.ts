import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { rateLimit, clientIp, sweep } from "@/lib/rate-limit";


export async function POST(request: Request) {
  try {
    sweep();
    const _ip = clientIp(request);
    if (!rateLimit(`login:${_ip}`, 20, 600000)) {
      return NextResponse.json({ error: "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin." }, { status: 429 });
    }
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve sifre gerekli" },
        { status: 400 }
      );
    }

    const user = queryOne<{
      id: number;
      email: string;
      password_hash: string;
      name: string;
      company: string;
      phone: string;
      role: string;
      tr_access_until: string | null;
    }>("SELECT * FROM users WHERE email = ? COLLATE NOCASE", [email]) ??
      // bare username = e-mail local part (murathan -> murathan@...)
      (!String(email).includes("@")
        ? queryOne<{
            id: number;
            email: string;
            password_hash: string;
            name: string;
            company: string;
            phone: string;
            role: string;
            tr_access_until: string | null;
          }>("SELECT * FROM users WHERE email LIKE ? || '@%' COLLATE NOCASE", [email])
        : undefined);

    if (!user) {
      return NextResponse.json(
        { error: "E-posta veya sifre hatali" },
        { status: 401 }
      );
    }

    const valid = await compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "E-posta veya sifre hatali" },
        { status: 401 }
      );
    }

    logActivity({ id: user.id, role: user.role }, "login");

    const trMs = user.tr_access_until ? Date.parse(user.tr_access_until) : NaN;
    const trUntil = !isNaN(trMs) && trMs > Date.now() ? trMs : undefined;
    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
      role: user.role,
      trUntil,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        company: user.company,
        phone: user.phone,
        role: user.role,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      // INSECURE_HTTP=1: serving on a bare IP over http (pre-domain phase) —
      // Secure cookies would be dropped by the browser and login would loop
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_HTTP !== "1",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Giris hatasi" },
      { status: 500 }
    );
  }
}
