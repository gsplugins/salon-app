import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { GET } = createRouteHandlers("/my/shop/customers/:mobile/profile", ["GET"]);
export { GET };
