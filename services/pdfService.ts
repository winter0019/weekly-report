
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const generateOfficialPDF = (data: any, type: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const nyscGreen = [0, 168, 89];
  const nyscRed = [237, 28, 36];
  const nyscGold = [184, 134, 11];
  
  // Header Construction
  doc.setTextColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("NATIONAL YOUTH SERVICE CORPS", pageWidth / 2, 20, { align: "center" });
  
  doc.setTextColor(nyscRed[0], nyscRed[1], nyscRed[2]);
  doc.setFontSize(12);
  doc.text("Office of the Zonal Inspector, Daura Zonal Office", pageWidth / 2, 28, { align: "center" });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const rightX = pageWidth - 15;
  doc.text("Beside Daura Emirate Council", rightX, 38, { align: "right" });
  doc.text("Kangiwa Office Complex", rightX, 43, { align: "right" });
  doc.text("Daura, Katsina State", rightX, 48, { align: "right" });

  // Official Stripes
  const barY = 55;
  const barThickness = 1.2;
  doc.setLineWidth(barThickness);
  doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, barY, pageWidth - 10, barY);
  doc.setDrawColor(0, 0, 0);
  doc.line(10, barY + barThickness, pageWidth - 10, barY + barThickness);
  doc.setDrawColor(nyscGold[0], nyscGold[1], nyscGold[2]);
  doc.line(10, barY + (barThickness * 2), pageWidth - 10, barY + (barThickness * 2));

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Date: ${dateStr}`, pageWidth - 15, 70, { align: "right" });

  if (type === 'SINGLE_CWHS') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("CORPS MEMBER STATUS BRIEF", 15, 80);
    doc.setFontSize(11);
    doc.text("NAME:", 15, 95); doc.setFont("helvetica", "normal"); doc.text(String(data.name || 'N/A').toUpperCase(), 75, 95);
    doc.setFont("helvetica", "bold"); doc.text("STATE CODE:", 15, 102); doc.setFont("helvetica", "normal"); doc.text(String(data.stateCode || 'N/A').toUpperCase(), 75, 102);
    doc.setFont("helvetica", "bold"); doc.text("STATION:", 15, 109); doc.setFont("helvetica", "normal"); doc.text(String(data.lga || 'N/A'), 75, 109);
    doc.setFont("helvetica", "bold"); doc.text("CATEGORY:", 15, 116); doc.setFont("helvetica", "normal"); doc.text(String(data.category || 'N/A').toUpperCase(), 75, 116);
    doc.setFont("helvetica", "bold"); doc.text("DETAILS:", 15, 130); doc.setFont("helvetica", "italic");
    const detailsText = data.details || "No details provided.";
    const splitDetails = doc.splitTextToSize(detailsText, pageWidth - 30);
    doc.text(splitDetails, 15, 137);
  } else if (type === 'CDR_CASE') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("DISCIPLINARY CASE RECORD", 15, 80);
    doc.setFontSize(11);
    doc.text("PERSONNEL:", 15, 95); doc.setFont("helvetica", "normal"); doc.text(`${data.name || 'N/A'} (${data.stateCode || 'N/A'})`, 75, 95);
    doc.setFont("helvetica", "bold"); doc.text("LGA/STATION:", 15, 102); doc.setFont("helvetica", "normal"); doc.text(data.lga || 'N/A', 75, 102);
    doc.setFont("helvetica", "bold"); doc.text("PPA:", 15, 109); doc.setFont("helvetica", "normal"); doc.text(data.ppa || 'N/A', 75, 109);
    doc.setFont("helvetica", "bold"); doc.text("CASE STATUS:", 15, 116); doc.setFont("helvetica", "normal"); doc.text(String(data.status || 'Pending').replace(/_/g, ' ').toUpperCase(), 75, 116);
    doc.setFont("helvetica", "bold"); doc.text("MISCONDUCT:", 15, 130); doc.setFont("helvetica", "italic");
    const misDetails = data.misconduct || "N/A";
    const splitMis = doc.splitTextToSize(misDetails, pageWidth - 30);
    doc.text(splitMis, 15, 137);
  } else if (type === 'CIM_AUDIT') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`BIOMETRIC AUDIT REPORT: ${data.month || 'N/A'}`, 15, 80);
    doc.setFontSize(11);
    doc.text("STATION:", 15, 90); doc.setFont("helvetica", "normal"); doc.text(data.lga || 'N/A', 75, 90);
    doc.setFont("helvetica", "bold"); doc.text("CLEARED:", 15, 97); doc.setFont("helvetica", "normal"); doc.text(String(data.clearedCount || 0), 75, 97);
    doc.setFont("helvetica", "bold"); doc.text("FLAGGED/DEFAULTERS:", 15, 104); doc.setFont("helvetica", "normal"); doc.text(String(data.unclearedList?.length || 0), 75, 104);
    
    if (data.unclearedList && data.unclearedList.length > 0) {
      doc.setFont("helvetica", "bold"); doc.text("DEFAULTER LISTING:", 15, 115);
      const rows = data.unclearedList.map((u: any) => [u.name, u.code, u.reason || 'Biometric default']);
      (doc as any).autoTable({
        startY: 120, head: [['Name', 'State Code', 'Reason']], body: rows, theme: 'grid',
        headStyles: { fillColor: [0, 77, 64] }, styles: { fontSize: 9 }
      });
    }
  } else if (type === 'DISCIPLINARY_QUERY') {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const refNum = `REF: NYSC/KTS/DZ/ADM/Q/${data.id ? data.id.substring(0, 6).toUpperCase() : Math.floor(100000 + Math.random() * 900000)}`;
    doc.text(refNum, 15, 75);
    
    // Address Block
    let y = 85;
    doc.text("TO:", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.name).toUpperCase(), 35, y);
    
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("State Code:", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.code || data.stateCode).toUpperCase(), 40, y);
    
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("PPA:", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.ppa || 'NOT RECORDED').toUpperCase(), 30, y);
    
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.text("LGA:", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${data.lga}`, 30, y);
    
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.text(`Daura Zone`, 15, y);

    // Subject Line
    y += 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const auditMonth = data.month || "CURRENT MONTH";
    const subject = `QUERY FOR BIOMETRIC CLEARANCE DEFAULT (${auditMonth})`;
    doc.text(subject, pageWidth / 2, y, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(20, y + 2, pageWidth - 20, y + 2);

    // Narrative Body
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const letterBody = data.responseContent || data.letterText || `The Management of the NYSC has noted your failure to participate in the mandatory biometric clearance for ${auditMonth}, in violation of the NYSC Act and Bye-Laws. You are hereby directed to submit a written explanation within 48 hours of receipt of this query, stating why disciplinary action should not be taken against you. Please note that sanctions for such default, as provided under the NYSC Bye-Laws (Revised 2011), may include extension of service without pay. Kindly treat this matter as urgent.`;
    const splitBody = doc.splitTextToSize(letterBody, pageWidth - 30);
    doc.text(splitBody, 15, y);

    // Signature Block
    const signY = pageHeight - 55;
    doc.setFont("helvetica", "bold");
    doc.text("Zonal Inspector", 15, signY);
    doc.setFont("helvetica", "normal");
    doc.text("For: State Coordinator", 15, signY + 7);
  }

  const footerY = pageHeight - 15;
  doc.setLineWidth(1); doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
  doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Email: nyscdaurazone@gmail.com", pageWidth / 2, footerY + 2, { align: "center" });
  doc.save(`NYSC_QUERY_${(data.code || data.stateCode || 'DOC').replace(/\//g, '_')}.pdf`);
};
