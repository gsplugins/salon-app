import { config } from "./config.js";
import { createApp } from "./app.js";

const app = createApp();

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`backend-supabase listening on http://127.0.0.1:${config.port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `Port ${config.port} is already in use. Stop the other process or set PORT=4001 in backend-supabase/.env`
    );
    process.exit(1);
  }
  throw err;
});
