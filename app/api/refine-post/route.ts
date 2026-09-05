import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { decryptApiKey } from "@/lib/encryption"
import { z } from "zod"
import { validateProductFacts, findBannedPhrases, buildEvidenceSourceText, buildVisualEvidencePrompt } from "@/lib/evidence"
import type { GeneratedPost, UserConfig } from "@/lib/types"

interface RefineRequest {
  post: GeneratedPost
  instruction: string
  history: { role: "user" | "assistant"; text: string }[]
  config: UserConfig
  model: string
  provider: string
  apiKey: string
  openAIBaseURL?: string
}

const refineSchema = z.object({
  content: z.string().describe("The revised post content in full"),
  title: z.string().describe("Revised title (may be unchanged)"),
  hashtags: z.array(z.string()).describe("Revised hashtag list"),
  productFacts: z.array(z.object({
    fact: z.string(),
    source: z.string().describe("Short quote from the supplied product information or visual references backing the fact")
  })).describe("Product claims that remain in the revised content, each backed by a source"),
  reviewRequired: z.array(z.string()).describe("Claims or wording in the revised content that a human must verify"),
  scenePlan: z.array(z.object({
    start: z.number(),
    end: z.number(),
    visual: z.string(),
    voiceover: z.string(),
    onScreenText: z.string().optional()
  })).optional().describe("Revised shot-by-shot storyboard; keep it when the original had one"),
  assistantReply: z.string().describe("One-sentence note to the operator summarizing what changed and any risk that now needs review")
})

const refineSystem = `You are a localization assistant helping a social-media operator iterate on one already-generated post.

Rules:
- Apply the operator's instruction faithfully but keep the post's platform, language and overall intent.
- Preserve evidence discipline: every product fact you keep or add must come from the supplied product information or visual references, with its source quote. If an instruction pushes the copy toward an unsupported claim (price, ranking, availability, new specs), do NOT add the claim — keep the copy safe and explain in assistantReply what needs confirmation.
- Keep the tone consistent with the post unless the instruction asks otherwise.
- assistantReply: one or two sentences, plain operator-facing English.

Safety and review requirements:
- Put uncertain, unsupported or risky statements in reviewRequired.
- Never use banned phrases supplied by the user.`

export async function POST(request: NextRequest) {
  try {
    const body: RefineRequest = await request.json()
    const { post, instruction, history, config, model, provider, apiKey, openAIBaseURL } = body

    if (!post?.content || !instruction?.trim() || !model || !provider || !apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const decryptedApiKey = decryptApiKey(apiKey)
    if (!decryptedApiKey) {
      return NextResponse.json({ error: "Invalid or corrupted API key" }, { status: 400 })
    }

    let aiModel
    if (provider === "OpenAI") {
      const openai = createOpenAI({ apiKey: decryptedApiKey, baseURL: openAIBaseURL || undefined })
      aiModel = openai
    } else if (provider === "Google") {
      const gemini = createGoogleGenerativeAI({ apiKey: decryptedApiKey })
      aiModel = gemini
    } else {
      return NextResponse.json({ error: "Invalid provider selected" }, { status: 400 })
    }

    const evidenceSourceText = buildEvidenceSourceText(config)
    const visualEvidencePrompt = buildVisualEvidencePrompt(config)

    const contextText = [
      `Platform: ${post.platform}`,
      config.targetMarket ? `Target Market: ${config.targetMarket}` : "",
      config.targetAudience ? `Target Audience: ${config.targetAudience}` : "",
      config.tone ? `Tone: ${config.tone}` : "",
      config.bannedPhrases ? `Banned Phrases (never use): ${config.bannedPhrases}` : "",
      config.knowledgeBase ? `Knowledge Base:\n${config.knowledgeBase}` : "",
      visualEvidencePrompt ? `Visual References:\n${visualEvidencePrompt}` : "",
      `Current post title: ${post.title || "(none)"}`,
      `Current post content:\n${post.content}`,
      (post.hashtags?.length ? `Current hashtags: ${post.hashtags.join(", ")}` : ""),
      post.scenePlan?.length
        ? `Current shot plan:\n${post.scenePlan.map(s => `${s.start}-${s.end}s | visual: ${s.visual} | VO: ${s.voiceover} | caption: ${s.onScreenText || "-"}`).join("\n")}`
        : "",
      post.productFacts?.length
        ? `Verified facts currently attached:\n${post.productFacts.map(f => `- ${f.fact} | source: "${f.source}"`).join("\n")}`
        : "",
      post.reviewRequired?.length
        ? `Open review items: ${post.reviewRequired.join("; ")}`
        : "",
    ].filter(Boolean).join("\n\n")

    const conversation = (history || []).slice(-6).map(turn => `${turn.role === "user" ? "Operator" : "Assistant"}: ${turn.text}`).join("\n")

    const userPrompt = [
      contextText,
      conversation ? `Conversation so far:\n${conversation}` : "",
      `Operator instruction: ${instruction.trim()}`,
      "Return the fully revised post. If the original had a shot plan, return the updated one too.",
    ].filter(Boolean).join("\n\n")

    const { object } = await generateObject({
      model: aiModel(model),
      system: refineSystem,
      prompt: userPrompt,
      temperature: 0.6,
      schema: refineSchema
    })

    // Re-run the same evidence gate as first generation, so the human-review
    // guarantee survives every conversational edit.
    const validatedFacts = validateProductFacts(object.productFacts || [], evidenceSourceText)
    const bannedHits = findBannedPhrases(object.content, config.bannedPhrases)
    const reviewRequired = [
      ...(object.reviewRequired || []),
      ...validatedFacts.unsupported,
      ...bannedHits.map(phrase => `Banned phrase used in the content: "${phrase}"`),
    ]
    const normalizedBanned = bannedHits.map(p => p.toLowerCase())
    const cleanFacts = validatedFacts.supported.filter(f => !normalizedBanned.some(b => f.fact.toLowerCase().includes(b)))

    const refinedPost: GeneratedPost = {
      ...post,
      content: object.content,
      title: object.title || post.title,
      hashtags: object.hashtags || post.hashtags,
      productFacts: cleanFacts,
      reviewRequired,
      scenePlan: object.scenePlan?.length ? object.scenePlan : post.scenePlan,
    }

    return NextResponse.json({
      post: refinedPost,
      assistantReply: object.assistantReply || "",
      evidenceGated: validatedFacts.unsupported.length + bannedHits.length,
    })
  } catch (error) {
    console.error("Error in refine-post API:", error)
    return NextResponse.json({ error: "Failed to refine post" }, { status: 500 })
  }
}
