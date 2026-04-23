import type { Request, Response, Router } from "express";
import { z } from "zod";
import { verifyAccessToken } from "../lib/jwt.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail, okData } from "../lib/http.js";
import { bookingToRow } from "../presenters/booking.js";

async function authUser(req: Request): Promise<{ id: string; mobile: string } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const payload = verifyAccessToken(auth.slice("Bearer ".length).trim());
    const userRes = await supabaseAdmin.from("users").select("id,mobile").eq("id", payload.sub).maybeSingle();
    return (userRes.data as { id: string; mobile: string } | null) ?? null;
  } catch {
    return null;
  }
}

export function mountCustomerRoutes(router: Router): void {
  router.get("/me/appointments", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const rows = await supabaseAdmin
      .from("salon_bookings")
      .select("id")
      .or(`customer_user_id.eq.${user.id},customer_mobile.eq.${user.mobile}`)
      .order("starts_at", { ascending: false })
      .limit(300);
    const data = [];
    for (const row of (rows.data ?? []) as { id: number }[]) {
      const b = await bookingToRow(row.id);
      if (b) data.push(b);
    }
    return okData(res, data);
  });

  router.get("/me/loyalty", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const u = await supabaseAdmin.from("users").select("loyalty_points").eq("id", user.id).maybeSingle();
    const tx = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id,points,type,description,created_at")
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(100);
    return okData(res, {
      points: (u.data as { loyalty_points: number } | null)?.loyalty_points ?? 0,
      transactions: tx.data ?? []
    });
  });

  router.patch("/me/bookings/:bookingId", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const bookingId = Number(req.params.bookingId);
    const cur = await supabaseAdmin
      .from("salon_bookings")
      .select("id,salon_service_id,customer_user_id,customer_mobile")
      .eq("id", bookingId)
      .maybeSingle();
    const row = cur.data as
      | { id: number; salon_service_id: number; customer_user_id: string | null; customer_mobile: string }
      | null;
    if (!row) return fail(res, 404, "Not found.");
    const canEdit = row.customer_user_id === user.id || row.customer_mobile === user.mobile;
    if (!canEdit) return fail(res, 403, "Forbidden.");

    const schema = z
      .object({
        status: z.enum(["cancelled", "completed"]).optional(),
        starts_at: z.string().optional(),
        salon_staff_id: z.number().int().nullable().optional()
      })
      .refine((v) => v.status !== undefined || v.starts_at !== undefined, { message: "Nothing to update." });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const upd: Record<string, unknown> = {};
    if (parsed.data.status) upd.status = parsed.data.status;
    if (parsed.data.starts_at || parsed.data.salon_staff_id !== undefined) {
      const current = await supabaseAdmin
        .from("salon_bookings")
        .select("starts_at,salon_staff_id,salon_service_id")
        .eq("id", bookingId)
        .single();
      const c = current.data as { starts_at: string; salon_staff_id: number; salon_service_id: number };
      const starts = new Date(parsed.data.starts_at ?? c.starts_at);
      const svc = await supabaseAdmin.from("salon_services").select("duration_minutes").eq("id", c.salon_service_id).single();
      const duration = Math.max(1, (svc.data as { duration_minutes: number }).duration_minutes);
      upd.starts_at = starts.toISOString();
      upd.ends_at = new Date(starts.getTime() + duration * 60_000).toISOString();
      if (parsed.data.salon_staff_id !== undefined && parsed.data.salon_staff_id !== null) {
        upd.salon_staff_id = parsed.data.salon_staff_id;
      }
    }
    await supabaseAdmin.from("salon_bookings").update(upd).eq("id", bookingId);
    const out = await bookingToRow(bookingId);
    return okData(res, out);
  });
}
