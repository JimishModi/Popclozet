/**
 * Payment Security Service
 * 
 * Handles secure payment processing with:
 * - Razorpay SDK integration (PCI-DSS compliant — card data never touches our server)
 * - Idempotency keys to prevent double charges
 * - Webhook signature verification
 * - Payment intent creation and confirmation
 * 
 * Prerequisites:
 *   - Add VITE_RAZORPAY_KEY_ID to .env
 *   - Add RAZORPAY_KEY_SECRET to Supabase Vault (for webhook verification)
 *   - Load Razorpay script: <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
 */

import { supabase } from '@popclozet/api-client';

// ─── Types ───────────────────────────────────────────────────

export interface PaymentOrder {
    orderId: string;
    amount: number;        // in smallest currency unit (paise for INR)
    currency: string;
    receipt: string;       // our internal order reference
}

export interface PaymentResult {
    success: boolean;
    paymentId?: string;
    orderId?: string;
    signature?: string;
    error?: string;
}

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    prefill: {
        name: string;
        email: string;
        contact: string;
    };
    theme: { color: string };
    handler: (response: RazorpayResponse) => void;
    modal: { ondismiss: () => void };
}

interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

declare global {
    interface Window {
        Razorpay: new (options: RazorpayOptions) => { open: () => void };
    }
}

// ─── Config ──────────────────────────────────────────────────

function getRazorpayKeyId(): string {
    return (import.meta as Record<string, Record<string, string>>).env?.VITE_RAZORPAY_KEY_ID || '';
}

// ─── Load Razorpay Script ────────────────────────────────────

export function loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.Razorpay) { resolve(); return; }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
        document.head.appendChild(script);
    });
}

// ─── Create Payment Order (via Supabase Edge Function) ───────

export async function createPaymentOrder(
    orderTotal: number,
    internalOrderId: string,
    idempotencyKey: string
): Promise<PaymentOrder> {
    const { data, error } = await supabase.functions.invoke('create-payment-order', {
        body: {
            amount: Math.round(orderTotal * 100), // Convert to paise
            currency: 'INR',
            receipt: internalOrderId,
            idempotency_key: idempotencyKey,
        },
    });

    if (error) throw new Error(`Payment order creation failed: ${error.message}`);
    return data;
}

// ─── Open Razorpay Checkout (PCI-DSS Compliant) ──────────────

export async function processPayment(
    paymentOrder: PaymentOrder,
    userInfo: { name: string; email: string; phone: string }
): Promise<PaymentResult> {
    await loadRazorpayScript();

    return new Promise((resolve) => {
        const options: RazorpayOptions = {
            key: getRazorpayKeyId(),
            amount: paymentOrder.amount,
            currency: paymentOrder.currency,
            name: 'PopClozet',
            description: `Order ${paymentOrder.receipt}`,
            order_id: paymentOrder.orderId,
            prefill: {
                name: userInfo.name,
                email: userInfo.email,
                contact: userInfo.phone,
            },
            theme: { color: '#6366f1' },
            handler: (response: RazorpayResponse) => {
                resolve({
                    success: true,
                    paymentId: response.razorpay_payment_id,
                    orderId: response.razorpay_order_id,
                    signature: response.razorpay_signature,
                });
            },
            modal: {
                ondismiss: () => {
                    resolve({ success: false, error: 'Payment cancelled by user' });
                },
            },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
    });
}

// ─── Verify Payment Signature (call on server-side) ──────────

export async function verifyPaymentSignature(
    paymentId: string,
    orderId: string,
    signature: string
): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { paymentId, orderId, signature },
    });

    if (error) return false;
    return data?.verified === true;
}
