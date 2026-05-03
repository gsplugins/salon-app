import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Lightweight DB touch for Supabase free-tier pause prevention.
 * Uses anon `createClient()` first; falls back to service role if RLS blocks anon reads.
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
    const time = new Date().toISOString();
    const supabase = await createClient();
    const anonProbe = await supabase.from("shops").select("id").limit(1);
    if (!anonProbe.error) {
      return NextResponse.json({ ok: true, time, path: "anon" });
    }
    const shops = await supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).limit(1);
    if (shops.error) {
      return NextResponse.json({ ok: false, error: shops.error.message }, { status: 500 });
    }
    const plans = await supabaseAdmin.from("subscription_plans").select("id", { count: "exact", head: true }).limit(1);
    if (plans.error) {
      return NextResponse.json({ ok: false, error: plans.error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      time,
      path: "service_role_fallback",
      shops_probe: shops.count ?? 0,
      plans_probe: plans.count ?? 0,
      anon_error: anonProbe.error.message,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "keep-alive failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
