
import { GoogleGenAI } from "@google/genai";
import { CorpsMemberEntry, ReportCategory, DauraLga } from "../types";

// Fixed: Simplified error handling and ensured proper usage of the GoogleGenAI instance
export async function summarizeReport(entries: CorpsMemberEntry[], zoneName: string): Promise<string> {
  // Always use the named parameter and direct environment variable access
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lgas: DauraLga[] = ['Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'];
  
  let dataSummary = `RAW DATASET FOR ${zoneName.toUpperCase()}\n\n`;

  lgas.forEach(lga => {
    const lgaEntries = entries.filter(e => e.lga === lga);
    if (lgaEntries.length > 0) {
      dataSummary += `LGA: ${lga}\n`;
      lgaEntries.forEach(e => {
        dataSummary += `- [${e.category}] ${e.name} (${e.stateCode})\n`;
      });
      dataSummary += `\n`;
    }
  });

  const prompt = `
    TASK: Generate a professional NYSC Zonal Memorandum.
    ROLE: Zonal Inspector, ${zoneName}.
    DATE: ${new Date().toLocaleDateString('en-GB')}
    DATA:
    ${dataSummary}
    
    INSTRUCTIONS:
    1. Create a formal internal memorandum layout.
    2. Start with a "FROM:", "TO:", and "SUBJECT: WEEKLY STATUS REPORT ON CORPS MEMBERS" line.
    3. Include a professional Executive Summary.
    4. Categorize by LGA and provide a summary of the reported incidents.
    5. Maintain a formal, administrative tone suitable for State Headquarters.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Report compilation failed.";
  } catch (err: any) {
    console.error("Gemini Service Error:", err);
    throw new Error("The report generator encountered an issue processing the data.");
  }
}
