import XLSX from 'xlsx';
const workbook = XLSX.readFile('supabase/Product_details/Product table.xlsx');
workbook.SheetNames.forEach((name, i) => {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
    console.log(`Sheet ${i} (${name}) - First Row:`, JSON.stringify(data[0]));
});
