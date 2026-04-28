import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET } = createRouteHandlers("/admin/notification-templates", ["GET"]);
export { GET };
