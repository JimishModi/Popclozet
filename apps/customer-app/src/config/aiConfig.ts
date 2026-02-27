// AI Configuration for Gemini-powered SOP generation

export const AI_CONFIG = {
    apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
    model: 'gemini-1.5-flash',
    maxTokens: 2048,
    temperature: 0.7,
};

// Fabric hints for different clothing categories
export const CATEGORY_FABRIC_HINTS: Record<string, string[]> = {
    // Tops
    'shirt': ['cotton', 'polyester', 'linen'],
    'blouse': ['silk', 'satin', 'chiffon', 'cotton'],
    't-shirt': ['cotton', 'jersey', 'polyester blend'],
    'sweater': ['wool', 'cashmere', 'acrylic', 'cotton knit'],
    'hoodie': ['cotton fleece', 'polyester fleece'],
    'jacket': ['leather', 'denim', 'polyester', 'nylon'],
    'blazer': ['wool', 'polyester blend', 'cotton twill'],
    'coat': ['wool', 'cashmere', 'polyester', 'down'],
    'cardigan': ['cotton knit', 'wool', 'cashmere'],
    'tank top': ['cotton', 'jersey', 'silk'],
    'crop top': ['cotton', 'polyester', 'spandex blend'],

    // Bottoms
    'pants': ['cotton', 'polyester', 'wool blend'],
    'jeans': ['denim', 'cotton twill'],
    'trousers': ['wool', 'cotton chino', 'polyester blend'],
    'shorts': ['cotton', 'linen', 'denim'],
    'skirt': ['cotton', 'polyester', 'silk', 'wool'],
    'leggings': ['spandex', 'nylon', 'polyester blend'],

    // Dresses
    'dress': ['silk', 'chiffon', 'cotton', 'polyester', 'satin'],
    'gown': ['silk', 'satin', 'tulle', 'velvet'],
    'maxi dress': ['cotton', 'rayon', 'jersey'],
    'mini dress': ['polyester', 'cotton', 'silk blend'],
    'cocktail dress': ['satin', 'silk', 'sequin fabric'],

    // Formal wear
    'suit': ['wool', 'polyester blend', 'cotton blend'],
    'tuxedo': ['wool', 'silk blend'],
    'formal shirt': ['cotton', 'silk', 'polyester blend'],

    // Casual wear
    'casual': ['cotton', 'polyester', 'jersey'],
    'athleisure': ['polyester', 'spandex', 'nylon'],
    'loungewear': ['cotton', 'modal', 'fleece'],

    // Outerwear
    'raincoat': ['nylon', 'polyester', 'PVC'],
    'parka': ['nylon', 'polyester', 'down filled'],
    'vest': ['polyester', 'down', 'fleece'],

    // Accessories (clothing)
    'scarf': ['silk', 'wool', 'cashmere', 'cotton'],
    'shawl': ['silk', 'wool', 'pashmina'],

    // Default
    'default': ['cotton', 'polyester blend'],
};

// Prompt templates for AI generation
export const PROMPT_TEMPLATES = {
    fabricInference: (category: string, gender: string, fabricHint?: string) => `
You are a fashion and textile expert. Based on the following clothing item details, infer the most likely fabric type and composition.

Category: ${category}
Gender: ${gender}
${fabricHint ? `Fabric Hint: ${fabricHint}` : 'No fabric hint provided'}

Respond with a JSON object in this exact format:
{
    "fabricType": "primary fabric type (e.g., cotton, silk, wool)",
    "composition": "detailed composition (e.g., 95% Cotton, 5% Elastane)",
    "confidence": "high" | "medium" | "low"
}

Consider the typical fabrics used for this type of garment and the ${gender}'s fashion market. If a fabric hint is provided, use it as a strong indicator.
`,

    sopGeneration: (fabricType: string, composition: string, category: string, gender: string) => `
You are a professional garment care and hygiene specialist for a luxury clothing rental service. Generate a comprehensive Standard Operating Procedure (SOP) for cleaning and sanitizing this rental garment.

Garment Details:
- Category: ${category}
- Gender: ${gender}
- Fabric Type: ${fabricType}
- Composition: ${composition}

Generate a detailed hygiene SOP in the following JSON format:
{
    "cleaningProcedure": {
        "method": "cleaning method (e.g., Machine Wash, Dry Clean Only)",
        "temperature": "temperature setting",
        "detergent": "recommended detergent type",
        "drying": "drying instructions",
        "ironingTemp": "ironing temperature if applicable",
        "specialCare": ["array of special care instructions"]
    },
    "hygieneSteps": {
        "preCleaning": ["array of pre-cleaning steps"],
        "sanitization": ["array of sanitization steps"],
        "postCleaning": ["array of post-cleaning steps"],
        "qualityCheck": ["array of quality check steps"]
    },
    "storageGuidelines": "detailed storage instructions",
    "inspectionChecklist": ["array of inspection items with checkmarks"],
    "specialInstructions": "any special instructions for this specific garment type"
}

Ensure the SOP is appropriate for a professional rental service with high hygiene standards. Include specific temperatures, times, and product recommendations where applicable.
`,
};
