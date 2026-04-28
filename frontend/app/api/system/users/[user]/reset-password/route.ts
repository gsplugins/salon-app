import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { POST } = createRouteHandlers("/system/users/:user/reset-password", ["POST"]);
export { POST };
