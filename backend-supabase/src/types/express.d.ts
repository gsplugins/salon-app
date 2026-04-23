import type { SalonContext } from "../salon-types.js";

declare global {
  namespace Express {
    interface Request {
      salon?: SalonContext;
    }
  }
}

export {};
