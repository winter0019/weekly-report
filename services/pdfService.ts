
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export const generateOfficialPDF = (data: any, type: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // --- Header Reproduction (Matching Provided Letterhead Image) ---
  
  // Colors accurately derived from NYSC branding
  const nyscGreen = [0, 168, 89]; // #00A859
  const nyscRed = [237, 28, 36];   // #ED1C24
  const nyscGold = [184, 134, 11]; // Metallic Gold
  
  // 1. Main Heading
  doc.setTextColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("NATIONAL YOUTH SERVICE CORPS", pageWidth / 2, 20, { align: "center" });
  
  // 2. Office Line
  doc.setTextColor(nyscRed[0], nyscRed[1], nyscRed[2]);
  doc.setFontSize(12);
  doc.text("Office of the Zonal Inspector, Daura Zonal Office", pageWidth / 2, 28, { align: "center" });

  // 3. Address Block (Right Aligned as per image)
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const rightX = pageWidth - 15;
  doc.text("Beside Daura Emirate Council", rightX, 38, { align: "right" });
  doc.text("Kangiwa Office Complex", rightX, 43, { align: "right" });
  doc.text("Daura, Katsina State", rightX, 48, { align: "right" });

  // 4. Decorative Triple Horizontal Bars (Header)
  const barY = 55;
  const barThickness = 1.2;
  doc.setLineWidth(barThickness);
  
  // Green bar
  doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, barY, pageWidth - 10, barY);
  
  // Black bar
  doc.setDrawColor(0, 0, 0);
  doc.line(10, barY + barThickness, pageWidth - 10, barY + barThickness);
  
  // Gold bar
  doc.setDrawColor(nyscGold[0], nyscGold[1], nyscGold[2]);
  doc.line(10, barY + (barThickness * 2), pageWidth - 10, barY + (barThickness * 2));

  // --- Content Body ---
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Date: ${dateStr}`, pageWidth - 15, 70, { align: "right" });

  if (type === 'SINGLE_CWHS') {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("CORPS MEMBER STATUS BRIEF", 15, 80);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(15, 82, 90, 82);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("NAME OF CORPS MEMBER:", 15, 95);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.name).toUpperCase(), 75, 95);

    doc.setFont("helvetica", "bold");
    doc.text("STATE CODE:", 15, 102);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.stateCode).toUpperCase(), 75, 102);

    doc.setFont("helvetica", "bold");
    doc.text("STATION / LGA:", 15, 109);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.lga), 75, 109);

    doc.setFont("helvetica", "bold");
    doc.text("REPORT CATEGORY:", 15, 116);
    doc.setFont("helvetica", "normal");
    doc.text(String(data.category).toUpperCase(), 75, 116);
    
    doc.setFont("helvetica", "bold");
    doc.text("REMARKS / DETAILS:", 15, 130);
    doc.setFont("helvetica", "italic");
    const splitDetails = doc.splitTextToSize(data.details || "No further details provided by the reporting officer.", pageWidth - 30);
    doc.text(splitDetails, 15, 137);

  } else if (type === 'CDR_QUERY') {
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("INTERNAL MEMORANDUM / QUERY", pageWidth / 2, 80, { align: "center" });
    
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    const bodyText = data.responseContent || "No content generated.";
    const splitBody = doc.splitTextToSize(bodyText, pageWidth - 30);
    doc.text(splitBody, 15, 95);

  } else if (type === 'LEDGER') {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.title}`, 15, 80);
    
    (doc as any).autoTable({
      startY: 85,
      margin: { left: 15, right: 15 },
      head: [data.headers],
      body: data.rows,
      theme: 'grid',
      headStyles: { fillColor: [0, 77, 64], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 }
    });
  } else if (type === 'COMPREHENSIVE') {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.period} COMPREHENSIVE ZONAL REPORT`, pageWidth / 2, 80, { align: "center" });
    
    let currentY = 90;

    const sections = [
      { title: '1. CW&HS (Corps Welfare & Health Services)', headers: ['Name', 'Code', 'LGA', 'Category'], rows: data.sections.cwhs },
      { title: '2. CIM (Inspection & Monitoring)', headers: ['Month', 'LGA', 'Cleared', 'Defaulters'], rows: data.sections.cim },
      { title: '3. CD&R (Discipline & Reward)', headers: ['Name', 'Code', 'LGA', 'Status'], rows: data.sections.cdr },
      { title: '4. SAED (Skill Acquisition Hub)', headers: ['Center', 'LGA', 'Enrollment', 'Fee (N)'], rows: data.sections.saed },
      { title: '5. CDS (Community Development Groups)', headers: ['Group Name', 'LGA', 'Meeting Day'], rows: data.sections.cdsGroups },
      { title: '6. CDS (Personal Projects)', headers: ['CM Name', 'Code', 'Project Name', 'Status'], rows: data.sections.cdsProjects }
    ];

    sections.forEach((section) => {
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 77, 64);
      doc.text(section.title, 15, currentY);
      doc.setTextColor(0, 0, 0);
      
      (doc as any).autoTable({
        startY: currentY + 5,
        margin: { left: 15, right: 15 },
        head: [section.headers],
        body: section.rows && section.rows.length > 0 ? section.rows : [['No records found', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [0, 77, 64], textColor: 255 },
        styles: { fontSize: 8 },
        didDrawPage: (dt: any) => { currentY = dt.cursor.y + 15; }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    });
  }

  // --- Footer Reproduction ---
  
  const footerY = pageHeight - 15;
  
  // Decorative Bars (Footer)
  doc.setLineWidth(1);
  doc.setDrawColor(nyscGreen[0], nyscGreen[1], nyscGreen[2]);
  doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);
  doc.setDrawColor(nyscGold[0], nyscGold[1], nyscGold[2]);
  doc.line(10, footerY - 4, pageWidth - 10, footerY - 4);

  // Email & Contact Info
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Email: nyscdaurazone@gmail.com", pageWidth / 2, footerY + 2, { align: "center" });

  doc.save(`${type}_${data.period || 'REPORT'}_${Date.now()}.pdf`);
};
