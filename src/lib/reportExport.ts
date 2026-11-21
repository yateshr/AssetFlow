import * as XLSX from 'xlsx';
export interface ReportSection { title: string; headers: string[]; rows: Array<Array<string | number>>; }
interface ExcelReportOptions { title: string; subtitle?: string; generatedBy?: string; sections: ReportSection[]; }
const sheetName=(value:string,index:number)=>`${index+1}-${value}`.replace(/[\\/*?:\[\]]/g,'').slice(0,31);
export function exportExcelReport(options: ExcelReportOptions, filename: string) {
  const workbook=XLSX.utils.book_new();
  options.sections.forEach((section,index)=>{const width=Math.max(0,section.headers.length-1);const sheet=XLSX.utils.aoa_to_sheet([[options.title],[options.subtitle||''],[`Generated ${new Date().toLocaleString()}${options.generatedBy?` by ${options.generatedBy}`:''}`],[],section.headers,...section.rows]);sheet['!merges']=[XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(width)}1`),XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(width)}2`)];sheet['!cols']=section.headers.map((header,column)=>({wch:Math.min(42,Math.max(14,header.length,...section.rows.map(row=>String(row[column]??'').length)+2))}));XLSX.utils.book_append_sheet(workbook,sheet,sheetName(section.title,index));});
  XLSX.writeFile(workbook,filename.endsWith('.xlsx')?filename:`${filename.replace(/\.xls$/i,'')}.xlsx`);
}
