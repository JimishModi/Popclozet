import XLSX from 'xlsx';
const workbook = XLSX.readFile('supabase/Product_details/Product table.xlsx');
workbook.SheetNames.forEach((name, i) => {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
    if (data.length > 0) {
        console.log(`\nSHEET ${i}: ${name}`);
        console.log('KEYS:', Object.keys(data[0]));
    }
});
