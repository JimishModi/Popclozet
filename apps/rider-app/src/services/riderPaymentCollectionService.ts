import { supabase } from '@popclozet/api-client';

interface CreateOrderResult {
  id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface OrderPaymentRecord {
  status: string | null;
  provider: string | null;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
}

async function invokeWithRiderJwt<TData = unknown>(functionName: string, body: Record<string, unknown>) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke<TData>(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const invokeError = error as Error & { context?: { json?: () => Promise<any> } };
    let detail = error.message;

    try {
      if (invokeError.context && typeof invokeError.context.json === 'function') {
        const parsed = await invokeError.context.json();
        detail = parsed?.error || parsed?.message || detail;
      }
    } catch {
      // Ignore parse issues and fall back to the original error message.
    }

    throw new Error(detail || 'Function invocation failed');
  }

  return data;
}

export async function createRiderCollectionOrder(orderId: string): Promise<CreateOrderResult> {
  const data = await invokeWithRiderJwt<CreateOrderResult>('create-rider-collection-order', {
    receipt: orderId,
    notes: {
      supabase_order_id: orderId,
    },
  });

  if (!data?.id) {
    throw new Error('Invalid response from payment service');
  }

  return data;
}

export async function verifyRiderCollectionPayment(params: {
  internalOrderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const data = await invokeWithRiderJwt<{ success: boolean; payment_id: string }>('verify-rider-collection-payment', {
    internal_order_id: params.internalOrderId,
    razorpay_order_id: params.razorpayOrderId,
    razorpay_payment_id: params.razorpayPaymentId,
    razorpay_signature: params.razorpaySignature,
  });

  if (!data?.success) {
    throw new Error('Payment verification failed');
  }

  return data;
}

export async function getOrderPaymentRecord(orderId: string): Promise<OrderPaymentRecord | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('status, provider, razorpay_payment_id, razorpay_order_id')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Failed to fetch payment status');
  }

  return data as OrderPaymentRecord | null;
}
