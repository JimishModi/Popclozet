# PopClozet Customer Application

Production-grade customer PWA for PopClozet rental fashion platform with Zepto-style delivery experience.

## 🚀 Features

### Core Features
- **Authentication**: Secure customer-only authentication with Supabase
- **Product Discovery**: NLP-powered search with occasion-based filtering
- **Smart Cart**: 15-minute reservation timer with auto-expiry
- **Seamless Checkout**: Address management and rental period selection
- **Zepto-Style Delivery**: Proximity-based map activation
- **OTP Confirmation**: Secure delivery and return confirmation
- **Return Workflow**: Easy return request with pickup scheduling
- **PWA Support**: Offline-first with background sync

### Unique Zepto-Style Map Logic
- **Default View**: ETA countdown + Order timeline (NO map)
- **Map Activation**: Only when rider distance ≤ 1km
- **Arriving Soon**: Special UI when distance ≤ 100m
- **Auto-Destroy**: Map removes after delivery completion
- **Battery Efficient**: Minimal resource usage

## 📦 Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, Database, Realtime, Storage)
- **Maps**: Mapbox GL JS (conditional rendering)
- **PWA**: vite-plugin-pwa with Workbox

## 🛠️ Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Mapbox account

### Installation

1. **Clone and install dependencies**:
```bash
cd APP1_popclozet
npm install
```

2. **Configure environment variables**:
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and add your credentials:
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

3. **Run development server**:
```bash
npm run dev
```

4. **Build for production**:
```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── layout/          # Header, Footer, Layout
│   ├── features/        # Feature-specific components
│   │   ├── products/    # Product cards, hygiene badges
│   │   ├── search/      # NLP search bar
│   │   ├── orders/      # Order timeline, ETA, Map, OTP
│   │   └── cart/        # Cart components
│   └── ProtectedRoute.tsx
├── pages/
│   ├── auth/            # Login, Signup
│   ├── products/        # Product list, detail
│   ├── cart/            # Cart page
│   ├── checkout/        # Checkout flow
│   ├── orders/          # Orders list, tracking, return
│   ├── profile/         # Profile management
│   └── HomePage.tsx
├── contexts/            # React contexts (Auth, Cart, Toast)
├── hooks/               # Custom hooks (geolocation, realtime)
├── services/            # API services (Supabase, Mapbox, Realtime)
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
└── styles/              # Global styles
```

## 🗄️ Database Schema

### Required Tables
- `profiles` - User profiles with role
- `addresses` - User addresses with geohash
- `products` - Product catalog with hygiene info
- `cart_items` - Cart with reservation expiry
- `orders` - Order details with status
- `order_items` - Order line items
- `return_requests` - Return requests
- `rider_locations` - Real-time rider tracking

### Realtime Events
- `rider_distance_update` - Proximity updates
- Order status changes
- Rider location updates

## 🎯 Key Implementation Details

### Proximity-Based Map Activation
```typescript
// Map shows ONLY when rider ≤ 1km
if (distance <= 100) {
  status = 'arrived';
  showMap = true;
  showOTPModal = true;
} else if (distance <= 1000) {
  status = 'near';
  showMap = true;
} else {
  status = 'far';
  showMap = false; // DEFAULT: No map
}
```

### Cart Reservation Timer
- 15-minute countdown per item
- Auto-expiry with backend sync
- Visual urgency indicators

### Hygiene Guarantee
- A+/A/B/C ratings
- Last sanitization timestamp
- Sealed package verification
- Lifecycle count tracking

## 🔒 Security

- Customer-only role validation
- Protected routes
- OTP verification for delivery/return
- Secure session management
- Environment variable protection

## 📱 PWA Features

- Offline product catalog
- Background sync for orders
- Add to home screen
- Service worker caching
- Network-first for API calls
- Cache-first for assets

## 🚦 Order Status Flow

1. **pending** → Order placed
2. **confirmed** → Payment confirmed
3. **packed** → Items packed at warehouse
4. **dispatched** → Out from warehouse
5. **out_for_delivery** → Rider assigned
6. **delivered** → OTP confirmed delivery
7. **in_use** → Rental period active
8. **return_requested** → Return initiated
9. **return_picked_up** → Return OTP confirmed
10. **completed** → Deposit refunded

## 🎨 Design System

- **Primary Color**: Purple (#8855F7)
- **Secondary Color**: Pink (#EC4899)
- **Font**: Inter (body), Outfit (display)
- **Animations**: Framer Motion micro-interactions
- **Responsive**: Mobile-first design

## 📄 License

Proprietary - PopClozet Platform

## 👥 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for PopClozet**
