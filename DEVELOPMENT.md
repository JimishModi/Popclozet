# Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Mapbox account
- Git

### Initial Setup

1. **Clone and install**:
   ```bash
   cd APP1_popclozet
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Database setup**:
   - Follow instructions in `supabase/README.md`
   - Run migration: `supabase/migrations/20260118_initial_schema.sql`

4. **Generate PWA icons**:
   ```bash
   npm install --save-dev sharp
   # Place logo.png in public/
   node scripts/generate-icons.js
   ```

5. **Start development**:
   ```bash
   npm run dev
   ```

## Project Structure

```
APP1_popclozet/
├── public/              # Static assets
│   ├── icons/          # PWA icons
│   └── manifest.json   # PWA manifest
├── scripts/            # Build and utility scripts
├── src/
│   ├── components/     # React components
│   │   ├── ui/        # Base UI components
│   │   ├── layout/    # Layout components
│   │   └── features/  # Feature components
│   ├── contexts/      # React contexts
│   ├── hooks/         # Custom hooks
│   ├── pages/         # Route pages
│   ├── services/      # API services
│   ├── types/         # TypeScript types
│   ├── utils/         # Utility functions
│   ├── App.tsx        # Root component
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles
├── supabase/          # Supabase config
│   ├── migrations/    # Database migrations
│   └── README.md      # Setup guide
└── README.md          # Project documentation
```

## Development Workflow

### Adding a New Feature

1. **Create types** in `src/types/index.ts`
2. **Create service** in `src/services/` if needed
3. **Create components** in `src/components/features/`
4. **Create page** in `src/pages/`
5. **Add route** in `src/App.tsx`
6. **Update task.md** to track progress

### Component Guidelines

- Use TypeScript for all components
- Follow naming convention: `ComponentName.tsx`
- Export as named export
- Add prop types interface
- Use Tailwind for styling
- Add Framer Motion for animations

### State Management

- **Global state**: Use React Context
- **Local state**: Use useState
- **Server state**: Fetch from Supabase
- **Form state**: Use controlled components

### Styling

- Use Tailwind utility classes
- Follow design system in `tailwind.config.js`
- Use custom classes from `index.css`
- Responsive: mobile-first approach

## Testing

### Manual Testing Checklist

- [ ] Authentication flow
- [ ] Product browsing and search
- [ ] Add to cart with timer
- [ ] Checkout process
- [ ] Order tracking
- [ ] Map activation at 1km
- [ ] OTP confirmation
- [ ] Return request
- [ ] Profile management
- [ ] Offline mode

### Browser Testing

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

### PWA Testing

1. Build: `npm run build`
2. Preview: `npm run preview`
3. Open DevTools > Application
4. Check manifest, service worker, cache
5. Test offline mode
6. Test "Add to Home Screen"

## Common Tasks

### Update Dependencies
```bash
npm update
npm audit fix
```

### Build for Production
```bash
npm run build
# Output in dist/
```

### Preview Production Build
```bash
npm run preview
# Opens on http://localhost:4173
```

### Lint Code
```bash
npm run lint
```

### Generate Icons
```bash
node scripts/generate-icons.js
```

## Debugging

### Common Issues

**Supabase Connection Error**
- Check .env variables
- Verify Supabase project is active
- Check network connection

**Map Not Showing**
- Verify Mapbox token
- Check proximity logic (distance > 1km)
- Check browser console for errors

**Cart Timer Not Working**
- Check system time
- Verify reservation_expires_at in database
- Check browser console

**PWA Not Installing**
- Verify HTTPS (required for PWA)
- Check manifest.json
- Verify service worker registration
- Check icons exist

### Debug Tools

- React DevTools
- Redux DevTools (if using Redux)
- Supabase Dashboard
- Browser DevTools Network tab
- Console logs

## Performance Optimization

### Code Splitting
- Use React.lazy() for route-based splitting
- Lazy load heavy components

### Image Optimization
- Use WebP format
- Lazy load images
- Use appropriate sizes

### Bundle Size
- Analyze with `npm run build`
- Remove unused dependencies
- Use tree-shaking

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Netlify

```bash
# Build command
npm run build

# Publish directory
dist
```

### Environment Variables

Set in deployment platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_MAPBOX_ACCESS_TOKEN`

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add feature description"

# Push to remote
git push origin feature/your-feature

# Create pull request
```

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [Framer Motion](https://www.framer.com/motion/)

## Support

For issues or questions:
1. Check existing documentation
2. Search GitHub issues
3. Contact development team
