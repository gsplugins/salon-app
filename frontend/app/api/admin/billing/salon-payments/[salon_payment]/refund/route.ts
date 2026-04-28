import { createRouteHandlers } from "@/lib/api-server/next-route-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { PATCH } = createRouteHandlers("/admin/billing/salon-payments/:salon_payment/refund", ["PATCH"]);
export { PATCH };
