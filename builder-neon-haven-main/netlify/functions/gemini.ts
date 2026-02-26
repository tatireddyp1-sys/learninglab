import fetch from 'node-fetch';
import { Handler } from '@netlify/functions';

const MODEL = 'models/text-bison-001';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta2/${MODEL}:generateText`;

const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const prompt = body.prompt || '';
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.2;
    const maxOutputTokens = typeof body.maxOutputTokens === 'number' ? body.maxOutputTokens : 512;

    if (!prompt || prompt.trim().length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
    }

    const apiKey = process.env.GOOGLE_GEN_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing server configuration for Gemini API key' }) };
    }

    const payload = {
      prompt: { text: prompt },
      temperature,
      candidateCount: 1,
      maxOutputTokens,
    };

    const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error', status: res.status, body: text }) };
    }

    const data = await res.json();
    // response shape: { candidates: [ { output: '...' } ] }
    const output = (data?.candidates && data.candidates[0]?.output) || data?.output || '';

    return { statusCode: 200, body: JSON.stringify({ output, raw: data }) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};

export { handler };
