const fs = require('fs');
const files = [
    'packages/ui/package.json',
    'packages/mapbox-core/package.json',
    'packages/domain-contracts/package.json',
    'packages/auth/package.json',
    'packages/api-client/package.json'
];

files.forEach(f => {
    try {
        const filePath = 'c:\\Users\\reddy\\Downloads\\PopCLozet-Apps\\' + f;
        let content = fs.readFileSync(filePath, 'utf8');
        content = content.replace(/"main": "src\/index\.js"/g, '"main": "src/index.ts"');
        content = content.replace(/"types": "src\/index\.d\.ts"/g, '"types": "src/index.ts"');
        content = content.replace(/"\.\/src\/index\.d\.ts"/g, '"./src/index.ts"');
        content = content.replace(/"\.\/src\/index\.js"/g, '"./src/index.ts"');
        fs.writeFileSync(filePath, content);
        console.log('Fixed', f);
    } catch (e) {
        console.error('Error with', f, e.message);
    }
});
