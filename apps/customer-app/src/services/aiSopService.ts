import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_CONFIG, PROMPT_TEMPLATES, CATEGORY_FABRIC_HINTS } from '@/config/aiConfig';

// Types for SOP structure
export interface FabricInference {
    fabricType: string;
    composition: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface CleaningProcedure {
    method: string;
    temperature: string;
    detergent: string;
    drying: string;
    ironingTemp?: string;
    specialCare: string[];
}

export interface HygieneSteps {
    preCleaning: string[];
    sanitization: string[];
    postCleaning: string[];
    qualityCheck: string[];
}

export interface HygieneSOP {
    cleaningProcedure: CleaningProcedure;
    hygieneSteps: HygieneSteps;
    storageGuidelines: string;
    inspectionChecklist: string[];
    specialInstructions: string;
}

class AISopService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor() {
        if (AI_CONFIG.apiKey) {
            this.genAI = new GoogleGenerativeAI(AI_CONFIG.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: AI_CONFIG.model });
        }
    }

    // Check if AI service is available
    isAvailable(): boolean {
        return this.model !== null;
    }

    // Infer fabric type from product details
    async inferFabricType(
        category: string,
        gender: string,
        fabricHint?: string
    ): Promise<FabricInference> {
        if (!this.isAvailable()) {
            return this.getFallbackFabricInference(category, fabricHint);
        }

        try {
            const prompt = PROMPT_TEMPLATES.fabricInference(category, gender, fabricHint);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const inference: FabricInference = JSON.parse(jsonMatch[0]);
                console.log('✅ AI Fabric Inference:', inference);
                return inference;
            }

            throw new Error('Invalid AI response format');
        } catch (error) {
            console.error('❌ AI fabric inference failed:', error);
            return this.getFallbackFabricInference(category, fabricHint);
        }
    }

    // Fallback fabric inference (rule-based)
    private getFallbackFabricInference(category: string, fabricHint?: string): FabricInference {
        if (fabricHint) {
            return {
                fabricType: fabricHint.toLowerCase(),
                composition: `Primary: ${fabricHint}`,
                confidence: 'medium',
            };
        }

        const categoryLower = category.toLowerCase();
        const hints = CATEGORY_FABRIC_HINTS[categoryLower] || ['cotton'];
        const fabricType = hints[0];

        return {
            fabricType,
            composition: `Estimated: ${fabricType}`,
            confidence: 'low',
        };
    }

    // Generate comprehensive hygiene SOP
    async generateHygieneSOP(
        fabricType: string,
        composition: string,
        category: string,
        gender: string
    ): Promise<HygieneSOP> {
        if (!this.isAvailable()) {
            return this.getFallbackSOP(fabricType, category);
        }

        try {
            const prompt = PROMPT_TEMPLATES.sopGeneration(fabricType, composition, category, gender);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse JSON response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const sop: HygieneSOP = JSON.parse(jsonMatch[0]);
                console.log('✅ AI SOP Generated:', sop);
                return sop;
            }

            throw new Error('Invalid AI response format');
        } catch (error) {
            console.error('❌ AI SOP generation failed:', error);
            return this.getFallbackSOP(fabricType, category);
        }
    }

    // Fallback SOP generation (template-based)
    private getFallbackSOP(fabricType: string, category: string): HygieneSOP {
        const isDryCleanOnly = ['wool', 'silk', 'leather', 'cashmere'].some(f =>
            fabricType.toLowerCase().includes(f)
        );

        return {
            cleaningProcedure: {
                method: isDryCleanOnly ? 'Professional Dry Cleaning' : 'Machine Wash',
                temperature: isDryCleanOnly ? 'N/A' : '30°C (Cold)',
                detergent: isDryCleanOnly ? 'Professional dry cleaning solvents' : 'Mild liquid detergent',
                drying: isDryCleanOnly ? 'Air dry on hanger' : 'Tumble dry low or air dry',
                ironingTemp: isDryCleanOnly ? 'Low heat with pressing cloth' : 'Medium heat',
                specialCare: [
                    'Turn garment inside out before cleaning',
                    'Remove all accessories and detachable items',
                    'Check care label for specific instructions',
                ],
            },
            hygieneSteps: {
                preCleaning: [
                    'Inspect garment for stains, damage, or odors',
                    'Remove lint, hair, and debris',
                    'Pre-treat visible stains with appropriate stain remover',
                    'Empty all pockets',
                ],
                sanitization: [
                    'Steam sanitization at 100°C for 10 minutes',
                    'UV-C light treatment for 15 minutes',
                    'Apply fabric-safe disinfectant spray',
                    'Allow to air out for 30 minutes',
                ],
                postCleaning: [
                    'Inspect for remaining stains or damage',
                    'Steam press to remove wrinkles',
                    'Quality check all fasteners and seams',
                    'Package in breathable garment bag',
                ],
                qualityCheck: [
                    'Visual inspection under good lighting',
                    'Odor test',
                    'Functionality check (buttons, zippers)',
                    'Fabric integrity assessment',
                ],
            },
            storageGuidelines: `Store in a clean, breathable garment bag in a climate-controlled environment (18-22°C, 40-50% humidity). Keep away from direct sunlight and moisture. Ensure adequate spacing to prevent wrinkles and fabric damage.`,
            inspectionChecklist: [
                '✓ No visible stains or discoloration',
                '✓ No odors present',
                '✓ All buttons, zippers, and fasteners functional',
                '✓ No tears, holes, or loose threads',
                '✓ Lining intact and properly attached',
                '✓ Seams secure and not fraying',
                '✓ Fabric texture and color consistent',
                '✓ No signs of pest damage or mildew',
            ],
            specialInstructions: `This is a rental garment and must be cleaned and sanitized after each use. Follow all hygiene protocols strictly to ensure customer safety and satisfaction. Document any damage or issues in the rental management system.`,
        };
    }

    // Generate complete SOP from minimal product data
    async generateCompleteSOP(productData: {
        category: string;
        gender: string;
        fabricHint?: string;
    }): Promise<{
        fabricInference: FabricInference;
        hygieneSOP: HygieneSOP;
    }> {
        console.log('🤖 Generating AI-powered SOP for:', productData);

        // Step 1: Infer fabric type
        const fabricInference = await this.inferFabricType(
            productData.category,
            productData.gender,
            productData.fabricHint
        );

        // Step 2: Generate hygiene SOP
        const hygieneSOP = await this.generateHygieneSOP(
            fabricInference.fabricType,
            fabricInference.composition,
            productData.category,
            productData.gender
        );

        return {
            fabricInference,
            hygieneSOP,
        };
    }

    // Update SOP based on rental history
    async updateSOPWithHistory(
        currentSOP: HygieneSOP,
        rentalCount: number,
        issues: string[]
    ): Promise<HygieneSOP> {
        // Add more stringent checks for heavily rented items
        if (rentalCount > 10) {
            currentSOP.inspectionChecklist.push(
                '✓ Extra inspection for wear and tear (10+ rentals)',
                '✓ Check for fabric thinning or weakening'
            );
        }

        // Add specific checks based on reported issues
        if (issues.length > 0) {
            currentSOP.specialInstructions += `\n\nPrevious Issues: ${issues.join(', ')}. Pay special attention to these areas during inspection.`;
        }

        return currentSOP;
    }
}

// Export singleton instance
export const aiSopService = new AISopService();
