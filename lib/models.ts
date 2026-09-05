/**
 * Configuration for available LLM models in the chat application
 */

export interface LLMModel {
    id: string;
    name: string;
    provider: string;
    available: boolean;
}

/**
 * List of all configured LLM models
 * To add new models: Add them here and ensure they're supported by OpenRouter
 */

export const AVAILABLE_MODELS: LLMModel[] = [
    {
        id: "gpt-5.6-sol",
        name: "GPT-5.6 Sol",
        provider: "OpenAI",
        available: true,
    },
    {
        id: "gpt-5.6-terra",
        name: "GPT-5.6 Terra",
        provider: "OpenAI",
        available: true,
    },
    {
        id: "gpt-5.5",
        name: "GPT-5.5",
        provider: "OpenAI",
        available: true,
    },
    {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        provider: "Google",
        available: true,
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        provider: "Google",
        available: true,
    },
]

/**
 * Get a specific model by its ID
 */

export function getModelById(modelId: string): LLMModel | undefined {
    return AVAILABLE_MODELS.find((model) => model.id === modelId);
}


/**
 * Get only the models that are currently available/enabled
 */

export function getAvailableModels(): LLMModel[] {
    return AVAILABLE_MODELS.filter((model) => model.available);
}
