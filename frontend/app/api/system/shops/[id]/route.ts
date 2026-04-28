import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { PATCH, DELETE } = createRouteHandlers("/system/shops/:id", ["PATCH", "DELETE"]);
export { PATCH, DELETE };
