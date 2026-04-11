// apps/customer-app/src/hooks/useRazorpayCheckout.ts
// Orchestrates the full Razorpay payment flow:
//   1. Create Razorpay order (via edge function)
//   2. Open Razorpay modal
//   3. On success → verify signature server-side
//   4. On cancel/failure → INSTANTLY cancel the order + release stock
//   5. Navigate to success/error page
//
// CRITICAL: Uses an `outcomeRef` flag to prevent the known Razorpay bug
// where `modal.ondismiss` fires AFTER `handler` on successful payments,
// causing a false "cancelled" flash.
//
// CANCELLATION FLOW (instant release):
// When the user closes the Razorpay modal, we call
// `force_cancel_pending_order` synchronously, which runs
// `release_order_stock` server-side. This frees inventory the
// moment the user dismisses the modal — no 10-minute cron wait.

import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@popclozet/api-client';
import { openRazorpayCheckout, type RazorpayPaymentResponse, type RazorpayFailedResponse } from '@/lib/razorpay';
import { createRazorpayOrder, verifyRazorpayPayment } from '@/services/razorpayService';

const popclozet_LOGO = '/icons/icon-192x192.png';

// Payment outcome states — used to prevent race conditions between
// handler and ondismiss callbacks. Only ONE of these may ever fire.
type PaymentOutcome = 'none' | 'success' | 'failed' | 'cancelled';

interface UseRazorpayCheckoutOptions {
  internalOrderId: string;    // Supabase order ID (already created before calling this)
  amountInRupees: number;
  preferredMethod?: 'upi';
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSuccess?: (paymentId: string) => void;
  onFailure?: (error: Error) => void;
  skipCancelOnFailure?: boolean;  // For COD UPI at door — don't cancel the order on payment failure
}

export function useRazorpayCheckout() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  // Ref survives across the async Razorpay callbacks without causing re-renders.
  // This is the KEY fix: Razorpay's `modal.ondismiss` fires even after a
  // successful `handler` call. Without this guard, the cancel flow runs
  // after payment has already succeeded, flashing the wrong UI.
  const outcomeRef = useRef<PaymentOutcome>('none');

  const initiatePayment = useCallback(async (options: UseRazorpayCheckoutOptions) => {
    const {
      internalOrderId,
      amountInRupees,
      preferredMethod,
      userName,
      userEmail,
      userPhone,
      onSuccess,
      onFailure,
      skipCancelOnFailure,
    } = options;

    if (!internalOrderId || !amountInRupees) {
      toast.error('Missing order details. Please try again.');
      return;
    }

    // Prevent double-clicks / concurrent payment attempts
    if (isProcessing) return;

    setIsProcessing(true);
    outcomeRef.current = 'none';

    try {
      // Step 1: Create Razorpay order via edge function
      // Amount is resolved server-side from the order's total_amount
      const rzpOrder = await createRazorpayOrder({
        receipt: internalOrderId,
        notes: {
          supabase_order_id: internalOrderId,
        },
      });

      // Step 2: Open the Razorpay checkout modal
      const rzpInstance = await openRazorpayCheckout({
        key: rzpOrder.key_id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        name: 'Popclozet',
        description: 'Fashion Rental Payment',
        image: popclozet_LOGO,
        order_id: rzpOrder.id,
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: userPhone || '',
        },
        notes: {
          supabase_order_id: internalOrderId,
        },
        ...(preferredMethod === 'upi'
          ? {
            config: {
              display: {
                blocks: {
                  upi: {
                    name: 'Pay via UPI',
                    instruments: [{ method: 'upi' }],
                  },
                },
                sequence: ['block.upi'],
                preferences: {
                  show_default_blocks: false,
                },
              },
            },
          }
          : {}),
        retry: {
          enabled: true,
          max_count: 3,
        },
        theme: {
          color: '#f2546d',  // Popclozet brand pink
          hide_topbar: false,
        },
        modal: {
          // Ask user to confirm before closing the payment modal
          confirm_close: true,
          // Prevent accidental backdrop close
          escape: false,
          backdropclose: false,

          ondismiss: async () => {
            // ── CRITICAL GUARD ──
            // Razorpay fires ondismiss even after a successful handler call.
            // If the handler already ran (success or explicit failure),
            // do NOT run the cancel flow again.
            if (outcomeRef.current !== 'none') {
              console.log('[useRazorpayCheckout] ondismiss fired but outcome already set:', outcomeRef.current);
              return;
            }

            // ── INSTANT CANCELLATION ──
            // The user closed the modal. Release the reserved stock
            // RIGHT NOW so the product is immediately bookable again.
            // No polling, no waiting for the 10-minute cron.
            outcomeRef.current = 'cancelled';
            setIsProcessing(false);

            console.log('[useRazorpayCheckout] ondismiss: force-cancelling order', internalOrderId);

            try {
              const { error: rpcErr } = await supabase.rpc('force_cancel_pending_order', {
                order_id: internalOrderId,
              });
              if (rpcErr) {
                console.warn('[useRazorpayCheckout] force_cancel_pending_order RPC error:', rpcErr);
              }
            } catch (cancelErr) {
              console.warn('[useRazorpayCheckout] force_cancel_pending_order threw:', cancelErr);
              // Non-fatal — the caller's onFailure still runs, and the
              // cron job remains as a last-resort safety net.
            }

            if (onFailure) {
              onFailure(new Error('PAYMENT_CANCELLED'));
            } else {
              toast.info('Payment cancelled.');
              navigate('/checkout', { replace: true });
            }
          },
        },

        handler: async (response: RazorpayPaymentResponse) => {
          // Log the raw Razorpay response for diagnostics.
          console.log('[useRazorpayCheckout] handler fired with response:', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            hasSig: !!response.razorpay_signature,
          });

          // Tentatively mark outcome so ondismiss doesn't race us,
          // but we only commit to 'success' after server-side confirmation.
          outcomeRef.current = 'success';

          // Step 3: Verify signature + actual payment capture server-side (CRITICAL)
          try {
            const result = await verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              internal_order_id: internalOrderId,
            });

            toast.success('Payment successful!');

            if (onSuccess) {
              onSuccess(response.razorpay_payment_id);
            } else {
              navigate('/home', { replace: true });
            }
          } catch (verifyErr: any) {
            console.error('[useRazorpayCheckout] Verification failed:', verifyErr);
            const msg = verifyErr?.message || '';

            // Payment was NOT actually captured (signature valid but gateway
            // says the payment never completed). Flip the outcome so the
            // caller knows money wasn't charged.
            const notCaptured =
              msg.includes('was not completed') ||
              msg.includes('Could not confirm payment') ||
              msg.includes('Payment amount mismatch') ||
              msg.includes('order mismatch');

            if (notCaptured) {
              outcomeRef.current = 'failed';
              toast.error(msg || 'Payment was not completed. Please try again.');
              if (onFailure) {
                onFailure(new Error(msg || 'PAYMENT_NOT_CAPTURED'));
              } else {
                navigate(`/payment-failed?orderId=${internalOrderId}&reason=not_captured`, { replace: true });
              }
            } else if (msg.includes('signature mismatch')) {
              toast.error('Payment verification failed. Please contact support.');
              if (onFailure) {
                onFailure(verifyErr);
              } else {
                navigate(`/payment-failed?orderId=${internalOrderId}&reason=signature_mismatch`, { replace: true });
              }
            } else {
              // Genuine "money charged but verification failed" case — do NOT cancel.
              // The webhook will reconcile this. Show a reassuring message.
              toast.error(
                'Payment was processed but verification failed. ' +
                'Your order will be confirmed automatically — please check My Orders.'
              );
              if (onFailure) {
                onFailure(verifyErr);
              } else {
                navigate(`/payment-failed?orderId=${internalOrderId}&reason=verification_failed`, { replace: true });
              }
            }
          } finally {
            setIsProcessing(false);
          }
        },
      });

      // Step 2b: Listen for explicit payment failures from Razorpay
      // This fires when the payment itself fails (bank decline, insufficient funds, etc.)
      // BEFORE the modal closes. The user can retry from within the modal,
      // so we only toast — we do NOT navigate away or cancel the order yet.
      // If they give up, ondismiss will handle the final cancel.
      rzpInstance.on('payment.failed', (failedResponse: RazorpayFailedResponse) => {
        const err = failedResponse.error;
        console.error('[useRazorpayCheckout] payment.failed:', err.code, err.description);

        // Only show toast if we haven't already resolved the outcome.
        // The user may retry within the same modal session.
        if (outcomeRef.current === 'none') {
          toast.error(`Payment failed: ${err.description || err.reason || 'Unknown error'}`);
        }
      });

    } catch (err: any) {
      console.error('[useRazorpayCheckout] Payment initiation failed:', err);
      toast.error(err.message || 'Failed to initiate payment. Please try again.');

      outcomeRef.current = 'failed';
      if (onFailure) onFailure(err);
      setIsProcessing(false);
    }
  }, [navigate, isProcessing]);

  return { initiatePayment, isProcessing };
}
