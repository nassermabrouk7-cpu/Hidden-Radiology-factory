import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidAdminSession } from "@/lib/admin-auth";



export async function GET(request: Request) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  if (!isValidAdminSession(request.headers.get("cookie"))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("خطأ في جلب الطلبات:", error);
      return NextResponse.json({ error: "فشل في جلب الطلبات" }, { status: 500 });
    }

    return NextResponse.json({ success: true, orders: orders || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("خطأ في API:", error);
    return NextResponse.json({ error: "خطأ في الخادم" }, { status: 500 });
  }
}
