import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const generateOfficialPDF = (data: any, type: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Official NYSC Color Palette based on image
  const nyscGreen = [0, 102, 51]; // Deep Green
  const nyscRed = [153, 0, 51];   // Burgundy/Red for Secretariat
  
  // 1. MAIN HEADER
  doc.setTextColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("NATIONAL YOUTH SERVICE CORPS", pageWidth / 2 + 10, 20, { align: "center" });
  
  doc.setTextColor(nyscRed[0], nyscRed[1], nyscRed[2]);
  doc.setFontSize(14);
  doc.text("KATSINA STATE SECRETARIAT", pageWidth / 2 + 10, 28, { align: "center" });

  // 2. OFFICIAL STRIPES (Top Design)
  const topBarY = 32;
  doc.setLineWidth(1.5);
  doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, topBarY, pageWidth - 10, topBarY);
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0); // Black thin line
  doc.line(10, topBarY + 2, pageWidth - 10, topBarY + 2);

  // 3. ADDRESS BLOCK (Right Aligned)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const addressX = pageWidth - 15;
  let currentY = 42;
  doc.text("Federal Secretariat Complex", addressX, currentY, { align: "right" });
  currentY += 5;
  doc.text("Kano Road,", addressX, currentY, { align: "right" });
  currentY += 5;
  doc.text("P.M.B. 2034 Katsina,", addressX, currentY, { align: "right" });
  currentY += 5;
  doc.text("Katsina State, Nigeria.", addressX, currentY, { align: "right" });

  // 4. REFERENCE & DATE LINE
  currentY += 15;
  doc.setFont("helvetica", "bold");
  const refNum = data.refNum || `NYSC/KTS/DZ/ADM/Q/${data.id ? data.id.substring(0, 6).toUpperCase() : Math.floor(100000 + Math.random() * 900000)}`;
  doc.text(refNum, 15, currentY);
  
  doc.setFont("helvetica", "normal");
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(dateStr, pageWidth - 15, currentY, { align: "right" });

  // 5. CONTENT SECTION
  if (type === 'SINGLE_CWHS') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("CORPS MEMBER STATUS BRIEF", 15, currentY + 15);
    doc.setFontSize(11);
    doc.text("NAME:", 15, currentY + 30); doc.setFont("helvetica", "normal"); doc.text(String(data.name || 'N/A').toUpperCase(), 75, currentY + 30);
    doc.setFont("helvetica", "bold"); doc.text("STATE CODE:", 15, currentY + 37); doc.setFont("helvetica", "normal"); doc.text(String(data.stateCode || 'N/A').toUpperCase(), 75, currentY + 37);
    doc.setFont("helvetica", "bold"); doc.text("STATION:", 15, currentY + 44); doc.setFont("helvetica", "normal"); doc.text(String(data.lga || 'N/A'), 75, currentY + 44);
    doc.setFont("helvetica", "bold"); doc.text("CATEGORY:", 15, currentY + 51); doc.setFont("helvetica", "normal"); doc.text(String(data.category || 'N/A').toUpperCase(), 75, currentY + 51);
    doc.setFont("helvetica", "bold"); doc.text("DETAILS:", 15, currentY + 65); doc.setFont("helvetica", "italic");
    const detailsText = data.details || "No details provided.";
    const splitDetails = doc.splitTextToSize(detailsText, pageWidth - 30);
    doc.text(splitDetails, 15, currentY + 72);
  } else if (type === 'CDR_CASE') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("DISCIPLINARY CASE RECORD", 15, currentY + 15);
    doc.setFontSize(11);
    doc.text("PERSONNEL:", 15, currentY + 30); doc.setFont("helvetica", "normal"); doc.text(`${data.name || 'N/A'} (${data.stateCode || 'N/A'})`, 75, currentY + 30);
    doc.setFont("helvetica", "bold"); doc.text("LGA/STATION:", 15, currentY + 37); doc.setFont("helvetica", "normal"); doc.text(data.lga || 'N/A', 75, currentY + 37);
    doc.setFont("helvetica", "bold"); doc.text("PPA:", 15, currentY + 44); doc.setFont("helvetica", "normal"); doc.text(data.ppa || 'N/A', 75, currentY + 44);
    doc.setFont("helvetica", "bold"); doc.text("CASE STATUS:", 15, currentY + 51); doc.setFont("helvetica", "normal"); doc.text(String(data.status || 'Pending').replace(/_/g, ' ').toUpperCase(), 75, currentY + 51);
    doc.setFont("helvetica", "bold"); doc.text("MISCONDUCT:", 15, currentY + 65); doc.setFont("helvetica", "italic");
    const misDetails = data.misconduct || "N/A";
    const splitMis = doc.splitTextToSize(misDetails, pageWidth - 30);
    doc.text(splitMis, 15, currentY + 72);
  } else if (type === 'CIM_AUDIT') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`BIOMETRIC AUDIT REPORT: ${data.month || 'N/A'}`, 15, currentY + 15);
    doc.setFontSize(11);
    doc.text("STATION:", 15, currentY + 25); doc.setFont("helvetica", "normal"); doc.text(data.lga || 'N/A', 75, currentY + 25);
    doc.setFont("helvetica", "bold"); doc.text("CLEARED:", 15, currentY + 32); doc.setFont("helvetica", "normal"); doc.text(String(data.clearedCount || 0), 75, currentY + 32);
    doc.setFont("helvetica", "bold"); doc.text("FLAGGED/DEFAULTERS:", 15, currentY + 39); doc.setFont("helvetica", "normal"); doc.text(String(data.unclearedList?.length || 0), 75, currentY + 39);
    
    if (data.unclearedList && data.unclearedList.length > 0) {
      doc.setFont("helvetica", "bold"); doc.text("DEFAULTER LISTING:", 15, currentY + 50);
      const rows = data.unclearedList.map((u: any) => [u.name, u.code, u.reason || 'Biometric default']);
      (doc as any).autoTable({
        startY: currentY + 55, head: [['Name', 'State Code', 'Reason']], body: rows, theme: 'grid',
        headStyles: { fillColor: [0, 77, 64] }, styles: { fontSize: 9 }
      });
    }
  } else if (type === 'DISCIPLINARY_QUERY') {
    // Subject Line
    let subjectY = currentY + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const auditMonth = data.month || "CURRENT MONTH";
    const subject = `QUERY FOR BIOMETRIC CLEARANCE DEFAULT (${auditMonth})`;
    doc.text(subject, pageWidth / 2, subjectY, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line( pageWidth / 2 - 50, subjectY + 1, pageWidth / 2 + 50, subjectY + 1);

    // Salutation & Body
    let bodyY = subjectY + 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`To: ${String(data.name).toUpperCase()}`, 15, bodyY);
    bodyY += 6;
    doc.text(`State Code: ${String(data.code || data.stateCode).toUpperCase()}`, 15, bodyY);
    bodyY += 6;
    doc.text(`PPA: ${String(data.ppa || 'NOT RECORDED').toUpperCase()}`, 15, bodyY);
    bodyY += 15;

    const letterBody = data.responseContent || data.letterText || `The Management of the NYSC has noted your failure to participate in the mandatory biometric clearance for ${auditMonth}, in violation of the NYSC Act and Bye-Laws. You are hereby directed to submit a written explanation within 48 hours of receipt of this query, stating why disciplinary action should not be taken against you. Please note that sanctions for such default, as provided under the NYSC Bye-Laws (Revised 2011), may include extension of service without pay. Kindly treat this matter as urgent.`;
    const splitBody = doc.splitTextToSize(letterBody, pageWidth - 30);
    doc.text(splitBody, 15, bodyY);

    // Signature Block (Matching image style)
    const signY = pageHeight - 50;
    doc.setFont("helvetica", "bold");
    doc.text("Ibrahim Saidu", pageWidth - 15, signY, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text("State Coordinator", pageWidth - 15, signY + 6, { align: "right" });
  }

  // Footer
  const footerY = pageHeight - 15;
  doc.setLineWidth(0.5);
  doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text("Generated by NYSC Katsina Secretariat Portal", pageWidth / 2, footerY, { align: "center" });

  doc.save(`NYSC_Official_${(data.code || data.stateCode || 'DOC').replace(/\//g, '_')}.pdf`);
};