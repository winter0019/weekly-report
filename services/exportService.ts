
export function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) {
    alert("No data to export.");
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
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function shareData(title: string, text: string) {
  if (navigator.share) {
    navigator.share({
      title: title,
      text: text,
      url: window.location.href,
    }).catch(console.error);
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(`${title}\n\n${text}\n\nView at: ${window.location.href}`);
    alert("Summary copied to clipboard!");
  }
}
