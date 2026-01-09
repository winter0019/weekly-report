
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const generateOfficialPDF = (data: any, type: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const nyscGreen = [0, 168, 89];
  const nyscRed = [237, 28, 36];
  const nyscGold = [184, 134, 11];
  
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
    doc.text("NAME:", 15, 95); doc.setFont("helvetica", "normal"); doc.text(String(data.name).toUpperCase(), 75, 95);
    doc.setFont("helvetica", "bold"); doc.text("STATE CODE:", 15, 102); doc.setFont("helvetica", "normal"); doc.text(String(data.stateCode).toUpperCase(), 75, 102);
    doc.setFont("helvetica", "bold"); doc.text("STATION:", 15, 109); doc.setFont("helvetica", "normal"); doc.text(String(data.lga), 75, 109);
    doc.setFont("helvetica", "bold"); doc.text("CATEGORY:", 15, 116); doc.setFont("helvetica", "normal"); doc.text(String(data.category).toUpperCase(), 75, 116);
    doc.setFont("helvetica", "bold"); doc.text("DETAILS:", 15, 130); doc.setFont("helvetica", "italic");
    const splitDetails = doc.splitTextToSize(data.details || "No details provided.", pageWidth - 30);
    doc.text(splitDetails, 15, 137);
  } else if (type === 'LEDGER') {
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`${data.title}`, 15, 80);
    (doc as any).autoTable({
      startY: 85, margin: { left: 15, right: 15 },
      head: [data.headers], body: data.rows, theme: 'grid',
      headStyles: { fillColor: [0, 77, 64], textColor: 255 }, styles: { fontSize: 8 }
    });
  } else if (type === 'COMPREHENSIVE') {
    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.text(`${data.period} COMPREHENSIVE ZONAL REPORT`, pageWidth / 2, 80, { align: "center" });
    let currentY = 90;
    const sections = [
      { title: '1. CW&HS Registry (Corps Welfare)', headers: ['Name', 'Code', 'LGA', 'Category'], rows: data.sections.cwhs },
      { title: '2. CIM Audit & Monitoring', headers: ['Month', 'LGA', 'Cleared', 'Flagged'], rows: data.sections.cim },
      { title: '3. CD&R Disciplinary Cases', headers: ['Name', 'Code', 'LGA', 'Status'], rows: data.sections.cdr },
      { title: '4. SAED Training Hubs', headers: ['Center', 'LGA', 'Enrollment', 'Fee'], rows: data.sections.saed }
    ];
    sections.forEach((s) => {
      if (currentY > pageHeight - 50) { doc.addPage(); currentY = 20; }
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 77, 64);
      doc.text(s.title, 15, currentY); doc.setTextColor(0, 0, 0);
      (doc as any).autoTable({
        startY: currentY + 5, head: [s.headers], body: s.rows && s.rows.length > 0 ? s.rows : [['No records', '', '', '']],
        theme: 'grid', headStyles: { fillColor: [0, 77, 64] }, styles: { fontSize: 8 },
        didDrawPage: (dt: any) => { currentY = dt.cursor.y + 15; }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    });
  }

  const footerY = pageHeight - 15;
  doc.setLineWidth(1); doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
  doc.setTextColor(0, 0, 0); doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Email: nyscdaurazone@gmail.com", pageWidth / 2, footerY + 2, { align: "center" });
  doc.save(`NYSC_Daura_Zonal_Report_${Date.now()}.pdf`);
};
