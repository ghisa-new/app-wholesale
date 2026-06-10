import { NextResponse } from "next/server";
import { getStores } from "@/lib/stores";

export async function GET() {
  try {
    const stores = await getStores();
    return NextResponse.json({ stores });
  } catch (error) {
    console.error("Stores fetch error:", error);
    return NextResponse.json({ stores: [] }, { status: 500 });
  }
}
