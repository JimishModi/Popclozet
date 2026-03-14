const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const extract = async () => {
    try {
        const termsPath = path.join(__dirname, 'docs', 'Terms & condition_popclozet.pdf');
        const cookiesPath = path.join(__dirname, 'docs', 'Cookies policy.pdf');
        
        const termsBuf = fs.readFileSync(termsPath);
        const cookiesBuf = fs.readFileSync(cookiesPath);
        
        const terms = await pdf(termsBuf);
        const cookies = await pdf(cookiesBuf);
        
        const formatString = (str) => {
            return str
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')
                .replace(/\$/g, '\\$')
                .replace(/\r\n/g, '\n')
                .replace(/\n\n+/g, '\n\n')
                .trim();
        };

        const tsContent = `export const TERMS_AND_CONDITIONS = \`\n${formatString(terms.text)}\n\`;\n\nexport const COOKIE_POLICY = \`\n${formatString(cookies.text)}\n\`;\n`;
        
        const outDir = path.join(__dirname, 'apps', 'customer-app', 'src', 'constants');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(outDir, 'legalDocs.ts'), tsContent);
        console.log("TS constants successfully generated at", path.join(outDir, 'legalDocs.ts'));
    } catch (err) {
        console.error("Extraction failed:", err);
        process.exit(1);
    }
}

extract();
