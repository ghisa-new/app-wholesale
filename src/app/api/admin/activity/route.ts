import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { recentActivity, customerSummaries } from "@/lib/activity";

// GET — activity feed + per-customer engagement summary
// ?user=<id> scopes the feed to one customer.
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const uid = new URL(request.url).searchParams.get("user");
  return NextResponse.json({
    feed: recentActivity(300, uid ? Number(uid) : undefined),
    summary: customerSummaries(30),
  });
}
