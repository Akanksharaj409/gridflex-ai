import { createApp } from './src/app.js';

const port = Number(process.env.PORT) || 4000;

createApp().listen(port, () => {
  console.log(`GridFlex API listening on http://localhost:${port}`);
  console.log(`  storage:   ${process.env.MONGO_URI ? 'mongo' : 'in-memory (seeded)'}`);
  console.log(`  assistant: ${process.env.GEMINI_API_KEY ? 'gemini' : 'deterministic explainer'}`);
});
