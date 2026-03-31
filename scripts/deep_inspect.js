import XLSX from 'xlsx';
const workbook = XLSX.readFile('supabase/Product_details/Product table.xlsx');
workbook.SheetNames.forEach((name, i) => {
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
    if (data.length > 0) {
        console.log(`Sheet ${i} (${name}) KEYS:`, JSON.stringify(Object.keys(data[0])));
        console.log(`Sheet ${i} (${name}) SAMPLE ROW:`, JSON.stringify(data[0]));
    } else {
        console.log(`Sheet ${i} (${name}) is EMPTY`);
    }
});
