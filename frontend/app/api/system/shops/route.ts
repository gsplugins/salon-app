import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET, POST } = createRouteHandlers("/system/shops", ["GET", "POST"]);
export { GET, POST };
