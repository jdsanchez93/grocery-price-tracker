import { Hono } from 'hono'

export function createApp() {
    const app = new Hono();
    app.get('/', (c) => c.text('Hello Hono!'))
    return app;
}