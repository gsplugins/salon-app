import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET, PATCH } = createRouteHandlers("/admin/general", ["GET", "PATCH"]);
export { GET, PATCH };
