import { GoogleGenAI } from "@google/genai";

export async function generateDisciplinaryQuery(cmName: string, cmCode: string, reason: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    TASK: Generate an official, highly formal disciplinary query letter for an NYSC Corps Member defaulting on biometric clearance or official duties.
    
    PERSONNEL DATA:
    NAME: ${cmName}
    STATE CODE: ${cmCode}
    INFRACTION: ${reason}
    
    REGULATORY CITATIONS:
    - NYSC Bye-Laws (2011 Revised Decree)
    - Schedule 1, Section 1: Disciplinary code regarding absenteeism and neglect of duty.
    - Section 4(2): Mandatory participation in all official activities including monthly verification.
    
    LETTER CONTENT REQUIREMENTS:
    1. FORMAL SALUTATION: Dear Corps Member.
    2. OPENING: State clearly that the member's failure to present themselves for biometric verification or duty constitutes a serious breach of the National Service protocol.
    3. CITATION: Explicitly mention that this act violates Schedule 1 of the NYSC Bye-Laws (2011 Revised).
    4. DIRECTIVE: Require the member to provide a detailed written explanation/defense within 24 hours of receiving this query.
    5. WARNING: Explicitly state that failure to provide a satisfactory defense will lead to further disciplinary actions as stipulated in the NYSC Decree, including extension of service year without pay or other penalties.
    
    TONE: Austere, administrative, authoritative, and strictly institutional. Do not use conversational language.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "SYSTEM ERROR: Failed to generate formal documentation.";
  } catch (err) {
    console.error("Gemini Documentation Error:", err);
    return "ADMINISTRATIVE NOTICE: The AI-assisted documentation service is temporarily unavailable. Please refer to NYSC Bye-Laws (2011 Revised) Schedule 1 to manually draft this query.";
  }
}