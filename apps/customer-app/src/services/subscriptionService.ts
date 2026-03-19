import { supabase } from '@popclozet/api-client';

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    monthly_items: number;
    max_item_value: number;
    free_delivery: boolean;
    insurance_included: boolean;
}

export interface UserSubscription {
    id: string;
    user_id: string;
    plan_id: string;
    status: 'active' | 'cancelled' | 'expired';
    current_period_start: string;
    current_period_end: string;
    benefit_items_remaining: number;
}

export const MOCK_PLANS: SubscriptionPlan[] = [
    {
        id: 'essential',
        name: 'Basic',
        price: 4250,
        monthly_items: 2,
        max_item_value: 15000,
        free_delivery: false,
        insurance_included: true,
    },
    {
        id: 'standard',
        name: 'Standard',
        price: 4250,
        monthly_items: 4,
        max_item_value: 30000,
        free_delivery: true,
        insurance_included: true,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 4250,
        monthly_items: 6,
        max_item_value: 60000,
        free_delivery: true,
        insurance_included: true,
    },
];

/**
 * Activate a subscription for the current user
 */
export async function activateSubscription(planId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const plan = MOCK_PLANS.find(p => p.id === planId);
    if (!plan) throw new Error("Invalid plan selection");

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    // In a real app, we'd insert this into Supabase 'user_subscriptions' table
    // For now, we'll use localStorage to mock persistence if table doesn't exist yet
    const sub: UserSubscription = {
        id: Math.random().toString(36).substr(2, 9),
        user_id: user.id,
        plan_id: planId,
        status: 'active',
        current_period_start: startDate.toISOString(),
        current_period_end: endDate.toISOString(),
        benefit_items_remaining: plan.monthly_items
    };

    localStorage.setItem(`sub_${user.id}`, JSON.stringify(sub));

    // Try to insert into Supabase if table exists
    try {
        const { error } = await supabase.from('user_subscriptions').insert(sub);
        if (error) console.warn("Supabase sub insert failed (table might not exist):", error);
    } catch (e) {
        console.warn("Supabase interaction failed:", e);
    }

    return sub;
}

/**
 * Get active subscription for current user
 */
export async function getActiveSubscription(): Promise<UserSubscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Check localStorage first (our fallback/mock)
    const local = localStorage.getItem(`sub_${user.id}`);
    if (local) {
        const sub = JSON.parse(local) as UserSubscription;
        if (new Date(sub.current_period_end) > new Date() && sub.status === 'active') {
            return sub;
        }
    }

    // Then try Supabase
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .gte('current_period_end', new Date().toISOString())
            .maybeSingle();

        if (!error && data) return data as UserSubscription;
    } catch (e) {
        console.warn("Supabase getSub failed:", e);
    }

    return null;
}

export async function hasFreeDelivery(): Promise<boolean> {
    const sub = await getActiveSubscription();
    if (!sub) return false;

    const plan = MOCK_PLANS.find(p => p.id === sub.plan_id);
    return plan?.free_delivery || false;
}

/**
 * Check if the user has insurance benefit included
 */
export async function hasInsuranceIncluded(): Promise<boolean> {
    const sub = await getActiveSubscription();
    if (!sub) return false;

    const plan = MOCK_PLANS.find(p => p.id === sub.plan_id);
    return plan?.insurance_included || false;
}
