
export function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) {
    // Fix: Use (window as any).alert to avoid 'Cannot find name alert' error
    (window as any).alert("No data to export.");
    return;
  }

  const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object' || Array.isArray(data[0][k]));
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  // Fix: Use (window as any).document to satisfy environment where global document is not defined
  const link = (window as any).document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  // Fix: Use (window as any).document to satisfy environment where global document is not defined
  (window as any).document.body.appendChild(link);
  link.click();
  // Fix: Use (window as any).document to satisfy environment where global document is not defined
  (window as any).document.body.removeChild(link);
}

export function shareData(title: string, text: string) {
  // Fix: Use (window as any).navigator to access share and clipboard functionality
  const nav = (window as any).navigator;
  // Fix: Use (window as any).location for URL access
  const loc = (window as any).location;

  if (nav && nav.share) {
    nav.share({
      title: title,
      text: text,
      url: loc.href,
    }).catch(console.error);
  } else {
    // Fallback: Copy to clipboard
    // Fix: Use (window as any).navigator.clipboard
    if (nav && nav.clipboard) {
      nav.clipboard.writeText(`${title}\n\n${text}\n\nView at: ${loc.href}`);
    }
    // Fix: Use (window as any).alert to avoid 'Cannot find name alert' error
    (window as any).alert("Summary copied to clipboard!");
  }
}
