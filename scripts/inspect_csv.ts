import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

const CSV_FILE_PATH = path.resolve(process.cwd(), 'supabase/Product_details/Product_details.csv');
let printed = false;

fs.createReadStream(CSV_FILE_PATH)
  .pipe(csv())
  .on('data', (data: any) => {
    if (!printed) {
      const headers = Object.keys(data);
      const lines: string[] = [];
      lines.push('HEADERS:');
      headers.forEach((h, i) => lines.push(`[${i}] => ${JSON.stringify(h)}`));
      lines.push('');
      lines.push('VALUES:');
      headers.forEach((h, i) => lines.push(`[${i}] ${JSON.stringify(h)} => ${JSON.stringify(data[h])}`));
      fs.writeFileSync('scripts/csv_debug.txt', lines.join('\n'), 'utf-8');
      console.log('Written to scripts/csv_debug.txt');
      printed = true;
    }
  })
  .on('end', () => console.log('Done.'));
