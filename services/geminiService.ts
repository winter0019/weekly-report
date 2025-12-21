
import { GoogleGenAI } from "@google/genai";
import { CorpsMemberEntry, ReportCategory, DauraLga } from "../types";

export async function summarizeReport(entries: CorpsMemberEntry[], zoneName: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const lgas: DauraLga[] = ['Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'];
  
  let dataSummary = `AGGREGATED ZONAL DATA FOR ${zoneName.toUpperCase()}\n\n`;

  lgas.forEach(lga => {
    const lgaEntries = entries.filter(e => e.lga === lga);
    if (lgaEntries.length > 0) {
      dataSummary += `LGA: ${lga} (${lgaEntries.length} incidents)\n`;
      lgaEntries.forEach(e => {
        dataSummary += `- [${e.category.toUpperCase()}] ${e.name} (${e.stateCode})\n`;
      });
      dataSummary += `\n`;
    }
  });

  const prompt = `
    TASK: Generate a high-level NYSC Zonal Intelligence Memorandum for the State Coordinator.
    ROLE: Zonal Inspector, Daura Zone.
    DATE: ${new Date().toLocaleDateString('en-GB')}
    DATASET:
    ${dataSummary}
    
    INSTRUCTIONS:
    1. Structure as an internal MEMORANDUM (FROM, TO, SUBJECT).
    2. PROVIDE AN EXECUTIVE SUMMARY: Highlight the total count of incidents across the zone.
    3. CRITICAL ALERTS: Explicitly highlight any entries categorized as "DECEASED" or "KIDNAPPED" as top priority.
    4. LGA BREAKDOWN: Summarize the reporting activity for each LGA listed in the data. Mention LGAs with high reporting volume.
    5. ADMINISTRATIVE RECOMMENDATION: Suggest next steps (e.g., dispatching inspection teams, welfare checks).
    6. Tone: Extremely formal, administrative, and urgent where necessary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Report compilation failed.";
  } catch (err: any) {
    console.error("Gemini Error:", err);
    throw new Error("AI Terminal Offline: Please verify connection and API credentials.");
  }
}
