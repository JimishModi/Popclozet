# PWA Icons Placeholder

The PWA icons directory has been created at `/public/icons/`.

## Required Icons

To complete the PWA setup, you need to add the following icon files:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png` ⭐ (Required for PWA)
- `icon-384x384.png`
- `icon-512x512.png` ⭐ (Required for PWA)
- `icon-maskable-192x192.png`
- `icon-maskable-512x512.png` ⭐ (Required for maskable icons)

## How to Create Icons

### Option 1: Use an Online Tool
1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload your logo/icon (square, at least 512x512px)
3. Download the generated icon pack
4. Extract and copy all icons to `/public/icons/`

### Option 2: Use Existing Favicon
If you have a favicon.ico in `/public/`, you can:
1. Convert it to PNG at various sizes using an online converter
2. Save them with the filenames above

### Option 3: Create Manually
Design a square icon (512x512px) with:
- PopClozet branding
- Indigo/purple gradient background (#6366f1)
- Simple, recognizable symbol (hanger, "P", or clothing item)
- Padding around edges for maskable icons

## Temporary Solution

For now, the PWA will work but may show a default icon. The app is fully functional with offline support, caching, and installability - just missing custom icons.
