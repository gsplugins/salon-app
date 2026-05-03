import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { supabaseAdmin } from "../lib/supabase";
import { resolveManagementShop, staffScopeIdForUser } from "../lib/shop-resolution";
import type { DbUser } from "../db-types";

function bearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim();
}

export function salonContextMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = bearer(req);
    if (!token) {
      res.status(401).json({ message: "Unauthenticated." });
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      const userRes = await supabaseAdmin
        .from("users")
        .select("id,name,mobile,photo_url,password_hash,role,is_locked,loyalty_points")
        .eq("id", payload.sub)
        .maybeSingle();
      const user = userRes.data as DbUser | null;
      if (!user) {
        res.status(401).json({ message: "Unauthenticated." });
        return;
      }
      if (user.is_locked) {
        res.status(403).json({ message: "Account is locked. Contact support." });
        return;
      }
      const shop = await resolveManagementShop(user.id, user.role, req.headers as Record<string, unknown>);
      if (!shop) {
        res.status(403).json({ message: "No shop." });
        return;
      }
      const staffScopeId = await staffScopeIdForUser(user.id, user.role, shop.id);
      req.salon = { user, shop, staffScopeId };
      next();
    } catch {
      res.status(401).json({ message: "Unauthenticated." });
    }
  };
}

