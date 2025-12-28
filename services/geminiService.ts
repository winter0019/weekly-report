import { GoogleGenAI } from "@google/genai";

export async function generateDisciplinaryQuery(cmName: string, cmCode: string, ppa: string, reason: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    TASK: Generate a SHORT and HIGHLY FORMAL disciplinary query letter for an NYSC Corps Member.
    
    PERSONNEL DATA:
    NAME: ${cmName}
    STATE CODE: ${cmCode}
    PPA: ${ppa}
    INFRACTION: ${reason}
    
    LETTER CONTENT REQUIREMENTS:
    1. SALUTATION: Dear Corps Member.
    2. OPENING: Explicitly state that their failure to comply with biometric verification/duty while serving at ${ppa} is a breach of service code.
    3. CITATION: Mention the NYSC Bye-Laws (2011 Revised).
    4. DIRECTIVE: Require a written explanation within 24 hours.
    5. WARNING: State that failure to respond will lead to disciplinary penalties according to the NYSC Decree.
    
    TONE: Austere, institutional, and very brief. Do not use conversational language. 
    NOTE: Do not include the letterhead text in the response, as the UI handles it. Start from "Reference: NYSC/KTS/..." or the Salutation.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "SYSTEM ERROR: Failed to generate formal documentation.";
  } catch (err) {
    console.error("Gemini Documentation Error:", err);
    return "ADMINISTRATIVE NOTICE: The AI service is currently down. Please draft a manual query for the member at " + ppa + " regarding " + reason + ".";
  }
}