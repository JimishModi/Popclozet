/**
 * Rider Profile Service
 *
 * Handles rider profile, status, and settings
 */
export interface RiderProfile {
    id: string;
    userId: string;
    name: string;
    phone: string;
    email: string;
    avatar?: string;
    vehicleType: 'bike' | 'scooter' | 'car';
    vehicleNumber: string;
    licenseNumber: string;
    status: 'online' | 'offline' | 'busy';
    rating: number;
    totalDeliveries: number;
    joinedAt: string;
    isVerified: boolean;
    documentsStatus: DocumentsStatus;
}
export interface DocumentsStatus {
    drivingLicense: 'pending' | 'verified' | 'rejected';
    vehicleRC: 'pending' | 'verified' | 'rejected';
    insurance: 'pending' | 'verified' | 'rejected';
    idProof: 'pending' | 'verified' | 'rejected';
}
export interface RiderSettings {
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    language: string;
    darkMode: boolean;
    autoAcceptOrders: boolean;
    maxDistance: number;
}
export interface RiderStats {
    totalDeliveries: number;
    totalEarnings: number;
    avgRating: number;
    completionRate: number;
    avgDeliveryTime: number;
    peakHoursWorked: number;
}
/**
 * Get rider profile
 */
export declare function getRiderProfile(userId: string): Promise<RiderProfile | null>;
/**
 * Update rider profile
 */
export declare function updateRiderProfile(userId: string, updates: Partial<Pick<RiderProfile, 'name' | 'phone' | 'vehicleNumber' | 'avatar'>>): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Update rider online/offline status
 */
export declare function updateRiderStatus(userId: string, status: 'online' | 'offline' | 'busy'): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get rider's current status
 */
export declare function getRiderStatus(userId: string): Promise<'online' | 'offline' | 'busy' | null>;
/**
 * Get rider settings
 */
export declare function getRiderSettings(userId: string): Promise<RiderSettings>;
/**
 * Update rider settings
 */
export declare function updateRiderSettings(userId: string, settings: Partial<RiderSettings>): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Get rider statistics
 */
export declare function getRiderStats(riderId: string): Promise<RiderStats>;
