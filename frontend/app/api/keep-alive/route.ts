import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Lightweight DB touch for Supabase free-tier pause prevention.
 * Vercel Cron should call this route; set `CRON_SECRET` and the same value in the Vercel cron auth header.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const { error, count } = await supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).limit(1);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString(), shops_probe: count ?? 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "keep-alive failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
