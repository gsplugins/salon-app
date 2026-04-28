import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { POST } = createRouteHandlers("/auth/logout", ["POST"]);
export { POST };
