import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const revalidate = 300;

const { GET } = createRouteHandlers("/public/subscription-plans", ["GET"]);
export { GET };

