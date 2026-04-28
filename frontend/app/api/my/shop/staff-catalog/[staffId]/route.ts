import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { PATCH, DELETE } = createRouteHandlers("/my/shop/staff-catalog/:staffId", ["PATCH", "DELETE"]);
export { PATCH, DELETE };
