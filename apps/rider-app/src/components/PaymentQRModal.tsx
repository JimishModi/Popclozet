/**
 * PaymentQRModal
 *
 * Displays a hardcoded payment QR code for the rider to show the customer.
 * Place your actual UPI/payment QR image at: public/payment-qr.png
 *
 * Usage modes:
 *  - View-only (home header): omit onPaymentConfirmed — only X close button shown, no action button
 *  - Active delivery (after OTP): pass onPaymentConfirmed — shows "Paid by Customer" button
 *    which updates the DB and navigates home
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, QrCode, Loader2 } from 'lucide-react';

interface PaymentQRModalProps {
  onClose: () => void;
  /**
   * Called when rider confirms the customer has paid.
   * Should update DB + navigate home. Omit to render view-only mode (no action button).
   */
  onPaymentConfirmed?: () => Promise<void>;
}

export function PaymentQRModal({ onClose, onPaymentConfirmed }: PaymentQRModalProps) {
  const [imageError, setImageError] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handlePaymentConfirmed = async () => {
    if (!onPaymentConfirmed || confirming) return;
    setConfirming(true);
    try {
      await onPaymentConfirmed();
    } catch {
      // parent handles error toasts; stop spinner so rider can retry
      setConfirming(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-zinc-900 border border-white/5 rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5">
            <h3 className="font-bold text-white flex items-center gap-2">
              <QrCode size={18} className="text-emerald-400" />
              Scan to Pay
            </h3>
            <button
              onClick={onClose}
              disabled={confirming}
              className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors disabled:opacity-40"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6 flex flex-col items-center text-center">
            <p className="text-sm text-zinc-400 leading-relaxed">
              Ask the customer to scan this QR code to complete the payment.
            </p>

            {/* QR image */}
            <div className="w-56 h-56 rounded-2xl bg-white p-3 shadow-2xl flex items-center justify-center">
              {!imageError ? (
                <img
                  src="/payment-qr.png"
                  alt="Payment QR Code"
                  className="w-full h-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-zinc-100 rounded-xl">
                  <QrCode size={64} className="text-zinc-400" />
                  <p className="text-[10px] text-zinc-500 font-bold text-center px-2 leading-tight">
                    Add your QR image at{'\n'}public/payment-qr.png
                  </p>
                </div>
              )}
            </div>

            {/* Paid button — only shown during active delivery (onPaymentConfirmed provided) */}
            {onPaymentConfirmed && (
              <button
                onClick={handlePaymentConfirmed}
                disabled={confirming}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-60"
              >
                {confirming ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving...</>
                ) : (
                  'Paid'
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PaymentQRModal;
