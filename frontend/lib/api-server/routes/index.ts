import { Router } from "express";
import { mountAuthRoutes } from "./auth";
import { mountPublicRoutes } from "./public";
import { mountMyShopRoutes } from "./my-shop";
import { mountCustomerRoutes } from "./customer";
import { mountStaffRoutes } from "./staff";
import { mountAdminSystemRoutes } from "./admin-system";
import { salonContextMiddleware } from "../middleware/salon-context";

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

