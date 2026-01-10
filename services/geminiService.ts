
import { GoogleGenAI } from "@google/genai";

export async function generateDisciplinaryQuery(cmName: string, cmCode: string, lga: string, reason: string, ppa: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    TASK: Generate the narrative body of a CONCISE and FORMAL disciplinary query for an NYSC Corps Member.
    
    DATA:
    NAME: ${cmName}
    STATION: ${lga}
    PPA: ${ppa}
    INFRACTION: ${reason}
    
    REQUIREMENTS:
    1. Start immediately with the first paragraph. 
    2. Paragraph 1: State that management has noted their failure to participate in the mandatory biometric clearance for the specified period, in violation of the NYSC Act and Bye-Laws.
    3. Paragraph 2: Direct the member to submit a written explanation within 48 hours of receipt, stating why disciplinary action should not be taken.
    4. Paragraph 3: Mention that sanctions under NYSC Bye-Laws (Revised 2011) include extension of service without pay.
    5. Closing: End with "Kindly treat this matter as urgent."
    
    CONSTRAINTS: 
    - DO NOT include headers (TO, REF, PPA, LGA, SUBJECT).
    - DO NOT include signature lines.
    - DO NOT use markdown bolding or italics.
    - OUTPUT ONLY the text paragraphs.
    - Total length should be around 100-120 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || `The Management of the NYSC has noted your failure to participate in the mandatory biometric clearance, in violation of the NYSC Act and Bye-Laws. You are hereby directed to submit a written explanation within 48 hours of receipt of this query, stating why disciplinary action should not be taken against you. Please note that sanctions for such default, as provided under the NYSC Bye-Laws (Revised 2011), may include extension of service without pay. Kindly treat this matter as urgent.`;
  } catch (err) {
    console.error("Gemini Documentation Error:", err);
    return `The Management of the NYSC has noted your failure to participate in the mandatory biometric clearance, in violation of the NYSC Act and Bye-Laws. You are hereby directed to submit a written explanation within 48 hours of receipt of this query, stating why disciplinary action should not be taken against you. Kindly treat this matter as urgent.`;
  }
}
