import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const revalidate = 120;

const { GET } = createRouteHandlers("/public/barbers/:staffId", ["GET"]);
export { GET };
