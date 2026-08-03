import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getRegisterToken, setSetting, REGISTER_TOKEN_KEY, getTrRegisterToken, TR_REGISTER_TOKEN_KEY } from "@/lib/settings";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — current register token
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  return NextResponse.json({ registerToken: getRegisterToken(), trRegisterToken: getTrRegisterToken() });
}

// PUT { registerToken } — rotate the token
export async function PUT(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const body = (await request.json()) as { registerToken?: string; trRegisterToken?: string };
  if (body.registerToken !== undefined) {
    const t = body.registerToken.trim();
    if (t.length < 4) return NextResponse.json({ error: "Anahtar en az 4 karakter olmalı" }, { status: 400 });
    setSetting(REGISTER_TOKEN_KEY, t, user.email);
  }
  if (body.trRegisterToken !== undefined) {
    const t = body.trRegisterToken.trim();
    if (t.length < 4) return NextResponse.json({ error: "TR anahtarı en az 4 karakter olmalı" }, { status: 400 });
    setSetting(TR_REGISTER_TOKEN_KEY, t, user.email);
  }
  return NextResponse.json({ ok: true, registerToken: getRegisterToken(), trRegisterToken: getTrRegisterToken() });
}
