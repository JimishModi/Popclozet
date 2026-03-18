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
export function openRazorpayCheckout(options: RazorpayOptions): void {
  if (typeof window.Razorpay === 'undefined') {
    console.error('[Razorpay] SDK not loaded. Make sure checkout.js is in index.html');
    throw new Error('Razorpay SDK not loaded');
  }
  const rzp = new window.Razorpay(options);
  rzp.open();
}
