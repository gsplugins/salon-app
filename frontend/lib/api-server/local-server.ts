import { createApp } from "./app";

declare global {
  var __localApiBaseUrl: Promise<string> | undefined;
}

async function startServer(): Promise<string> {
  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
    s.on("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve local API server address.");
  }
  return `http://127.0.0.1:${address.port}`;
}

export function getLocalApiBaseUrl(): Promise<string> {
  if (!global.__localApiBaseUrl) global.__localApiBaseUrl = startServer();
  return global.__localApiBaseUrl;
}
