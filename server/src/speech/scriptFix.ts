import { GoogleGenAI } from "@google/genai";
import type { ScriptFixer } from "./normalize.js";

const TIMEOUT_MS = 6000;

const INSTRUCTION = `You fix the writing script of a speech transcript. The speaker mixes Hindi and English words.

Rules:
1. Every Hindi word must be in Devanagari script. This includes Hindi written in Roman letters, such as mujhe, hai, kal, bhej do, aur.
2. Every English word must be in the Latin alphabet. This includes English words written in Devanagari, such as मीटिंग (meeting), फाइल (file), प्लीज (please).
3. Never output Hindi words in Roman letters.
4. Do not translate, add, remove or reorder words. Keep the punctuation.
5. Reply with only the corrected text.

Examples:
Input: कल मेरी मीटिंग है और मुझे प्रेजेंटेशन तैयार करना है।
Output: कल मेरी meeting है और मुझे presentation तैयार करना है।
Input: Can you please mujhe woh file bhej do?
Output: Can you please मुझे वो file भेज दो?
Input: कैन यू प्लीज मुझे वो फाइल भेज दो?
Output: Can you please मुझे वो file भेज दो?
Input: Please send the report to the team by Friday afternoon.
Output: Please send the report to the team by Friday afternoon.
Input: मुझे कल सुबह बाजार जाना है।
Output: मुझे कल सुबह बाजार जाना है।`;

/** Uses a fast Gemini text model to put Hindi in Devanagari and English in Latin letters. */
export function createGeminiScriptFixer(apiKey: string, model: string): ScriptFixer {
  const ai = new GoogleGenAI({ apiKey });

  return async (text) => {
    if (!/\p{L}/u.test(text)) return text;

    const call = ai.models.generateContent({
      model,
      contents: text,
      config: { systemInstruction: INSTRUCTION, temperature: 0 },
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("script fix timed out")), TIMEOUT_MS),
    );

    const fixed = (await Promise.race([call, timeout])).text?.trim();
    // Guard against an empty or runaway answer: keep what the engine heard.
    if (!fixed || fixed.length > text.length * 3) return text;
    return fixed;
  };
}
