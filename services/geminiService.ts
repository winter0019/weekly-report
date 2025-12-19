
import { GoogleGenAI } from "@google/genai";
import { CorpsMemberEntry, ReportCategory, DauraLga } from "../types";

export async function summarizeReport(entries: CorpsMemberEntry[], zoneName: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const lgas: DauraLga[] = ['Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'];
  
  let dataSummary = `ZONAL REPORT DATA FOR ${zoneName.toUpperCase()}\n\n`;

  lgas.forEach(lga => {
    const lgaEntries = entries.filter(e => e.lga === lga);
    if (lgaEntries.length > 0) {
      dataSummary += `--- LGA: ${lga} ---\n`;
      Object.values(ReportCategory).forEach(cat => {
        const catEntries = lgaEntries.filter(e => e.category === cat);
        if (catEntries.length > 0) {
          dataSummary += `[${cat}]\n`;
          catEntries.forEach(e => {
            let details = `Name: ${e.name}, Code: ${e.stateCode}`;
            if ('period' in e) details += `, Period: ${e.period}`;
            if ('illness' in e) details += `, Illness: ${e.illness}, Hospitalized: ${e.hospitalized ? 'Yes' : 'No'}`;
            if ('dateKidnapped' in e) details += `, Date: ${e.dateKidnapped}`;
            if ('dateMissing' in e) details += `, Date: ${e.dateMissing}`;
            if ('dateOfDeath' in e) details += `, Date: ${e.dateOfDeath}, Reason: ${e.reason}`;
            dataSummary += ` - ${details}\n`;
          });
        }
      });
      dataSummary += `\n`;
    }
  });

  if (entries.length === 0) {
    dataSummary = "No incidents reported across the zone for this week.";
  }

  const prompt = `
    As the Zonal Inspector for the Daura Zone NYSC Secretariat, 
    please format the following zonal raw data into a professional and formal weekly status report 
    for onward submission to the State Coordinator and NDHQ.
    
    Zone: ${zoneName}
    Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
    
    Input Data:
    ${dataSummary}
    
    The report should be highly professional, structured by LGA, and follow NYSC official memorandum guidelines. 
    Include a formal executive summary at the top.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Failed to generate zonal summary.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI summary. Please use manual export.";
  }
}
