import { Router } from "express";
import { mountAuthRoutes } from "./auth.js";
import { mountPublicRoutes } from "./public.js";
import { mountMyShopRoutes } from "./my-shop.js";
import { mountCustomerRoutes } from "./customer.js";
import { mountStaffRoutes } from "./staff.js";
import { mountAdminSystemRoutes } from "./admin-system.js";
import { salonContextMiddleware } from "../middleware/salon-context.js";

export function mountApiRoutes() {
  const api = Router();

  mountAuthRoutes(api);
  mountPublicRoutes(api);
  mountCustomerRoutes(api);

  const shopAndStaffRouter = Router();
  shopAndStaffRouter.use(salonContextMiddleware());
  mountMyShopRoutes(shopAndStaffRouter);
  mountStaffRoutes(shopAndStaffRouter);
  api.use(shopAndStaffRouter);

  const adminSystemRouter = Router();
  mountAdminSystemRoutes(adminSystemRouter);
  api.use(adminSystemRouter);

  return api;
}
