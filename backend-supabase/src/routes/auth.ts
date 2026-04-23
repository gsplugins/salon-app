import type { Request, Response, Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase.js";
import { hashToken, issueRefreshToken, signAccessToken, verifyAccessToken } from "../lib/jwt.js";
import { normalizeMobile } from "../lib/mobile.js";
import { config } from "../config.js";
import type { DbUser } from "../db-types.js";
import { resolveManagementShop, shopMemberRole } from "../lib/shop-resolution.js";
import { formatPostgrestError, hintMissingPublicTables } from "../lib/db-errors.js";
import { okData } from "../lib/http.js";

function bearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim();
}

async function buildTokenBody(user: DbUser): Promise<Record<string, unknown>> {
  const access_token = signAccessToken({ sub: user.id, role: user.role });
  const refresh_token = issueRefreshToken();
  const refreshHash = hashToken(refresh_token);
  const expiresAt = new Date(Date.now() + config.jwtRefreshTtlSeconds * 1000).toISOString();

  const rt = await supabaseAdmin.from("refresh_tokens").insert({
    user_id: user.id,
    token_hash: refreshHash,
    expires_at: expiresAt
  });
  if (rt.error) {
    throw new Error(`refresh_tokens insert: ${formatPostgrestError(rt.error)}`);
  }

  return {
    access_token,
    token_type: "Bearer",
    expires_in: config.jwtAccessTtlSeconds,
    refresh_token
  };
}

/** Emit JSON tokens or a clear 500 if refresh_tokens / JWT step fails (user row may already exist). */
async function respondWithTokens(res: Response, status: number, user: DbUser): Promise<void> {
  try {
    const body = await buildTokenBody(user);
    res.status(status).json(body);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[auth] session/token build failed", e);
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({
      message: "Could not start a session (tokens).",
      detail: msg,
      hint: "Confirm table refresh_tokens exists and matches schema (run backend-supabase/supabase/schema.sql in Supabase SQL editor)."
    });
  }
}

export function mountAuthRoutes(router: Router): void {
  router.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        mobile: z.string().min(8).max(32),
        password: z.string().min(8),
        password_confirmation: z.string().min(8),
        name: z.string().max(255).optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ message: "Validation failed.", errors: parsed.error.flatten() });
      if (parsed.data.password !== parsed.data.password_confirmation) {
        return res.status(422).json({ message: "Validation failed.", errors: { password: ["Password confirmation does not match."] } });
      }

      const mobile = normalizeMobile(parsed.data.mobile);
      if (!mobile) return res.status(422).json({ message: "Invalid mobile number." });

      const existing = await supabaseAdmin.from("users").select("id").eq("mobile", mobile).maybeSingle();
      if (existing.error) {
        // eslint-disable-next-line no-console
        console.error("[auth/register] mobile lookup", existing.error);
        const hint = hintMissingPublicTables(existing.error);
        return res.status(500).json({
          message: "Could not verify mobile.",
          detail: formatPostgrestError(existing.error),
          ...(hint ? { hint } : {})
        });
      }
      if (existing.data) return res.status(422).json({ message: "This mobile number is already registered." });

      const displayName = (parsed.data.name?.trim() || "Guest").slice(0, 255);
      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const inserted = await supabaseAdmin
        .from("users")
        .insert({
          name: displayName,
          mobile,
          password_hash: passwordHash,
          role: "customer"
        })
        .select("*")
        .single();
      if (inserted.error || !inserted.data) {
        // eslint-disable-next-line no-console
        console.error("[auth/register] users insert", inserted.error);
        return res.status(500).json({
          message: "Could not create user.",
          detail: inserted.error ? formatPostgrestError(inserted.error) : undefined
        });
      }

      await respondWithTokens(res, 201, inserted.data as DbUser);
      return;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[auth/register] unexpected", e);
      return res.status(500).json({
        message: "Registration failed unexpectedly.",
        detail: e instanceof Error ? e.message : String(e)
      });
    }
  });

  router.post("/auth/register-barber", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        mobile: z.string().min(8).max(32),
        password: z.string().min(8),
        password_confirmation: z.string().min(8),
        name: z.string().max(255).optional(),
        shop_name: z.string().min(1).max(255),
        shop_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
        description: z.string().max(2000).nullable().optional()
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(422).json({ message: "Validation failed.", errors: parsed.error.flatten() });
      if (parsed.data.password !== parsed.data.password_confirmation) {
        return res.status(422).json({ message: "Validation failed.", errors: { password: ["Password confirmation does not match."] } });
      }
      const mobile = normalizeMobile(parsed.data.mobile);
      if (!mobile) return res.status(422).json({ message: "Invalid mobile number." });
      const existing = await supabaseAdmin.from("users").select("id").eq("mobile", mobile).maybeSingle();
      if (existing.error) {
        // eslint-disable-next-line no-console
        console.error("[auth/register-barber] mobile lookup", existing.error);
        const hint = hintMissingPublicTables(existing.error);
        return res.status(500).json({
          message: "Could not verify mobile.",
          detail: formatPostgrestError(existing.error),
          ...(hint ? { hint } : {})
        });
      }
      if (existing.data) return res.status(422).json({ message: "This mobile number is already registered." });
      const slugTaken = await supabaseAdmin.from("shops").select("id").eq("slug", parsed.data.shop_slug).maybeSingle();
      if (slugTaken.error) {
        // eslint-disable-next-line no-console
        console.error("[auth/register-barber] slug lookup", slugTaken.error);
        const hint = hintMissingPublicTables(slugTaken.error);
        return res.status(500).json({
          message: "Could not verify shop slug.",
          detail: formatPostgrestError(slugTaken.error),
          ...(hint ? { hint } : {})
        });
      }
      if (slugTaken.data) return res.status(422).json({ message: "Validation failed.", errors: { shop_slug: ["Slug already taken."] } });

      const ownerName = (parsed.data.name?.trim() || "Shop owner").slice(0, 255);
      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const userIns = await supabaseAdmin
        .from("users")
        .insert({
          name: ownerName,
          mobile,
          password_hash: passwordHash,
          role: "shop_owner"
        })
        .select("*")
        .single();
      if (userIns.error || !userIns.data) {
        // eslint-disable-next-line no-console
        console.error("[auth/register-barber] users insert", userIns.error);
        return res.status(500).json({
          message: "Could not create user.",
          detail: userIns.error ? formatPostgrestError(userIns.error) : undefined
        });
      }
      const user = userIns.data as DbUser;

      const shopIns = await supabaseAdmin
        .from("shops")
        .insert({
          owner_user_id: user.id,
          name: parsed.data.shop_name.trim(),
          slug: parsed.data.shop_slug,
          description: parsed.data.description ?? null,
          is_active: true,
          settings: {}
        })
        .select("id")
        .single();
      if (shopIns.error || !shopIns.data) {
        // eslint-disable-next-line no-console
        console.error("[auth/register-barber] shops insert", shopIns.error);
        return res.status(500).json({
          message: "Could not create shop.",
          detail: shopIns.error ? formatPostgrestError(shopIns.error) : undefined
        });
      }
      const shopId = (shopIns.data as { id: number }).id;

      const subIns = await supabaseAdmin.from("subscriptions").insert({
        shop_id: shopId,
        plan_key: "starter",
        status: "trialing",
        trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
        current_period_end: new Date(Date.now() + 14 * 86400_000).toISOString()
      });
      if (subIns.error) {
        // eslint-disable-next-line no-console
        console.error("[auth/register-barber] subscriptions insert", subIns.error);
        return res.status(500).json({
          message: "Could not create subscription.",
          detail: formatPostgrestError(subIns.error)
        });
      }

      const memIns = await supabaseAdmin.from("shop_members").insert({
        user_id: user.id,
        shop_id: shopId,
        role: "owner",
        is_active: true
      });
      if (memIns.error) {
        // eslint-disable-next-line no-console
        console.error("[auth/register-barber] shop_members insert", memIns.error);
        return res.status(500).json({
          message: "Could not link owner to shop.",
          detail: formatPostgrestError(memIns.error)
        });
      }

      await respondWithTokens(res, 201, user);
      return;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[auth/register-barber] unexpected", e);
      return res.status(500).json({
        message: "Registration failed unexpectedly.",
        detail: e instanceof Error ? e.message : String(e)
      });
    }
  });

  router.post("/auth/login", async (req: Request, res: Response) => {
    const schema = z.object({ mobile: z.string(), password: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: "Validation failed." });

    const mobile = normalizeMobile(String(parsed.data.mobile).trim());
    if (!mobile) {
      return res.status(422).json({ message: "Invalid mobile number." });
    }
    const password = String(parsed.data.password).trim();
    if (!password) {
      return res.status(422).json({ message: "Password is required." });
    }

    const userLookup = await supabaseAdmin.from("users").select("*").eq("mobile", mobile).maybeSingle();
    if (userLookup.error) {
      // eslint-disable-next-line no-console
      console.error("[auth/login] user lookup", userLookup.error);
      const hint = hintMissingPublicTables(userLookup.error);
      return res.status(500).json({
        message: "Could not look up user.",
        detail: formatPostgrestError(userLookup.error),
        ...(hint ? { hint } : {})
      });
    }
    const user = userLookup.data as DbUser | null;
    if (!user) return res.status(401).json({ message: "Invalid credentials." });
    if (user.is_locked) return res.status(403).json({ message: "Account is locked. Contact support." });

    const passOk = await bcrypt.compare(password, user.password_hash);
    if (!passOk) return res.status(401).json({ message: "Invalid credentials." });

    await respondWithTokens(res, 200, user);
    return;
  });

  router.post("/auth/refresh", async (req: Request, res: Response) => {
    const schema = z.object({ refresh_token: z.string().min(10) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: "Validation failed." });

    const tokenHash = hashToken(parsed.data.refresh_token);
    const tokenRow = await supabaseAdmin
      .from("refresh_tokens")
      .select("id,user_id,expires_at,revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!tokenRow.data || tokenRow.data.revoked_at) return res.status(401).json({ message: "Invalid refresh token." });
    if (new Date(tokenRow.data.expires_at).getTime() < Date.now()) return res.status(401).json({ message: "Refresh token expired." });

    const userRes = await supabaseAdmin.from("users").select("*").eq("id", tokenRow.data.user_id).maybeSingle();
    const user = userRes.data as DbUser | null;
    if (!user) return res.status(401).json({ message: "Invalid refresh token." });

    await supabaseAdmin.from("refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokenRow.data.id);
    await respondWithTokens(res, 200, user);
    return;
  });

  router.post("/auth/logout", async (req: Request, res: Response) => {
    const schema = z.object({ refresh_token: z.string().optional() });
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(422).json({ message: "Validation failed." });
    if (parsed.data.refresh_token) {
      const tokenHash = hashToken(parsed.data.refresh_token);
      await supabaseAdmin.from("refresh_tokens").update({ revoked_at: new Date().toISOString() }).eq("token_hash", tokenHash);
    }
    return res.json({ message: "Logged out." });
  });

  router.post("/auth/change-password", async (req: Request, res: Response) => {
    const token = bearer(req);
    if (!token) return res.status(401).json({ message: "Unauthenticated." });
    const schema = z.object({
      current_password: z.string(),
      password: z.string().min(8),
      password_confirmation: z.string().min(8)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: "Validation failed." });
    if (parsed.data.password !== parsed.data.password_confirmation) {
      return res.status(422).json({ errors: { password: ["Password confirmation does not match."] } });
    }
    try {
      const payload = verifyAccessToken(token);
      const userRes = await supabaseAdmin.from("users").select("*").eq("id", payload.sub).maybeSingle();
      const user = userRes.data as DbUser | null;
      if (!user) return res.status(401).json({ message: "Unauthenticated." });
      const ok = await bcrypt.compare(parsed.data.current_password, user.password_hash);
      if (!ok) return res.status(422).json({ errors: { current_password: ["Current password is incorrect."] } });
      const hash = await bcrypt.hash(parsed.data.password, 10);
      await supabaseAdmin.from("users").update({ password_hash: hash }).eq("id", user.id);
      return res.json({ message: "Password updated." });
    } catch {
      return res.status(401).json({ message: "Unauthenticated." });
    }
  });

  router.post("/auth/forgot-password", async (req: Request, res: Response) => {
    const parsed = z.object({ mobile: z.string() }).safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: "Validation failed." });

    const mobile = normalizeMobile(parsed.data.mobile);
    const message = "If this mobile is registered, an OTP was sent.";
    if (!mobile) return res.json({ message });

    const userRes = await supabaseAdmin.from("users").select("id").eq("mobile", mobile).maybeSingle();
    if (!userRes.data) return res.json({ message });

    await supabaseAdmin.from("password_reset_otps").delete().eq("mobile", mobile);
    const otp = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const otpHash = await bcrypt.hash(otp, 10);
    await supabaseAdmin.from("password_reset_otps").insert({
      mobile,
      otp_hash: otpHash,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    // Keep this in logs for now (until SMS provider integration is wired).
    // eslint-disable-next-line no-console
    console.log(`[password-reset-otp] mobile=${mobile} otp=${otp}`);
    return res.json({ message });
  });

  router.post("/auth/reset-password", async (req: Request, res: Response) => {
    const parsed = z
      .object({
        mobile: z.string(),
        otp: z.string().length(6),
        password: z.string().min(8),
        password_confirmation: z.string().min(8)
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ message: "Validation failed." });
    if (parsed.data.password !== parsed.data.password_confirmation) {
      return res.status(422).json({ errors: { password: ["Password confirmation does not match."] } });
    }

    const mobile = normalizeMobile(parsed.data.mobile);
    if (!mobile) return res.status(422).json({ errors: { mobile: ["Invalid or expired OTP."] } });

    const userRes = await supabaseAdmin.from("users").select("id").eq("mobile", mobile).maybeSingle();
    if (!userRes.data) return res.status(422).json({ errors: { mobile: ["Invalid or expired OTP."] } });

    const otpRes = await supabaseAdmin
      .from("password_reset_otps")
      .select("id,otp_hash,expires_at")
      .eq("mobile", mobile)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otpRes.data) return res.status(422).json({ errors: { mobile: ["Invalid or expired OTP."] } });

    const otpRow = otpRes.data as { id: number; otp_hash: string; expires_at: string };
    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      await supabaseAdmin.from("password_reset_otps").delete().eq("mobile", mobile);
      return res.status(422).json({ errors: { mobile: ["Invalid or expired OTP."] } });
    }

    const ok = await bcrypt.compare(parsed.data.otp, otpRow.otp_hash);
    if (!ok) return res.status(422).json({ errors: { otp: ["Invalid OTP."] } });

    const hash = await bcrypt.hash(parsed.data.password, 10);
    await supabaseAdmin.from("users").update({ password_hash: hash }).eq("id", (userRes.data as { id: string }).id);
    await supabaseAdmin.from("password_reset_otps").delete().eq("mobile", mobile);

    return res.json({ message: "Password reset successful." });
  });

  router.get("/auth/me", async (req: Request, res: Response) => {
    const token = bearer(req);
    if (!token) return res.status(401).json({ message: "Unauthenticated." });

    try {
      const payload = verifyAccessToken(token);
      const userRes = await supabaseAdmin.from("users").select("*").eq("id", payload.sub).maybeSingle();
      const user = userRes.data as DbUser | null;
      if (!user) return res.status(401).json({ message: "Unauthenticated." });

      const shop = await resolveManagementShop(user.id, user.role, req.headers as Record<string, unknown>);
      let memberRole: "owner" | "manager" | "barber" | null = null;
      if (shop) memberRole = await shopMemberRole(user.id, shop.id);

      const owned = await supabaseAdmin.from("shops").select("id").eq("owner_user_id", user.id).limit(1).maybeSingle();
      const mgr = await supabaseAdmin
        .from("shop_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "manager")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      const isShopOwner = user.role === "shop_owner" || Boolean(owned.data) || memberRole === "owner";
      const isManager = Boolean(mgr.data) || memberRole === "manager";
      const isBarber = user.role === "barber" || memberRole === "barber";

      let accessRole: string | null = null;
      if (shop) {
        if (user.role === "super_admin") accessRole = "super_admin";
        else if (memberRole) accessRole = memberRole;
        else if (owned.data && (owned.data as { id: number }).id === shop.id) accessRole = "owner";
        else if (isBarber) accessRole = "barber";
      }

      let subscription: Record<string, unknown> | null = null;
      if (shop && !isBarber) {
        const sub = await supabaseAdmin.from("subscriptions").select("*").eq("shop_id", shop.id).maybeSingle();
        if (sub.data) {
          const s = sub.data as { status: string; plan_key: string; trial_ends_at: string | null; current_period_end: string | null };
          subscription = {
            status: s.status,
            plan_key: s.plan_key,
            trial_ends_at: s.trial_ends_at,
            current_period_end: s.current_period_end
          };
        }
      }

      return res.json({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        photo_url: user.photo_url ?? null,
        role: user.role,
        global_role: user.role === "super_admin" ? "super_admin" : "user",
        loyalty_points: user.loyalty_points ?? 0,
        is_super_admin: user.role === "super_admin",
        is_shop_owner: isShopOwner,
        is_manager: isManager,
        is_barber: isBarber,
        is_admin: user.role === "super_admin" || isShopOwner || isManager,
        shop_access: { shop_id: shop?.id ?? null, role: accessRole },
        shop: shop
          ? {
              id: shop.id,
              name: shop.name,
              slug: shop.slug,
              description: shop.description,
              is_active: shop.is_active
            }
          : null,
        subscription
      });
    } catch {
      return res.status(401).json({ message: "Unauthenticated." });
    }
  });

  router.patch("/auth/me", async (req: Request, res: Response) => {
    const token = bearer(req);
    if (!token) return res.status(401).json({ message: "Unauthenticated." });
    try {
      const payload = verifyAccessToken(token);
      const userRes = await supabaseAdmin.from("users").select("*").eq("id", payload.sub).maybeSingle();
      const user = userRes.data as DbUser | null;
      if (!user) return res.status(401).json({ message: "Unauthenticated." });
      const body = req.body as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim().length > 1) updates.name = body.name.trim();
      if ("photo_url" in body) updates.photo_url = body.photo_url == null || String(body.photo_url).trim() === "" ? null : String(body.photo_url);
      if (Object.keys(updates).length === 0) return res.status(422).json({ message: "Nothing to update." });
      const saved = await supabaseAdmin.from("users").update(updates).eq("id", user.id).select("id,name,mobile,photo_url,role").single();
      if (saved.error || !saved.data) return res.status(500).json({ message: "Could not update profile." });
      return okData(res, saved.data);
    } catch {
      return res.status(401).json({ message: "Unauthenticated." });
    }
  });
}
