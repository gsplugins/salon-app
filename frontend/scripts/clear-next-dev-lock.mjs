/**
 * Removes `.next/dev` (Next 16+ dev singleton state). Use when Next says another
 * dev server is running but no process is left — after stopping all Next terminals.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const devState = path.join(root, ".next", "dev");

if (!fs.existsSync(devState)) {
  // eslint-disable-next-line no-console
  console.log(`[frontend] Nothing to remove: ${devState}`);
  process.exit(0);
}

fs.rmSync(devState, { recursive: true, force: true });
// eslint-disable-next-line no-console
console.log(`[frontend] Removed ${devState}. Run npm run dev again.`);
