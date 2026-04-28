import type { SalonContext } from "../salon-types";

declare global {
  namespace Express {
    interface Request {
      salon?: SalonContext;
    }
  }
}

export {};

