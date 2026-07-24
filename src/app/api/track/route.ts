import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { logActivity, type EventType } from "@/lib/activity";
import { rateLimit, clientIp, sweep } from "@/lib/rate-limit";

const ALLOWED: EventType[] = ["view_product", "add_to_cart", "view_cart"];

// POST { type, ref?, label?, meta? } — client-side activity beacon
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  sweep();
  if (!rateLimit(`track:${clientIp(request)}`, 240, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  try {
    const b = (await request.json()) as {
      type?: string;
      ref?: string;
      label?: string;
      meta?: string;
    };
    if (!b.type || !ALLOWED.includes(b.type as EventType)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    logActivity(
      user,
      b.type as EventType,
      (b.ref || "").slice(0, 120),
      (b.label || "").slice(0, 160),
      (b.meta || "").slice(0, 120)
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
