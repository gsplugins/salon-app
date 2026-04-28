import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET, PUT } = createRouteHandlers("/my/shop/services-catalog/:serviceId/inventory", ["GET", "PUT"]);
export { GET, PUT };
