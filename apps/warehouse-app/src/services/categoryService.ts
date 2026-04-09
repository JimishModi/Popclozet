import { supabase } from '@popclozet/api-client';

export interface CategoryConfig {
    category: string;
    display_name: string;
    image_url: string | null;
    sizes: string[];
    created_at?: string;
}

export async function getAllCategoryConfigs(): Promise<CategoryConfig[]> {
    const { data, error } = await supabase
        .from('category_configs')
        .select('*')
        .order('category', { ascending: true });
    
    if (error) throw error;
    return data || [];
}

export async function updateCategoryConfig(category: string, updates: Partial<CategoryConfig>): Promise<void> {
    const { error } = await supabase
        .from('category_configs')
        .update(updates)
        .eq('category', category);
    
    if (error) throw error;
}

export async function createCategoryConfig(config: CategoryConfig): Promise<void> {
    const { error } = await supabase
        .from('category_configs')
        .insert(config);
    
    if (error) throw error;
}

export async function uploadCategoryPhoto(file: File, category: string): Promise<string | null> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filePath = `collection-page/${category.toLowerCase()}_${Date.now()}.${ext}`;

    try {
        const { error } = await supabase.storage
            .from('assets')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (error) throw error;

        const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
        return data.publicUrl;
    } catch (err) {
        console.error('[CategoryService] Upload failed:', err);
        return null;
    }
}
