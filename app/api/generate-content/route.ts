import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { decryptApiKey } from "@/lib/encryption";
import { z } from 'zod';
import { validateProductFacts, findBannedPhrases, buildEvidenceSourceText, buildVisualEvidencePrompt } from "@/lib/evidence";
import type { UserConfig } from "@/lib/types";

interface Post {
  id: string
  platform: string
  content: string
  hashtags?: string[]
  title?: string
  productFacts?: { fact: string; source: string }[]
  reviewRequired?: string[]
  scenePlan?: { start: number; end: number; visual: string; voiceover: string; onScreenText?: string }[]
}

interface GenerateRequest {
  prompt: string
  platforms: string[]
  config: UserConfig
  model: string
  provider: string
  apiKey: string
  openAIBaseURL?: string
}

const platformPrompts = {
  tiktok: {
    instructions: `Create a 20-35 second TikTok voiceover tailored to the configured target market and target audience. Open with a visual hook in the first 3 seconds, translate product specs into concrete everyday local scenarios, sound like a local creator rather than an advert, and end with a clear but non-misleading CTA. Avoid unsupported price, availability, ranking, or certification claims. You MUST also return a scenePlan: 4-7 shots covering the full 20-35 seconds in order, each with start/end seconds, a concrete visual direction (what the camera sees), the voiceover line spoken in that shot, and short on-screen caption text. The voiceover lines across shots must assemble into the full script.`,
    format: "Hook, scene beats, voiceover, CTA, disclaimer, shot-by-shot plan",
  },
  linkedin: {
    instructions: `Create professional LinkedIn content that:
    - Uses a professional yet engaging tone
    - Includes industry insights and thought leadership
    - Encourages professional networking and engagement
    - Uses relevant professional hashtags
    - Has a clear call-to-action for professional growth
    - Follows LinkedIn best practices for visibility and engagement`,
    format: "Professional post with insights and hashtags",
  },
  reddit: {
    instructions: `Create Reddit content that:
    - Matches the conversational, authentic tone of Reddit
    - Provides genuine value and insights
    - Encourages discussion and community engagement
    - Avoids overly promotional language
    - Includes relevant context and background
    - Follows Reddit etiquette and community guidelines`,
    format: "Discussion-focused post with context and engagement hooks",
  },
  twitter: {
    instructions: `Create Twitter/X content that:
    - Is concise and impactful
    - Uses trending hashtags and mentions when relevant
    - Includes engaging hooks and calls-to-action
    - Encourages retweets and replies
    - Uses thread format for longer content
    - Optimized for Twitter's algorithm and engagement`,
    format: "Concise, engaging tweet or thread",
  },
}

const postSchema = z.object({
  content: z.string().describe("The main post content"),
  title: z.string().describe("Optional title for the post (if applicable)"),
  hashtags: z.array(z.string()).describe("hashtags for post ranking e.g. ['hashtag1', 'hashtag2', 'hashtag3', ...]"),
  productFacts: z.array(z.object({
    fact: z.string().describe("The product claim used in the post"),
    source: z.string().describe("A short quote or field from the supplied product information or visual references that supports the claim")
  })).describe("Claims directly supported by the supplied product information or visual references, with their source"),
  reviewRequired: z.array(z.string()).describe("Claims or wording that a human must verify before publishing"),
  scenePlan: z.array(z.object({
    start: z.number().describe("Shot start time in seconds"),
    end: z.number().describe("Shot end time in seconds"),
    visual: z.string().describe("What the camera sees in this shot"),
    voiceover: z.string().describe("Voiceover line spoken during this shot"),
    onScreenText: z.string().optional().describe("Short on-screen caption or sticker text")
  })).optional().describe("Shot-by-shot storyboard (required for TikTok)")
})

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json()
    const { prompt, platforms, config, model, provider, apiKey, openAIBaseURL } = body

    if (!platforms || !prompt || !model || !provider || !apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Decrypt the API key before using it
    const decryptedApiKey = decryptApiKey(apiKey)
    if (!decryptedApiKey) {
      return NextResponse.json({ error: "Invalid or corrupted API key" }, { status: 400 })
    }

    // Configure the AI model
    let aiModel
    if (provider === "OpenAI") {
      const openai = createOpenAI({
        apiKey: decryptedApiKey,
        baseURL: openAIBaseURL ? openAIBaseURL : undefined
      })
      aiModel = openai
    } else if (provider === "Google") {
      const gemini = createGoogleGenerativeAI({
        apiKey: decryptedApiKey,
      })
      aiModel = gemini
    } else {
      return NextResponse.json({ error: "Invalid provider selected" }, { status: 400 })
    }

    // Facts may come from pasted text AND from analyzed images/reference videos.
    const evidenceSourceText = buildEvidenceSourceText(config)
    const visualEvidencePrompt = buildVisualEvidencePrompt(config)

    const generatedPosts: Post[] = []

    // Generate content for each selected platform
    for (const platform of platforms) {
      const platformConfig = platformPrompts[platform as keyof typeof platformPrompts]
      const postsToGenerate = config.postsPerPlatform[platform as keyof typeof config.postsPerPlatform]

      const systemPrompt = `You are an expert social media content creator specializing in ${platform}. 

        User Context:
        ${config.knowledgeBase ? `Knowledge Base: ${config.knowledgeBase}` : ""}
        ${visualEvidencePrompt ? `Visual References (extracted from user-uploaded images/videos):\n${visualEvidencePrompt}` : ""}
        ${config.topic ? `Topic Focus: ${config.topic}` : ""}
        ${config.targetAudience ? `Target Audience: ${config.targetAudience}` : ""}
        ${config.targetMarket ? `Target Market: ${config.targetMarket}` : ""}
        ${config.bannedPhrases ? `Banned Phrases (never use): ${config.bannedPhrases}` : ""}
        Tone: ${config.tone}
        Post Length: ${config.postLength}

        Platform Instructions: ${platformConfig.instructions}

        Generate ${postsToGenerate} unique, high-quality posts that will perform well on ${platform}. Each post should be optimized for maximum engagement and reach on this specific platform.

        Safety and review requirements:
        - Only treat information explicitly present in the user's product information or visual references as a product fact.
        - Do not invent prices, rankings, certifications, performance numbers, or product specifications.
        - Put uncertain claims, unsupported claims, and statements needing human verification in reviewRequired.
        - Do not use any banned phrases supplied by the user.

        Make sure each post is unique, valuable, and tailored specifically for ${platform}'s audience and algorithm.`

      const userPrompt = `Create ${postsToGenerate} ${platform} posts about: ${prompt}

        Format: ${platformConfig.format}

        Remember to make each post unique and optimized for ${platform} specifically.`

      try {
        const { object } = await generateObject({
          model: aiModel(model),
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.8,
          output: 'array',
          schema: postSchema
        })

        // Add platform info and unique IDs to each post
        object.forEach((post) => {
          const validatedFacts = validateProductFacts(post.productFacts || [], evidenceSourceText)
          const bannedHits = findBannedPhrases(post.content, config.bannedPhrases)

          // Core review gate: anything unverifiable — model-flagged, evidence-unmatched,
          // or banned — lands in reviewRequired and never silently passes.
          const reviewRequired = [
            ...(post.reviewRequired || []),
            ...validatedFacts.unsupported,
            ...bannedHits.map(phrase => `Banned phrase used in the content: "${phrase}"`),
          ]

          // Strip banned phrases from the fact list so a banned claim can't be
          // presented as verified evidence.
          const normalizedBanned = bannedHits.map(p => p.toLowerCase())
          const cleanFacts = validatedFacts.supported.filter(f => !normalizedBanned.some(b => f.fact.toLowerCase().includes(b)))

          generatedPosts.push({
            id: `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            platform: platform,
            content: post.content,
            title: post.title,
            hashtags: post.hashtags || [],
            productFacts: cleanFacts,
            reviewRequired,
            scenePlan: platform === "tiktok" ? post.scenePlan : undefined,
          })
        })
      } catch (error) {
        console.error(`Error generating content for ${platform}:`, error)
        // Continue with other platforms even if one fails
      }
    }

    if (generatedPosts.length === 0) {
      return NextResponse.json({ error: "Failed to generate any content" }, { status: 500 })
    }

    return NextResponse.json({ posts: generatedPosts })
  } catch (error) {
    console.error("Error in generate-content API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
