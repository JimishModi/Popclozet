const fs = require('fs');
const f = 'c:\\Users\\reddy\\Downloads\\PopCLozet-Apps\\apps\\customer-app\\src\\config\\products.ts';
let c = fs.readFileSync(f, 'utf8');

const fits = ['Slim', 'Regular', 'Relaxed'];
const stretches = ['None', 'Low', 'Medium', 'High'];
const fabrics = [
    '100% Polyester', 'Cotton Blend', '100% Silk', 'Wool Blend',
    '100% Cotton', 'Velvet', 'Chiffon', 'Denim', 'Linen Blend', 'Satin'
];

let i = 0;
c = c.replace(/color: "(\w+)"(, video: "[^"]+")?( },?)/g, (match, color, video, ending) => {
    if (match.includes('hygieneCertified')) return match;
    const fit = fits[i % 3];
    const stretch = stretches[i % 4];
    const fabric = fabrics[i % 10];
    i++;
    const videoStr = video || '';
    return `color: "${color}"${videoStr}, hygieneCertified: true, fitType: "${fit}", stretchLevel: "${stretch}", fabricComposition: "${fabric}"${ending}`;
});

fs.writeFileSync(f, c);
console.log('Updated', i, 'products');
