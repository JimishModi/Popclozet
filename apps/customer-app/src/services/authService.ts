import { supabase } from '@popclozet/api-client';

export type UserRole = 'admin' | 'staff' | 'customer';

export interface UserRoleData {
    id: string;
    userId: string;
    role: UserRole;
    createdAt: string;
}

class AuthService {
    // TESTING MODE: Set to true to bypass authentication
    private TESTING_MODE = false;

    // Check if user is authenticated
    async isAuthenticated(): Promise<boolean> {
        if (this.TESTING_MODE) return true;

        const { data: { user } } = await supabase.auth.getUser();
        return !!user;
    }

    // Get current user (Supabase user object)
    async getCurrentUser() {
        if (this.TESTING_MODE) {
            return { id: 'test-admin-user', email: 'admin@test.com' } as any;
        }

        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    // Get user role
    async getUserRole(): Promise<UserRole | null> {
        if (this.TESTING_MODE) return 'admin';

        try {
            const user = await this.getCurrentUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('user_roles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (error || !data) {
                return 'customer';
            }

            return data.role as UserRole;
        } catch (error) {
            console.error('❌ Failed to get user role:', error);
            return 'customer';
        }
    }

    // Check if user is admin
    async isAdmin(): Promise<boolean> {
        if (this.TESTING_MODE) return true;

        const role = await this.getUserRole();
        return role === 'admin';
    }

    // Check if user is staff or admin
    async isStaffOrAdmin(): Promise<boolean> {
        if (this.TESTING_MODE) return true;

        const role = await this.getUserRole();
        return role === 'admin' || role === 'staff';
    }

    // Set user role (admin only)
    async setUserRole(userId: string, role: UserRole): Promise<void> {
        try {
            const isAdmin = await this.isAdmin();
            if (!isAdmin && !this.TESTING_MODE) {
                throw new Error('Only admins can set user roles');
            }

            const { error } = await supabase
                .from('user_roles')
                .upsert({
                    user_id: userId,
                    role,
                });

            if (error) throw error;

            console.log('✅ User role set:', userId, role);
        } catch (error) {
            console.error('❌ Failed to set user role:', error);
            throw error;
        }
    }

    // Create admin user (for initial setup)
    async createAdminUser(email: string): Promise<void> {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            if (user.email !== email && !this.TESTING_MODE) {
                throw new Error('Email does not match current user');
            }

            const { error } = await supabase
                .from('user_roles')
                .upsert({
                    user_id: user.id,
                    role: 'admin',
                });

            if (error) throw error;

            console.log('✅ Admin user created:', email);
        } catch (error) {
            console.error('❌ Failed to create admin user:', error);
            throw error;
        }
    }

    // Toggle testing mode
    setTestingMode(enabled: boolean) {
        this.TESTING_MODE = enabled;
        console.log(`🧪 Testing mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
}

// Export singleton instance
export const authService = new AuthService();
