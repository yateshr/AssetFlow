export interface ReportSection {
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

interface ExcelReportOptions {
  title: string;
  subtitle?: string;
  generatedBy?: string;
  sections: ReportSection[];
}

function escapeCell(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportExcelReport(options: ExcelReportOptions, filename: string) {
  const generatedAt = new Date().toLocaleString();
  const sections = options.sections.map(section => `
    <h2>${escapeCell(section.title)}</h2>
    <table>
      <thead>
        <tr>${section.headers.map(header => `<th>${escapeCell(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${section.rows.map(row => `
          <tr>${row.map(cell => `<td>${escapeCell(cell)}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `).join('');

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #111827; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          h2 { margin: 24px 0 8px; font-size: 16px; color: #1f2937; }
          .meta { margin-bottom: 18px; color: #4b5563; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
          th { background: #111827; color: #ffffff; font-weight: 700; }
          th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
          tr:nth-child(even) td { background: #f9fafb; }
        </style>
      </head>
      <body>
        <h1>${escapeCell(options.title)}</h1>
        <div class="meta">
          ${options.subtitle ? `${escapeCell(options.subtitle)}<br />` : ''}
          Generated ${escapeCell(generatedAt)}
          ${options.generatedBy ? ` by ${escapeCell(options.generatedBy)}` : ''}
        </div>
        ${sections}
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  downloadBlob(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}
