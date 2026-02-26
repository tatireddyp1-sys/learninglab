import { RequestHandler } from "express";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEN_API_KEY });

export const handleGemini: RequestHandler = async (req, res) => {
  try {
    const { prompt, temperature = 0.2, maxOutputTokens = 512 } = req.body || {};
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: "prompt required" });

    if (!process.env.GOOGLE_GEN_API_KEY) return res.status(500).json({ error: "server misconfiguration: missing GOOGLE_GEN_API_KEY" });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      temperature,
      maxOutputTokens,
    });

    // response.text is commonly provided by the SDK example
    const text = response?.text || (response?.output && response.output[0] && (response.output[0].content?.[0]?.text || response.output[0].content?.[0]?.value)) || JSON.stringify(response);

    return res.json({ output: text, raw: response });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || String(err) });
  }
};
