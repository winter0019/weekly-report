
import { GoogleGenAI } from "@google/genai";
import { CorpsMemberEntry, ReportCategory, DauraLga } from "../types";

export async function summarizeReport(entries: CorpsMemberEntry[], zoneName: string): Promise<string> {
  // Always use the standard initialization with the provided process.env.API_KEY.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Removed duplicate 'Mani' from the list.
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
    // Calling generateContent with the correct model and prompt.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Accessing the text property directly on the response object.
    return response.text || "Report compilation failed.";
  } catch (err: any) {
    console.error("Gemini Error:", err);
    throw new Error("AI Terminal Offline: Please verify connection and API credentials.");
  }
}
