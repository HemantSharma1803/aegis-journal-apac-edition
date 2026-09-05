import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer(): Promise<void> {
  const app: Application = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Lazy init Gemini SDK
  function getGeminiClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response): void => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // POST /api/gemini/analyze
  app.post('/api/gemini/analyze', async (req: Request, res: Response): Promise<void> => {
    try {
      const { sanitizedContent, moodScore } = req.body || {};
      if (!sanitizedContent || typeof sanitizedContent !== 'string') {
        res.status(400).json({ error: 'Sanitized content is required' });
        return;
      }

      const ai = getGeminiClient();
      const systemInstruction = `You are a compassionate, insightful, and stoic Socratic cognitive journaling assistant.
Analyze the user's sanitized journal entry. Notice that personal identifiers may have been redacted as [REDACTED_EMAIL], [REDACTED_PHONE], etc.
Provide:
1. "summary": A 1-2 sentence empathetic, clear summary of their mental state and core thoughts.
2. "cognitiveDistortions": An array of identified cognitive distortions if present (e.g. "Catastrophizing", "Black-and-White Thinking", "Overgeneralization", "Mind Reading", "None identified").
3. "socraticQuestions": An array of 2-3 deep, constructive reflective questions challenging unhelpful beliefs without judgment.
4. "stoicReflection": A short, grounding philosophical or stoic insight.
5. "emotionalValence": A number between -1.0 (strongly negative) to +1.0 (strongly positive).

Return ONLY valid JSON matching this schema:
{
  "summary": "string",
  "cognitiveDistortions": ["string"],
  "socraticQuestions": ["string"],
  "stoicReflection": "string",
  "emotionalValence": 0.0
}`;

      const prompt = `Journal Entry Content (Sanitized):
"""
${sanitizedContent}
"""
Self-reported Mood Score: ${moodScore ?? 5}/10.

Provide the JSON analysis.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = {
          summary: responseText,
          cognitiveDistortions: [],
          socraticQuestions: ['What is the primary factor within your control right now?'],
          stoicReflection: 'Focus on what you can control, and let go of what you cannot.',
          emotionalValence: 0.0,
        };
      }

      res.json(parsedData);
    } catch (error: any) {
      console.error('[Gemini Analyze Error]:', error);
      res.status(500).json({
        error: error?.message || 'Internal server error analyzing journal entry',
      });
    }
  });

  // POST /api/gemini/prompt-assistant
  app.post('/api/gemini/prompt-assistant', async (req: Request, res: Response): Promise<void> => {
    try {
      const { category, currentText } = req.body || {};
      const ai = getGeminiClient();

      const systemInstruction = `You are an introspective journaling muse. Provide 3 thoughtful, varied journal writing prompts based on the requested theme or existing rough notes.
Return ONLY valid JSON:
{
  "prompts": ["string", "string", "string"]
}`;

      const prompt = `Theme/Category: ${category || 'General Reflection'}
Current draft snippet (if any): "${currentText || 'None'}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{"prompts":[]}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('[Gemini Prompt Assistant Error]:', error);
      res.status(500).json({
        prompts: [
          'What gave you energy today, and what drained it?',
          'What assumption are you making that might not be true?',
          'If you looked back at today from 5 years in the future, what would matter most?',
        ],
      });
    }
  });

  // POST /api/gemini/chat
  app.post('/api/gemini/chat', async (req: Request, res: Response): Promise<void> => {
    try {
      const { history, message, sanitizedContext } = req.body || {};
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const ai = getGeminiClient();
      const systemInstruction = `You are the Socratic Mirror, a patient, empathetic, and philosophical reflection partner in a zero-knowledge private journal.
Your role is to help the writer explore their own thoughts deeply through Socratic questioning, gentle reframing, and non-judgmental guidance.
All journal content is sanitized for privacy. Keep your answers focused, thoughtful, and typically 2-4 sentences with 1 poignant question.
Current Entry Context (Sanitized):
"""
${sanitizedContext || 'No current entry text'}
"""`;

      const formattedContents = (history || []).map((msg: { role: string; content: string }) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      formattedContents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: formattedContents,
        config: {
          systemInstruction,
        },
      });

      res.json({ reply: response.text || 'I hear you. What does this mean for you going forward?' });
    } catch (error: any) {
      console.error('[Gemini Chat Error]:', error);
      res.status(500).json({
        reply: 'I am here with you. What feels like the most important thing to focus on right now?',
      });
    }
  });

  // POST /api/gemini/synthesis
  app.post('/api/gemini/synthesis', async (req: Request, res: Response): Promise<void> => {
    try {
      const { sanitizedSnippets } = req.body || {};
      if (!Array.isArray(sanitizedSnippets) || sanitizedSnippets.length === 0) {
        res.status(400).json({ error: 'At least one sanitized snippet is required' });
        return;
      }

      const ai = getGeminiClient();
      const systemInstruction = `You are a longitudinal mental wellness and cognitive pattern analyst.
Analyze these sanitized journal entries collected over time.
Identify recurring themes, cognitive resilience patterns, emotional trajectory, and actionable growth opportunities.
Return ONLY valid JSON:
{
  "themeOverview": "string",
  "recurringStrengths": ["string"],
  "growthAreas": ["string"],
  "longitudinalTrajectory": "string",
  "recommendedAction": "string"
}`;

      const prompt = `Sanitized Journal Entries for Synthesis:
${sanitizedSnippets.map((s: string, idx: number) => `Entry ${idx + 1}:\n"""${s}"""`).join('\n\n')}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      res.json(JSON.parse(responseText));
    } catch (error: any) {
      console.error('[Gemini Synthesis Error]:', error);
      res.status(500).json({
        themeOverview: 'Your reflections demonstrate continuous self-awareness and mindful introspection.',
        recurringStrengths: ['Commitment to honest reflection', 'Emotional awareness'],
        growthAreas: ['Reframing external stressors beyond direct control'],
        longitudinalTrajectory: 'Steadily evolving towards greater clarity and emotional equilibrium.',
        recommendedAction: 'Continue your daily journaling cadence with focus on actionable daily wins.',
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response): void => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
