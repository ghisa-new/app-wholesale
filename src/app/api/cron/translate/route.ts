import { NextResponse } from "next/server";
import { getProgress, runTranslationBatch } from "@/lib/translate";

// GET ?key=CRON_SECRET — start the full-catalog translation batch from a cron.
// No admin session needed; guarded by the shared secret.
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (getProgress().running) {
    return NextResponse.json({ ok: true, alreadyRunning: true });
  }
  runTranslationBatch().catch((e) => console.error("Cron translate failed:", e));
  return NextResponse.json({ ok: true, started: true });
}
