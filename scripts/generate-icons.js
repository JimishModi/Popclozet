#!/usr/bin/env node

/**
 * PWA Icon Generator Script
 * 
 * This script generates PWA icons from a source image.
 * 
 * Usage:
 * 1. Place your source logo (1024x1024 PNG) in public/logo.png
 * 2. Run: node scripts/generate-icons.js
 * 3. Icons will be generated in public/icons/
 * 
 * Requirements:
 * npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const sourceImage = path.join(__dirname, '../public/logo.png');
const outputDir = path.join(__dirname, '../public/icons');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Check if source image exists
if (!fs.existsSync(sourceImage)) {
    console.error('❌ Source image not found at public/logo.png');
    console.log('📝 Please create a 1024x1024 PNG logo file at public/logo.png');
    process.exit(1);
}

// Generate icons
async function generateIcons() {
    console.log('🎨 Generating PWA icons...\n');

    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

        try {
            await sharp(sourceImage)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 139, g: 92, b: 246, alpha: 1 } // Primary purple color
                })
                .png()
                .toFile(outputPath);

            console.log(`✅ Generated ${size}x${size} icon`);
        } catch (error) {
            console.error(`❌ Error generating ${size}x${size} icon:`, error.message);
        }
    }

    console.log('\n✨ Icon generation complete!');
    console.log('📁 Icons saved to public/icons/');
}

generateIcons().catch(console.error);
