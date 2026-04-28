import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { DELETE } = createRouteHandlers("/waitlist/:id", ["DELETE"]);
export { DELETE };
