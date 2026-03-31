import XLSX from 'xlsx';
import path from 'path';

const workbook = XLSX.readFile('supabase/Product_details/Product table.xlsx');
console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\nSheet: ${sheetName}`);
  console.log('Sample Data (First 3 rows):');
  console.log(data.slice(0, 3));
});
