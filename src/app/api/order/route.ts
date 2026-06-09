import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { sendOrderEmail } from "@/lib/email";
import { CartItem } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { items, notes } = (await request.json()) as {
      items: CartItem[];
      notes: string;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    await sendOrderEmail(
      {
        name: user.name,
        company: user.company,
        email: user.email,
        phone: user.phone,
      },
      items,
      notes || ""
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order error:", error);
    return NextResponse.json(
      { error: "Failed to send order" },
      { status: 500 }
    );
  }
}
