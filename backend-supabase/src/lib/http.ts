import type { Response } from "express";

export function okData<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ data });
}

export function fail(res: Response, status: number, message: string): Response {
  return res.status(status).json({ message });
}
