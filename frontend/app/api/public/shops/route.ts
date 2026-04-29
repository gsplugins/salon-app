import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const revalidate = 60;

const { GET } = createRouteHandlers("/public/shops", ["GET"]);
export { GET };
