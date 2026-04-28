import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET, DELETE } = createRouteHandlers("/staff/notifications", ["GET", "DELETE"]);
export { GET, DELETE };
