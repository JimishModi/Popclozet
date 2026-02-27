import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/services/supabase';
import { useToast } from '@/contexts/ToastContext';

interface OTPModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    type: 'delivery' | 'return';
}

export const OTPModal: React.FC<OTPModalProps> = ({ isOpen, onClose, orderId, type }) => {
    const [otp, setOtp] = useState('');
    const [verifying, setVerifying] = useState(false);
    const { showToast } = useToast();

    const handleVerify = async () => {
        if (otp.length !== 6) {
            showToast('Please enter a valid 6-digit OTP', 'warning');
            return;
        }

        setVerifying(true);

        try {
            // Verify OTP with backend
            const { data, error } = await supabase.rpc('verify_order_otp', {
                order_id: orderId,
                otp_code: otp,
                otp_type: type,
            });

            if (error) throw error;

            if (data.success) {
                showToast(
                    type === 'delivery' ? 'Delivery confirmed!' : 'Return confirmed!',
                    'success'
                );
                onClose();
                window.location.reload(); // Refresh to update order status
            } else {
                showToast('Invalid OTP. Please try again.', 'error');
            }
        } catch (error: any) {
            console.error('Error verifying OTP:', error);
            showToast(error.message || 'Failed to verify OTP', 'error');
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        try {
            const { error } = await supabase.rpc('resend_order_otp', {
                order_id: orderId,
                otp_type: type,
            });

            if (error) throw error;
            showToast('OTP resent successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to resend OTP', 'error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enter OTP">
            <div className="text-center">
                <p className="text-gray-600 mb-6">
                    Please enter the 6-digit OTP shown on the rider's device to confirm{' '}
                    {type === 'delivery' ? 'delivery' : 'return pickup'}.
                </p>

                <Input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                />

                <div className="mt-6 space-y-3">
                    <Button
                        onClick={handleVerify}
                        className="w-full"
                        loading={verifying}
                        disabled={otp.length !== 6}
                    >
                        Verify OTP
                    </Button>

                    <button
                        onClick={handleResend}
                        className="text-sm text-primary-500 hover:text-primary-600 font-medium transition-colors"
                    >
                        Resend OTP
                    </button>
                </div>
            </div>
        </Modal>
    );
};
