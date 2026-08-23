import { Router } from 'express';
import { answerQuestion, SUGGESTED_QUESTIONS, planFacts } from '../services/aiService.js';
import { getPlan } from '../services/planService.js';

const router = Router();

router.get('/suggestions', (req, res) => {
  res.json({
    questions: SUGGESTED_QUESTIONS,
    backend: process.env.GEMINI_API_KEY ? 'gemini' : 'explainer',
  });
});

/** The facts the assistant is allowed to cite - exposed so answers are auditable. */
router.get('/facts', (req, res) => {
  res.json(planFacts(getPlan()));
});

router.post('/chat', async (req, res) => {
  const question = String(req.body?.question ?? '').trim();
  if (!question) return res.status(400).json({ error: 'question is required' });
  if (question.length > 500) return res.status(400).json({ error: 'question too long' });
  try {
    const result = await answerQuestion(question, getPlan());
    return res.json({ question, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
