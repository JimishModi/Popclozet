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
    escape?: boolean;
    backdropclose?: boolean;
  };
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailedResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, callback: (response: RazorpayFailedResponse) => void) => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/**
 * Opens the Razorpay checkout modal.
 * Dynamically loads the SDK if not already present.
 * Returns the instance so callers can attach event listeners (e.g. payment.failed).
 */
export async function openRazorpayCheckout(options: RazorpayOptions): Promise<RazorpayInstance> {
  if (typeof window.Razorpay === 'undefined') {
    console.log('[Razorpay] SDK not found, loading...');
    await loadRazorpayScript();
  }

  const rzp = new window.Razorpay(options);
  rzp.open();
  return rzp;
}

/**
 * Dynamically loads the Razorpay checkout.js script with a timeout
 */
function loadRazorpayScript(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error('[Razorpay] SDK load timed out');
      reject(new Error('Payment gateway is taking too long to load. Please check your internet connection and try again.'));
    }, timeoutMs);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      console.log('[Razorpay] SDK loaded successfully');
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      console.error('[Razorpay] Failed to load SDK');
      reject(new Error('Payment gateway failed to load. Please check your internet connection and try again.'));
    };
    document.body.appendChild(script);
  });
}
