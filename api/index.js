import { createApp } from '../backend/src/app.js';

let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = createApp().then(({ app }) => app);
  }
  const app = await appPromise;
  return app(req, res);
}
