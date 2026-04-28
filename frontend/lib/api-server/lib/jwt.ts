import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { config } from "../config";

export type AccessTokenPayload = {
  sub: string;
  role: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtAccessTtlSeconds });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwtSecret) as AccessTokenPayload;
}

export function issueRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

