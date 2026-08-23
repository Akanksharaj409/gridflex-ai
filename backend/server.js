import { createApp } from './src/app.js';

/**
 * API_PORT, not PORT. Dev tooling and preview harnesses set PORT for the *web*
 * server; inheriting it makes the API try to bind the same port as Vite and
 * silently take it. Keeping a separate name removes the whole class of clash.
 */
const port = Number(process.env.API_PORT) || 4000;

createApp()
  .then(({ app, storage }) => {
    app.listen(port, () => {
      console.log(`GridFlex API listening on http://localhost:${port}`);
      console.log(`  storage:   ${storage.mode} (${storage.seededReadings} hourly readings${storage.resumedSession ? ', session resumed' : ''})`);
      console.log(`  assistant: ${process.env.GEMINI_API_KEY ? 'gemini' : 'deterministic explainer'}`);
    });
  })
  .catch((err) => {
    console.error(`Startup failed: ${err.message}`);
    process.exit(1);
  });
