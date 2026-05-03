import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
/** Shop + services catalog changes occasionally; not real-time like bookings. */
export const revalidate = 60;

const { GET } = createRouteHandlers("/public/shops/:shopId", ["GET"]);
export { GET };
