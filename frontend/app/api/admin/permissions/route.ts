import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET, PUT } = createRouteHandlers("/admin/permissions", ["GET", "PUT"]);
export { GET, PUT };
