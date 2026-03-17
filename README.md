# PopClozet Customer Application

Production-grade customer PWA for PopClozet rental fashion platform with Zepto-style delivery experience.

## Authentication Flow

The app features a unified login/signup experience with dynamic routing based on profile completeness.

### Routes
- `/auth/login`: Combined landing (Phone +91, Google, Email).
- `/auth/otp`: MSG91 OTP verification for phone login.
- `/auth/verify-email`: Verification for email magic links.
- `/auth/create-account`: Profile creation for new users.
- `/auth/collect-phone/email`: Supplemental info collection for social signups.

### Technical Implementation
- **Routing**: Managed by `checkAndRoute` in `src/lib/authRouting.ts`.
- **Helpers**: Database lookups and profile updates in `src/lib/authHelpers.ts`.
- **OTP**: Integrated with MSG91 browser SDK and Supabase Edge Functions.

### Testing
Unit tests are located in:
- `src/lib/__tests__/authRouting.test.ts`
- `src/pages/auth/__tests__/LoginPage.test.ts`
Run them using:
`pnpm --filter @popclozet/customer-app exec vitest run`

## 🚀 Features

### Core Features
- **Authentication**: Secure customer-only authentication with Supabase
- **Phone OTP Verification**: Mobile number verification via MSG91 OTP widget with custom UI
- **Product Discovery**: NLP-powered search with occasion-based filtering
- **Smart Cart**: 15-minute reservation timer with auto-expiry
- **Seamless Checkout**: Address management and rental period selection
- **Zepto-Style Delivery**: Proximity-based map activation
- **OTP Confirmation**: Secure delivery and return confirmation
- **Return Workflow**: Easy return request with pickup scheduling
- **PWA Support**: Offline-first with background sync

### Phone OTP Authentication Flow
- **Send OTP**: MSG91 SDK sends OTP to Indian mobile numbers (+91)
- **Verify OTP**: Client-side verification via MSG91 widget returns access token
- **Server Validation**: Supabase Edge Function validates MSG91 access token server-side
- **Session Creation**: Automatic Supabase user creation and session management
- **Resend Support**: 30-second cooldown with retry via MSG91 retryOtp

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
- **OTP Verification**: MSG91 OTP Widget SDK
- **Maps**: Mapbox GL JS (conditional rendering)
- **PWA**: vite-plugin-pwa with Workbox

## 🛠️ Setup

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Mapbox account
- MSG91 account with OTP widget configured

### MSG91 Setup
1. Create an account at [msg91.com](https://msg91.com)
2. Complete DLT registration (required for India — takes 3–7 days)
3. Create an Authkey at `control.msg91.com/developer` with `##OTP##` use case
4. Create an OTP Widget at `control.msg91.com` → OTP → Widget
5. Copy the `widgetId` and `tokenAuth` from the widget code snippet
6. Deploy the Supabase Edge Function and set the secret:
```bash
supabase functions deploy verify-otp-token
supabase secrets set MSG91_AUTH_KEY=your_authkey_here
```

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

# MSG91 OTP Verification
VITE_MSG91_WIDGET_ID=your_msg91_widget_id
VITE_MSG91_TOKEN_AUTH=your_msg91_token_auth
```

> ⚠️ Never commit `.env` to Git. Make sure it's in `.gitignore`.

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
│   ├── auth/            # Login, Signup, OTP Verification
│   ├── products/        # Product list, detail
│   ├── cart/            # Cart page
│   ├── checkout/        # Checkout flow
│   ├── orders/          # Orders list, tracking, return
│   ├── profile/         # Profile management
│   └── HomePage.tsx
├── contexts/            # React contexts (Auth, Cart, Toast)
├── hooks/               # Custom hooks (geolocation, realtime)
├── services/            # API services (Supabase, Mapbox, MSG91, Realtime)
│   └── msg91OtpService.ts  # MSG91 SDK wrapper
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
└── styles/              # Global styles

supabase/
└── functions/
    └── verify-otp-token/   # Edge function for MSG91 token verification
        └── index.ts
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

### Phone OTP Verification
```typescript
// 1. Load MSG91 SDK and send OTP
await loadAndInitMsg91(`91${phoneNumber}`);
await sendOtp(`91${phoneNumber}`);

// 2. Verify OTP — returns access token
const { message: accessToken } = await verifyOtp(otp);

// 3. Validate token server-side via Supabase Edge Function
const res = await fetch(process.env.VITE_SUPABASE_URL + '/functions/v1/verify-otp-token', {
  method: 'POST',
  headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  body: JSON.stringify({ accessToken, mobile: phoneNumber })
});

// 4. Set Supabase session
const { session } = await res.json();
await supabase.auth.setSession(session);
```

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
- MSG91 server-side OTP token validation via Supabase Edge Function
- OTP verification for delivery/return
- Secure session management
- Environment variable protection
- MSG91 Authkey IP whitelisting (enable in production)

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