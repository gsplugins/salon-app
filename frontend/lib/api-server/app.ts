import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { mountApiRoutes } from "./routes/index";
import { hasApiSupabaseEnv } from "./config";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.get("/api/test", (_req, res) => {
    res.json({ message: "Supabase API working" });
  });

  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (hasApiSupabaseEnv) return next();
    return res.status(500).json({
      message: "Supabase server env is missing.",
      hint:
        "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local for local dev, or in Vercel Environment Variables for this frontend project."
    });
  });

  app.use("/api", mountApiRoutes());

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found.", path: _req.originalUrl });
  });

  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    void next;
     
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

