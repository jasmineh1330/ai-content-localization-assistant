// Interface for posts
export interface GeneratedPost {
    id: string
    platform: "tiktok" | "linkedin" | "reddit" | "twitter"
    content: string
    hashtags?: string[]
    title?: string
    productFacts?: { fact: string; source: string }[]
    reviewRequired?: string[]
    scenePlan?: SceneShot[]
}

// One shot of a short-video storyboard (borrowed from OpenMontage's scene_plan stage)
export interface SceneShot {
    start: number
    end: number
    visual: string
    voiceover: string
    onScreenText?: string
}

// Evidence extracted from an uploaded image or reference video via vision analysis
export interface VisualEvidence {
    id: string
    name: string
    kind: "image" | "video"
    facts: { fact: string; source: string }[]
    textFromImage: string
    styleNotes: string
    risks: string[]
    createdAt: string
}

// Interface for User defined post configurations
export interface UserConfig {
    knowledgeBase: string
    topic: string
    tone: string
    targetAudience: string
    targetMarket: string
    bannedPhrases: string
    postLength: string
    postsPerPlatform: {
        tiktok: number
        linkedin: number
        reddit: number
        twitter: number
    }
    visualEvidence?: VisualEvidence[]
}

// Interface for API key providers
export interface ApiKeys {
    openai: string
    gemini: string
}
