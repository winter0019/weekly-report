import { GoogleGenAI } from "@google/genai";

export async function generateDisciplinaryQuery(cmName: string, cmCode: string, reason: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    TASK: Generate an official, highly formal disciplinary query letter for an NYSC Corps Member defaulting on biometric clearance or duty.
    
    PERSONNEL DATA:
    NAME: ${cmName}
    STATE CODE: ${cmCode}
    NATURE OF DEFAULT: ${reason}
    
    REGULATORY FRAMEWORK:
    - NYSC Bye-Laws (2011 Revised)
    - Schedule 1, Section 1: Disciplinary code regarding absenteeism and neglect of duty.
    - Section 4(2): Mandatory participation in all official activities including monthly clearance.
    
    LETTER STRUCTURE:
    1. LETTERHEAD: NYSC Secretariat Command.
    2. REFERENCE: NYSC/SEC/DISC/VOL.I/102.
    3. TO: The Corps Member (Full Name & State Code).
    4. FROM: The Local Government Inspector (LGI).
    5. SUBJECT: QUERY FOR GROSS MISCONDUCT AND NEGLECT OF OFFICIAL DUTY.
    6. BODY: State clearly that the member failed to present themselves for biometric verification or was absent from duty without valid permission. Cite the specific Bye-Law section.
    7. ULTIMATUM: Require a detailed written defense to reach the office within 24 hours of receipt.
    8. CLOSING: Warning of further disciplinary action according to the decree.
    
    TONE: Grave, administrative, authoritative, and strictly professional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Administrative Error: Could not generate formal documentation.";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "Official Notice: AI Service is temporarily unavailable. Please draft the query manually in accordance with Schedule 1.";
  }
}