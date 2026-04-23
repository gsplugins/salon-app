import express, { Router, type NextFunction, type Request, type Response } from "express";
import "express-async-errors";
import cors from "cors";
import { mountAuthRoutes } from "./routes/auth.js";
import { mountPublicRoutes } from "./routes/public.js";
import { mountMyShopRoutes } from "./routes/my-shop.js";
import { mountCustomerRoutes } from "./routes/customer.js";
import { mountStaffRoutes } from "./routes/staff.js";
import { mountAdminSystemRoutes } from "./routes/admin-system.js";
import { salonContextMiddleware } from "./middleware/salon-context.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/test", (_req, res) => {
    res.json({ message: "Supabase API working" });
  });

  const api = express.Router();
  mountAuthRoutes(api);
  mountPublicRoutes(api);
  mountCustomerRoutes(api);

  const myShop = Router();
  myShop.use(salonContextMiddleware());
  mountMyShopRoutes(myShop);
  mountStaffRoutes(myShop);
  api.use(myShop);

  const adminSystem = Router();
  mountAdminSystemRoutes(adminSystem);
  api.use(adminSystem);

  app.use("/api", api);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found.", path: _req.originalUrl });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("[express]", req.method, req.originalUrl, err);
    const status = getHttpErrorStatus(err);
    const msg = err instanceof Error ? err.message : String(err);
    if (res.headersSent) return;
    res.status(status).json({
      message: status >= 500 ? "Internal server error." : msg,
      detail: msg
    });
  });

  return app;
}

function getHttpErrorStatus(err: unknown): number {
  if (err && typeof err === "object") {
    const o = err as { status?: number; statusCode?: number };
    const s = o.status ?? o.statusCode;
    if (typeof s === "number" && s >= 400 && s < 600) return s;
  }
  return 500;
}
