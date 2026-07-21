import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { queryOne } from "@/lib/db";
import { signToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  try {
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

    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      phone: user.phone,
      role: user.role,
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
      secure: process.env.NODE_ENV === "production",
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
