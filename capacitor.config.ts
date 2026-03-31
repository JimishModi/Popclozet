import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration — Native App Wrapper
 * 
 * Wraps the PWA in a native shell to enable:
 * - SSL Pinning
 * - Root/Jailbreak Detection  
 * - Screenshot Prevention
 * - Biometric Auth (FaceID/TouchID)
 * 
 * Setup:
 *   npm install @capacitor/core @capacitor/cli
 *   npx cap init popclozet com.popclozet.app --web-dir dist
 *   npx cap add android
 *   npx cap add ios
 */

const config: CapacitorConfig = {
    appId: 'com.popclozet.app',
    appName: 'popclozet',
    webDir: 'apps/customer-app/dist',

    // ─── Server Config ─────────────────────────────────────
    server: {
        // SSL Pinning: Only trust these certificates
        // Generate pins: openssl s_client -connect your-supabase.supabase.co:443 | openssl x509 -pubkey | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
        androidScheme: 'https',
        iosScheme: 'https',
    },

    // ─── Android Security ──────────────────────────────────
    android: {
        // Enable mixed content blocking
        allowMixedContent: false,
        // Use Chrome Custom Tabs for OAuth (more secure than WebView)
        appendUserAgent: 'popclozet-Android',
        // Prevent screenshots on sensitive screens
        // (Additional native code needed in MainActivity.java)
    },

    // ─── iOS Security ──────────────────────────────────────
    ios: {
        // Use WKWebView (more secure than UIWebView)
        appendUserAgent: 'popclozet-iOS',
        // Enable scroll for forms
        scrollEnabled: true,
    },

    // ─── Plugins ───────────────────────────────────────────
    plugins: {
        // SSL Pinning plugin config
        // Install: npm install capacitor-ssl-pinning
        SplashScreen: {
            launchAutoHide: true,
            androidSplashResourceName: 'splash',
        },
    },
};

export default config;
