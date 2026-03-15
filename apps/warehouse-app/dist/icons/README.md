# PWA Icon Setup

## Quick Setup

### Option 1: Use Icon Generator Script

1. **Install sharp** (image processing library):
   ```bash
   npm install --save-dev sharp
   ```

2. **Create your logo**:
   - Create a 1024x1024 PNG file
   - Save it as `public/logo.png`
   - Use transparent background or solid color

3. **Run the generator**:
   ```bash
   node scripts/generate-icons.js
   ```

4. **Icons will be created** in `public/icons/`:
   - `icon-192x192.png`
   - `icon-512x512.png`

### Option 2: Manual Creation

Create these files manually in `public/icons/`:

- **icon-192x192.png** - 192x192 pixels
- **icon-512x512.png** - 512x512 pixels

### Option 3: Use Online Generator

1. Visit [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. Upload your logo
3. Download generated icons
4. Place in `public/icons/`

## Design Guidelines

### Logo Requirements
- **Size**: 1024x1024 pixels minimum
- **Format**: PNG with transparency
- **Content**: Should be recognizable at small sizes
- **Padding**: Leave 10-15% padding around edges

### Color Scheme
- **Primary**: #8B5CF6 (Purple)
- **Secondary**: #EC4899 (Pink)
- **Background**: White or transparent

### Icon Checklist
- [ ] Logo is clear and recognizable
- [ ] Works on both light and dark backgrounds
- [ ] No text smaller than 12pt
- [ ] Adequate padding around edges
- [ ] Tested on actual device

## Testing Icons

### Chrome DevTools
1. Open DevTools (F12)
2. Go to Application > Manifest
3. Check if icons load correctly

### Real Device
1. Build the app: `npm run build`
2. Serve: `npm run preview`
3. Open on mobile device
4. Add to home screen
5. Check icon appearance

## Troubleshooting

### Icons Not Showing
- Clear browser cache
- Check file paths in manifest.json
- Verify file sizes match manifest
- Ensure files are in public/icons/

### Icons Look Blurry
- Use higher resolution source
- Ensure PNG format
- Check compression settings

### Wrong Colors
- Verify theme_color in manifest.json
- Check background_color setting
- Test on different devices
