/**
 * Input Validation Schemas (Zod)
 * 
 * Centralized validation for all user inputs.
 * "Never Trust User Input" — validate everything before processing.
 */
import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────────

export const phoneSchema = z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number too long')
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format');

export const otpSchema = z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only numbers');

export const emailSchema = z
    .string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .transform((e) => e.toLowerCase().trim());

export const passwordSchema = z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

// ─── Profile Schemas ─────────────────────────────────────────

export const profileSchema = z.object({
    full_name: z
        .string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name too long')
        .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters'),
    phone: phoneSchema,
    avatar_url: z
        .string()
        .url('Invalid avatar URL')
        .optional()
        .nullable(),
});

export const updateProfileSchema = profileSchema.partial();

// ─── Address Schemas ─────────────────────────────────────────

export const addressSchema = z.object({
    label: z
        .string()
        .min(1, 'Label is required')
        .max(50, 'Label too long'),
    full_address: z
        .string()
        .min(10, 'Address too short')
        .max(500, 'Address too long'),
    latitude: z
        .number()
        .min(-90, 'Invalid latitude')
        .max(90, 'Invalid latitude'),
    longitude: z
        .number()
        .min(-180, 'Invalid longitude')
        .max(180, 'Invalid longitude'),
    is_default: z.boolean().optional().default(false),
});

// ─── Order Schemas ───────────────────────────────────────────

export const createOrderSchema = z.object({
    delivery_address_id: z.string().uuid('Invalid address ID'),
    rental_start_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
    rental_end_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
        .optional(),
    items: z
        .array(
            z.object({
                product_id: z.string().uuid('Invalid product ID'),
                size: z.string().min(1, 'Size is required'),
                rental_duration_days: z
                    .number()
                    .int()
                    .min(1, 'Minimum 1 day rental')
                    .max(30, 'Maximum 30 day rental'),
            })
        )
        .min(1, 'At least one item required')
        .max(10, 'Maximum 10 items per order'),
    idempotency_key: z.string().uuid('Invalid idempotency key').optional(),
});

// ─── Payment Schemas ─────────────────────────────────────────

export const paymentSchema = z.object({
    order_id: z.string().uuid('Invalid order ID'),
    amount: z
        .number()
        .positive('Amount must be positive')
        .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
    currency: z
        .string()
        .length(3, 'Currency must be 3 characters (e.g., INR)')
        .default('INR'),
    idempotency_key: z.string().uuid('Required for payment safety'),
});

// ─── Rider Schemas ───────────────────────────────────────────

export const locationUpdateSchema = z.object({
    latitude: z
        .number()
        .min(-90)
        .max(90),
    longitude: z
        .number()
        .min(-180)
        .max(180),
    accuracy: z
        .number()
        .min(0)
        .max(1000)
        .optional(),
    speed: z
        .number()
        .min(0)
        .max(200)
        .optional(),
});

export const otpVerifySchema = z.object({
    order_id: z.string().uuid('Invalid order ID'),
    otp_code: otpSchema,
    otp_type: z.enum(['delivery', 'return']),
});

// ─── Webhook Schemas ─────────────────────────────────────────

export const webhookPayloadSchema = z.object({
    event: z.string().min(1),
    payload: z.record(z.unknown()),
    timestamp: z.number().int(),
});

// ─── Search / Filter Schemas ─────────────────────────────────

export const productFilterSchema = z.object({
    category: z.string().optional(),
    gender: z.enum(['men', 'women', 'unisex']).optional(),
    occasion: z.string().optional(),
    min_price: z.number().min(0).optional(),
    max_price: z.number().min(0).optional(),
    size: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(50).default(20),
});

// ─── Utility: Validate and throw ─────────────────────────────

export function validateInput<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        const errors = result.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`
        );
        throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    return result.data;
}

/**
 * Middleware-style validator for async handlers
 */
export function withValidation<T>(
    schema: z.ZodType<T>,
    handler: (validData: T) => Promise<unknown>
) {
    return async (rawData: unknown) => {
        const data = validateInput(schema, rawData);
        return handler(data);
    };
}
