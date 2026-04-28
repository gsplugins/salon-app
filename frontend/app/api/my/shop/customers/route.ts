import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { POST } = createRouteHandlers("/my/shop/customers", ["POST"]);
export { POST };
