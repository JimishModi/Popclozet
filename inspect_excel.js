import XLSX from 'xlsx';

const filePath = 'd:\\PopClozet\\PopCLozet-Apps\\supabase\\Product_details\\Product table.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheet Names:', JSON.stringify(workbook.SheetNames));

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (data && data.length > 0) {
            console.log(`\n=== SHEET: ${sheetName} ===`);
            console.log('Columns:', JSON.stringify(data[0]));
        }
    });
} catch (error) {
    console.log('Error:', error.message);
}

