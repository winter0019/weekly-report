import { GoogleGenAI } from "@google/genai";

export async function generateDisciplinaryQuery(cmName: string, cmCode: string, reason: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    TASK: Generate a formal disciplinary query letter for an NYSC Corps Member.
    CM NAME: ${cmName}
    CM CODE: ${cmCode}
    REASON FOR QUERY: Absent from duty without permission (${reason}).
    
    INSTRUCTIONS:
    1. Cite the NYSC Bye-Laws (2011 Revised), specifically Schedule 1 (Item 1) regarding absenteeism.
    2. Maintain a strict, administrative tone.
    3. Include fields for 'To:', 'From: Local Government Inspector', and 'Subject: QUERY FOR ABSENCE FROM PLACE OF PRIMARY ASSIGNMENT'.
    4. Demand a written explanation within 24 hours.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Failed to generate query.";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "Error generating AI query.";
  }
}