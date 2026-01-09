
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
    doc.text(`Ref: NYSC/KTS/DZ/ADM/Q/${Date.now().toString().slice(-6)}`, 15, 75);
    
    doc.text("To:", 15, 85);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.name).toUpperCase(), 30, 85);
    doc.text(String(data.code).toUpperCase(), 30, 90);
    doc.text(`${data.lga} Zonal Command`, 30, 95);

    doc.setFont("helvetica", "bold");
    const subject = "INTERNAL MEMORANDUM: QUERY FOR BIOMETRIC CLEARANCE DEFAULT";
    doc.text(subject, pageWidth / 2, 110, { align: "center" });
    doc.line(30, 112, pageWidth - 30, 112);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const letterBody = data.letterText || "Formal query regarding your absence from the monthly biometric clearance exercise.";
    const splitBody = doc.splitTextToSize(letterBody, pageWidth - 30);
    doc.text(splitBody, 15, 125);

    const signY = pageHeight - 60;
    doc.setFont("helvetica", "bold");
    doc.text("__________________________", 15, signY);
    doc.text("For: Zonal Inspector", 15, signY + 7);
    doc.text("NYSC Daura Zonal Office", 15, signY + 14);
  }

  const footerY = pageHeight - 15;
  doc.setLineWidth(1); doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
  doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Email: nyscdaurazone@gmail.com", pageWidth / 2, footerY + 2, { align: "center" });
  doc.save(`NYSC_Official_Document_${Date.now()}.pdf`);
};
