import { config } from "./config";
import { createApp } from "./app";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`frontend API server listening on http://127.0.0.1:${config.port}`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${config.port} is already in use. Stop the other process or set PORT=4001 in frontend/.env.local`
    );
    process.exit(1);
  }
  throw err;
});

