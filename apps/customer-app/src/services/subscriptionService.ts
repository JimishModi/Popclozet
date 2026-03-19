import { supabase } from '@popclozet/api-client';

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    tagline: string;
    monthly_items: number;
    concurrent_items: number;
    max_item_value: number;
    free_delivery: boolean;
    insurance_included: boolean;
    features: { id: string; name: string; included: boolean }[];
}

export interface UserSubscription {
    id: string;
    user_id: string;
    plan_id: string;
    status: 'active' | 'cancelled' | 'expired';
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end?: boolean;
}

export const PLAN_FEATURES = [
    { id: 'hygiene', name: 'Standard Hygiene Certification' },
    { id: 'insurance_15k', name: 'Insurance up to ₹15K' },
    { id: 'rentals_2', name: '2 Rentals / Month' },
    { id: 'rentals_4', name: '4 Rentals / Month' },
    { id: 'free_delivery', name: 'Free Delivery' },
    { id: 'advance_booking', name: 'Advance Booking (7 days)' },
    { id: 'insurance_60k', name: 'Insurance up to ₹60K' },
    { id: 'rentals_6', name: '6 Rentals / Month' },
    { id: 'early_access', name: 'Early Access to New Collections' },
    { id: 'free_home_try_on', name: 'Free Home Try-On' },
    { id: 'premium_support', name: 'Premium Customer Support' },
];

const FALLBACK_PLANS: SubscriptionPlan[] = [
    {
        id: 'essential',
        name: 'Basic',
        price: 4250,
        tagline: 'Start your fashion journey',
        monthly_items: 2,
        concurrent_items: 2,
        max_item_value: 15000,
        free_delivery: false,
        insurance_included: true,
        features: PLAN_FEATURES.map(f => ({
            id: f.id,
            name: f.name,
            included: ['hygiene', 'insurance_15k', 'rentals_2'].includes(f.id)
        })),
    },
    {
        id: 'standard',
        name: 'Standard',
        price: 4250,
        tagline: 'The perfect balance',
        monthly_items: 4,
        concurrent_items: 4,
        max_item_value: 15000,
        free_delivery: true,
        insurance_included: true,
        features: PLAN_FEATURES.map(f => ({
            id: f.id,
            name: f.name,
            included: ['hygiene', 'insurance_15k', 'rentals_4', 'free_delivery', 'advance_booking'].includes(f.id)
        })),
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 4250,
        tagline: 'Ultimate fashion access',
        monthly_items: 6,
        concurrent_items: 6,
        max_item_value: 60000,
        free_delivery: true,
        insurance_included: true,
        features: PLAN_FEATURES.map(f => ({
            id: f.id,
            name: f.name,
            included: ['hygiene', 'insurance_60k', 'rentals_6', 'free_delivery', 'advance_booking', 'early_access', 'free_home_try_on', 'premium_support'].includes(f.id)
        })),
    },
];

/* ───────────────────────────────────────────────────────── */
/* localStorage helpers (primary storage – always available) */
/* ───────────────────────────────────────────────────────── */
const LS_KEY = 'popclozet_subscription';

function saveToLocal(sub: UserSubscription) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(sub));
    } catch { /* quota exceeded etc. – silent */ }
}

function getFromLocal(): UserSubscription | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return null;
        const sub = JSON.parse(raw) as UserSubscription;
        // check expiry
        const isExpired = new Date(sub.current_period_end) < new Date();
        
        // Return null if expired
        if (isExpired) return null;
        
        // Return the subscription if active OR cancelled (but not yet expired)
        if (sub.status === 'active' || sub.status === 'cancelled') {
            return sub;
        }
        
        return null;
    } catch {
        return null;
    }
}

/* ───────────────────────────────────────────────────────── */
/* Supabase helpers  (best‑effort sync)                     */
/* ───────────────────────────────────────────────────────── */
async function trySupabaseInsert(sub: Omit<UserSubscription, 'id'>): Promise<UserSubscription | null> {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .insert(sub)
            .select()
            .single();
        if (error) {
            console.warn('[Subscription] Supabase insert failed (table may not exist):', error.message);
            return null;
        }
        return data as UserSubscription;
    } catch (e) {
        console.warn('[Subscription] Supabase unavailable, using local storage only');
        return null;
    }
}

async function trySupabaseGet(userId: string): Promise<UserSubscription | null> {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['active', 'cancelled'])
            .gte('current_period_end', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            console.warn('[Subscription] Supabase read failed:', error.message);
            return null;
        }
        return data as UserSubscription | null;
    } catch {
        return null;
    }
}

async function trySupabaseCancelById(id: string) {
    try {
        await supabase
            .from('user_subscriptions')
            .update({ status: 'cancelled' })
            .eq('id', id);
    } catch { /* best-effort */ }
}

/* ───────────────────────────────────────────────────────── */
/* Public API                                               */
/* ───────────────────────────────────────────────────────── */

/**
 * Fetch all active subscription plans from the DB.
 * Falls back to local plans if DB is unavailabe or empty.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });
        
        if (!error && data && data.length > 0) {
            return data as SubscriptionPlan[];
        }
    } catch (e) {
        console.warn('[Subscription] Failed to fetch plans from DB, using fallbacks:', e);
    }
    return FALLBACK_PLANS;
}

/* ───────────────────────────────────────────────────────── */

/**
 * Activate a subscription for the current user.
 * Uses localStorage as primary storage and attempts Supabase sync.
 */
export async function activateSubscription(planId: string): Promise<UserSubscription> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === planId);
    if (!plan) throw new Error("Invalid plan selection");

    // Check existing subscription
    const existing = getFromLocal();
    if (existing && existing.plan_id === planId) {
        return existing; // already subscribed to this plan
    }
    // Cancel old if switching plans - immediate termination of old plan benefits
    if (existing) {
        trySupabaseCancelById(existing.id).catch(() => {});
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const subPayload = {
        user_id: user.id,
        plan_id: planId,
        status: 'active' as const,
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString(),
    };

    // Try Supabase first – if it works we use the DB-generated id
    const dbSub = await trySupabaseInsert(subPayload);

    const finalSub: UserSubscription = dbSub || {
        id: crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`,
        ...subPayload,
    };

    // Always save locally so the UI works instantly
    saveToLocal(finalSub);
    return finalSub;
}

/**
 * Cancel the current active subscription
 */
export async function cancelSubscription(): Promise<boolean> {
    const sub = await getActiveSubscription();
    if (!sub) return false;

    // Local update
    sub.status = 'cancelled';
    sub.cancel_at_period_end = true;
    saveToLocal(sub);

    // DB update
    try {
        await supabase
            .from('user_subscriptions')
            .update({ 
                cancel_at_period_end: true 
            })
            .eq('id', sub.id);
        return true;
    } catch (e) {
        console.warn('[Subscription] Failed to cancel in DB', e);
        return false;
    }
}

/**
 * Get active subscription for current user.
 * Checks localStorage first, then Supabase.
 */
export async function getActiveSubscription(): Promise<UserSubscription | null> {
    // 1. Check localStorage (instant)
    const local = getFromLocal();
    if (local) return local;

    // 2. Check Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbSub = await trySupabaseGet(user.id);
    if (dbSub) {
        saveToLocal(dbSub); // cache it
        return dbSub;
    }

    return null;
}

function getIncludedFeatureIds(plan: SubscriptionPlan): string[] {
    return plan.features.filter(feature => feature.included).map(feature => feature.id);
}

export interface CheckoutEntitlementSummary {
    hasActiveSubscription: boolean;
    subscriptionId: string | null;
    planId: string | null;
    planName: string | null;
    monthlyItems: number;
    concurrentItems: number;
    monthlyUsed: number;
    concurrentUsed: number;
    remainingMonthly: number;
    remainingConcurrent: number;
    maxItemValue: number;
    freeDelivery: boolean;
    insuranceIncluded: boolean;
    hasAdvanceBooking: boolean;
    hasEarlyAccess: boolean;
    hasFreeHomeTryOn: boolean;
    hasPremiumSupport: boolean;
}

export type SubscriptionBenefits = CheckoutEntitlementSummary;

function buildFallbackBenefits(plan: SubscriptionPlan, subscriptionId: string): SubscriptionBenefits {
    const featureIds = getIncludedFeatureIds(plan);

    return {
        hasActiveSubscription: true,
        subscriptionId,
        planId: plan.id,
        planName: plan.name,
        monthlyItems: plan.monthly_items,
        concurrentItems: plan.concurrent_items,
        monthlyUsed: 0,
        concurrentUsed: 0,
        remainingMonthly: plan.monthly_items,
        remainingConcurrent: plan.concurrent_items,
        maxItemValue: plan.max_item_value,
        freeDelivery: plan.free_delivery,
        insuranceIncluded: plan.insurance_included,
        hasAdvanceBooking: featureIds.includes('advance_booking'),
        hasEarlyAccess: featureIds.includes('early_access'),
        hasFreeHomeTryOn: featureIds.includes('free_home_try_on'),
        hasPremiumSupport: featureIds.includes('premium_support'),
    };
}

export async function getCheckoutEntitlementSummary(): Promise<CheckoutEntitlementSummary | null> {
    try {
        const { data, error } = await supabase.rpc('get_checkout_entitlement_summary');
        if (error) {
            console.warn('[Subscription] Failed to fetch entitlement summary:', error.message);
            return null;
        }

        return data as CheckoutEntitlementSummary;
    } catch (error) {
        console.warn('[Subscription] Entitlement summary unavailable, falling back to local plan data:', error);
        return null;
    }
}

/**
 * Get the full profile including plan details and features
 */
export async function getSubscriptionProfile() {
    const sub = await getActiveSubscription();
    if (!sub) return null;

    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === sub.plan_id);
    if (!plan) return null;

    return {
        subscription: sub,
        plan: plan
    };
}

/**
 * Check if the user has free delivery benefit
 */
export async function hasFreeDelivery(): Promise<boolean> {
    const benefits = await getSubscriptionBenefits();
    return benefits?.freeDelivery || false;
}

/**
 * Get all subscription benefits for the current user in one call.
 * Returns null if there is no active subscription.
 */
export async function getSubscriptionBenefits(): Promise<SubscriptionBenefits | null> {
    const entitlementSummary = await getCheckoutEntitlementSummary();
    if (entitlementSummary?.hasActiveSubscription) {
        return entitlementSummary;
    }

    const sub = await getActiveSubscription();
    if (!sub) return null;

    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === sub.plan_id);
    if (!plan) return null;

    return buildFallbackBenefits(plan, sub.id);
}

/**
 * Check if the active subscription includes a specific feature
 */
export async function hasFeature(featureId: string): Promise<boolean> {
    const benefits = await getSubscriptionBenefits();
    if (!benefits) return false;

    switch (featureId) {
        case 'advance_booking':
            return benefits.hasAdvanceBooking;
        case 'early_access':
            return benefits.hasEarlyAccess;
        case 'free_home_try_on':
            return benefits.hasFreeHomeTryOn;
        case 'premium_support':
            return benefits.hasPremiumSupport;
        case 'free_delivery':
            return benefits.freeDelivery;
        case 'insurance_15k':
        case 'insurance_60k':
            return benefits.insuranceIncluded;
        default: {
            const sub = await getActiveSubscription();
            if (!sub) return false;

            const plans = await getSubscriptionPlans();
            const plan = plans.find(p => p.id === sub.plan_id);
            if (!plan) return false;

            return plan.features.some(feature => feature.id === featureId && feature.included);
        }
    }
}

/**
 * Get monthly rental limit for the current plan (0 if no subscription)
 */
export async function getMonthlyItemLimit(): Promise<number> {
    const benefits = await getSubscriptionBenefits();
    return benefits?.monthlyItems || 0;
}

/**
 * Get max item value coverage for insurance
 */
export async function getMaxItemValue(): Promise<number> {
    const benefits = await getSubscriptionBenefits();
    return benefits?.maxItemValue || 0;
}

export interface CreateEntitledOrderInput {
    deliveryAddressId: string;
    items: {
        product_id: string;
        size: string;
        quantity: number;
    }[];
    paymentMethod?: 'upi' | 'cod' | null;
    orderType?: 'rental' | 'home_try_on';
    scheduledSlot?: {
        date: string;
        start: string;
        end: string;
    } | null;
    deliveryDistanceKm?: number | null;
    popInsurance?: boolean;
    rentalDurationDays?: number;
    deliveryEta?: string | null;
}

export interface CreateEntitledOrderResult {
    success: boolean;
    orderId: string;
    totalAmount: number;
    subtotal: number;
    deliveryFee: number;
    insuranceFee: number;
    depositAmount: number;
    subscriptionId: string | null;
    supportTier: 'standard' | 'premium';
    orderType: 'rental' | 'home_try_on';
}

export async function createEntitledOrder(input: CreateEntitledOrderInput): Promise<CreateEntitledOrderResult> {
    const { data, error } = await supabase.rpc('create_entitled_order', {
        p_delivery_address_id: input.deliveryAddressId,
        p_items: input.items,
        p_payment_method: input.paymentMethod ?? null,
        p_order_type: input.orderType ?? 'rental',
        p_scheduled_slot: input.scheduledSlot ?? null,
        p_delivery_distance_km: input.deliveryDistanceKm ?? null,
        p_pop_insurance: input.popInsurance ?? true,
        p_rental_duration_days: input.rentalDurationDays ?? 4,
        p_delivery_eta: input.deliveryEta ?? null,
    });

    if (error) {
        throw new Error(error.message);
    }

    return data as CreateEntitledOrderResult;
}

/**
 * Check if the user has insurance benefit included
 */
export async function hasInsuranceIncluded(): Promise<boolean> {
    const sub = await getActiveSubscription();
    if (!sub) return false;

    const plans = await getSubscriptionPlans();
    const plan = plans.find(p => p.id === sub.plan_id);
    return plan?.insurance_included || false;
}
