const XLSX = require('xlsx');
const path = require('path');

const headers = [
    'SKU', 'Name', 'Brand', 'Category', 'Gender', 'Event Category', 
    'Occasions', 'Rental Price', 'Deposit Amount', 'MRP', 'Color', 
    'Sizes', 'Stock Units', 'Fabric Type', 'Wash Care', 'Description'
];

const sampleData = [
    [
        'DRS-SILK-001', 'Hand-Stitched Silk Evening Gown', 'PopClozet Luxe', 
        'Dresses', 'women', 'Wedding', 'Wedding, Reception, Party', 
        '550', '2000', '15000', 'Emerald Green', 'S, M, L', 'S=2, M=3, L=1', 
        'Pure Silk', 'Dry Clean Only', 'A stunning silk gown for high-end events.'
    ],
    [
        'ACC-GOLD-BNG', 'Gold Plated Bangle Set', 'PopClozet Accs', 
        'Accessories', 'women', 'Wedding', 'Wedding, Sangeet', 
        '100', '500', '3500', 'Gold', 'M, L', 'M=10, L=5', 
        'Gold Plated Metal', 'Wipe with Dry Cloth', 'Perfect for traditional wear.'
    ]
];

const data = [headers, ...sampleData];
const ws = XLSX.utils.aoa_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "ProductUpload");

// Save to workspace for user access
const filePath = 'd:/PopClozet/PopCLozet-Apps/Product_Upload_Template.xlsx';
XLSX.writeFile(wb, filePath);
console.log(`✅ Template created at: ${filePath}`);
