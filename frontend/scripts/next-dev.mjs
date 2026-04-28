/**
 * Starts Next dev on PORT (default 3000), bind 0.0.0.0.
 *
 * Next.js 16 allows only ONE `next dev` per project folder. Picking another port
 * does not help if an old dev server is still running — you must stop that process first.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const port = Math.max(1024, Math.min(65535, Number(process.env.PORT) || 3000));
if (process.argv.includes("--clear-lock") || process.env.NEXT_CLEAR_DEV_LOCK === "1") {
  const devState = path.join(root, ".next", "dev");
  try {
    if (fs.existsSync(devState)) {
      fs.rmSync(devState, { recursive: true, force: true });
      console.log(`[frontend] Removed ${devState} (stop any running Next dev before doing this on a live server).`);
    }
  } catch (e) {
    console.warn("[frontend] Could not clear .next/dev:", e);
  }
}

console.log(`[frontend] Starting Next.js on http://127.0.0.1:${port} (bind 0.0.0.0:${port})`);
console.log("[frontend] Browser /api/* is handled by App Router route handlers.");
console.log(
  `[frontend] If you see "Another next dev server is already running", stop the old one first:\n` +
    `  Windows: taskkill /PID <pid> /F   (use the PID from Next's message)\n` +
    `  Or: close the other terminal, then run again.\n` +
    `  Stale lock only (no process): npm run dev:refresh`
);

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "0.0.0.0", "--port", String(port)],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  }
);

child.on("error", (err) => {
  console.error("[frontend] Failed to spawn Next.js:", err);
  process.exit(1);
});

child.on("exit", (code) => process.exit(code ?? 0));
