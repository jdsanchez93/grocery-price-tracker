import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(3003);

serve({
  fetch: createApp().fetch,
  port
});

console.log(`API listening on http://localhost:${port}`);