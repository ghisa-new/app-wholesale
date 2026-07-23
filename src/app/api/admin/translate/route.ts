import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getProgress, runTranslationBatch, translationStats } from "@/lib/translate";

async function requireAdmin(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET — progress + per-locale counts
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  return NextResponse.json({ progress: getProgress(), stats: translationStats() });
}

// POST — start the batch (fire and forget; poll GET for progress)
export async function POST(request: Request) {
  const user = await requireAdmin(request);
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  if (getProgress().running) {
    return NextResponse.json({ ok: true, alreadyRunning: true });
  }
  runTranslationBatch().catch((e) => console.error("Translation batch failed:", e));
  return NextResponse.json({ ok: true, started: true });
}
