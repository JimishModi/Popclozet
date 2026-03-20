// apps/customer-app/src/lib/razorpay.ts
// Type declarations for the Razorpay checkout SDK

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    hide_topbar?: boolean;
  };
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}

/**
 * Opens the Razorpay checkout modal.
 * Dynamically loads the SDK if not already present.
 */
export async function openRazorpayCheckout(options: RazorpayOptions): Promise<void> {
  if (typeof window.Razorpay === 'undefined') {
    console.log('[Razorpay] SDK not found, loading...');
    await loadRazorpayScript();
  }
  
  const rzp = new window.Razorpay(options);
  rzp.open();
}

/**
 * Dynamically loads the Razorpay checkout.js script
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      console.log('[Razorpay] SDK loaded successfully');
      resolve();
    };
    script.onerror = () => {
      console.error('[Razorpay] Failed to load SDK');
      reject(new Error('Razorpay SDK failed to load'));
    };
    document.body.appendChild(script);
  });
}
