// apps/customer-app/src/hooks/useRazorpayCheckout.ts
// Orchestrates the full Razorpay payment flow:
//   1. Create Supabase order row  
//   2. Create Razorpay order (via edge function)
//   3. Open Razorpay modal
//   4. Verify signature server-side (via edge function)
//   5. Navigate to success/error page

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { openRazorpayCheckout, type RazorpayPaymentResponse } from '@/lib/razorpay';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/services/razorpayService';

const POPCLOZET_LOGO = '/icons/icon-192x192.png';

interface UseRazorpayCheckoutOptions {
  internalOrderId: string;    // Supabase order ID (already created before calling this)
  amountInRupees: number;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSuccess?: (paymentId: string) => void;
  onFailure?: (error: Error) => void;
}

export function useRazorpayCheckout() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const initiatePayment = useCallback(async (options: UseRazorpayCheckoutOptions) => {
    const {
      internalOrderId,
      amountInRupees,
      userName,
      userEmail,
      userPhone,
      onSuccess,
      onFailure,
    } = options;

    if (!internalOrderId || !amountInRupees) {
      toast.error('Missing order details. Please try again.');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create Razorpay order via edge function
      const amountInPaise = Math.round(amountInRupees * 100);
      const rzpOrder = await createRazorpayOrder({
        amount: amountInPaise,
        receipt: internalOrderId,
        notes: {
          supabase_order_id: internalOrderId,
        },
      });

      // Step 2: Open the Razorpay checkout modal
      await openRazorpayCheckout({
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: 'PopCLozet',
        description: 'Fashion Rental Payment',
        image: POPCLOZET_LOGO,
        order_id: rzpOrder.id,
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: userPhone || '',
        },
        notes: {
          supabase_order_id: internalOrderId,
        },
        theme: {
          color: '#f2546d',  // PopCLozet brand pink
          hide_topbar: false,
        },
        modal: {
          confirm_close: true,
          ondismiss: () => {
            setIsProcessing(false);
            toast.info('Payment cancelled');
            if (onFailure) {
                onFailure(new Error('PAYMENT_CANCELLED'));
            }
          },
        },
        handler: async (response: RazorpayPaymentResponse) => {
          // Step 3: Verify signature server-side (CRITICAL security step)
          try {
            await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              internal_order_id: internalOrderId,
            });

            toast.success('Payment successful!');

            if (onSuccess) {
              onSuccess(response.razorpay_payment_id);
            } else {
              navigate(`/order-confirmed/${internalOrderId}`, { replace: true });
            }
          } catch (verifyErr: any) {
            console.error('[useRazorpayCheckout] Verification failed:', verifyErr);
            toast.error('Payment verification failed. Please contact support.');
            if (onFailure) {
              onFailure(verifyErr);
            } else {
              navigate(`/payment-failed?orderId=${internalOrderId}`, { replace: true });
            }
          } finally {
            setIsProcessing(false);
          }
        },
      });
    } catch (err: any) {
      console.error('[useRazorpayCheckout] Payment initiation failed:', err);
      toast.error(err.message || 'Failed to initiate payment. Please try again.');
      if (onFailure) onFailure(err);
      setIsProcessing(false);
    }
  }, [navigate]);

  return { initiatePayment, isProcessing };
}
