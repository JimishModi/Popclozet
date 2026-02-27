import { z } from 'zod';

// Profile validation
export const profileSchema = z.object({
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().regex(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Invalid phone number'),
});

// Address validation
export const addressSchema = z.object({
    label: z.string().min(1, 'Label is required'),
    full_address: z.string().min(10, 'Address must be at least 10 characters'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

// Measurements validation
export const measurementsSchema = z.object({
    bust: z.number().positive().optional(),
    waist: z.number().positive().optional(),
    hip: z.number().positive().optional(),
    height: z.number().positive().optional(),
    weight: z.number().positive().optional(),
    shoulder_width: z.number().positive().optional(),
    inseam: z.number().positive().optional(),
    preferred_fit: z.enum(['tight', 'regular', 'loose']).optional(),
});

// Auth validation
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    phone: z.string().regex(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Invalid phone number'),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

// Return request validation
export const returnRequestSchema = z.object({
    reason: z.string().min(1, 'Reason is required'),
    pickup_address_id: z.string().uuid('Invalid address'),
    pickup_slot: z.string().min(1, 'Pickup time is required'),
});

// OTP validation
export const otpSchema = z.object({
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/, 'OTP must contain only numbers'),
});

// Helper function to validate data
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: Record<string, string> } => {
    try {
        const validated = schema.parse(data);
        return { success: true, data: validated };
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors: Record<string, string> = {};
            error.errors.forEach((err) => {
                if (err.path) {
                    errors[err.path.join('.')] = err.message;
                }
            });
            return { success: false, errors };
        }
        return { success: false, errors: { general: 'Validation failed' } };
    }
};
