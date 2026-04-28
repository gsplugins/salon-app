import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { PATCH } = createRouteHandlers("/my/shop/queue/:id/status", ["PATCH"]);
export { PATCH };
