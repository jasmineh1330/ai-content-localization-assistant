import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { decryptApiKey } from "@/lib/encryption"
import { z } from "zod"
import { normalizeForEvidenceCheck } from "@/lib/evidence"
import type { VisualEvidence } from "@/lib/types"

interface AnalyzeRequest {
  kind: "image" | "video"
  assets: { name: string; dataUrl: string }[]
  hint?: string
  model: string
  provider: string
  apiKey: string
  openAIBaseURL?: string
}

// Mirrors the fact-checking rule used for pasted text: a fact only counts as
// evidence-backed when its quoted source is actually readable in the asset.
function verifyFactsAgainstAsset(facts: { fact: string; source: string }[], textFromImage: string) {
  const assetText = normalizeForEvidenceCheck(textFromImage)
  const supported: { fact: string; source: string }[] = []
  const unmatched: string[] = []
  for (const item of facts || []) {
    const source = normalizeForEvidenceCheck(item.source)
    if (source.length >= 4 && assetText.includes(source)) supported.push(item)
    else unmatched.push(item.fact)
  }
  return { supported, unmatched }
}

const imageSystem = `You are a multilingual product-marketing evidence extractor for a content localization team.
You receive product/reference images and must extract only what is actually visible or readable in them.

Rules:
- facts: marketing-relevant product facts clearly visible in the images (specs, features, camera modules, capacity, certifications printed on the device/packaging/poster). Each fact's "source" MUST be an exact snippet of text readable in the images (at least a few words). If a spec is only implied by the picture but not written anywhere, still include it but quote the most concrete visual detail you can; the server will double-check you.
- NEVER report prices, discounts, availability, launch dates, rankings or awards as facts — put them in risks instead, they always need human verification.
- textFromImage: transcribe ALL readable text in the images (labels, badges, spec sheets, captions), separated by newlines. It is used for evidence matching, so completeness matters.
- styleNotes: concise creative-direction notes a short-video creator can reuse — visual style (palette, lighting, framing, mood), verbal style (hook pattern, tone of captions), and anything culturally distinctive.
- Respond in English. If the image text is in another language, translate facts to English but keep the original snippet as the source quote.`

const videoSystem = `You are a short-video reference analyst for a content localization team.
You receive frames sampled from one reference video (e.g. a competitor or past hit TikTok) and must describe what makes it work.

Rules:
- styleNotes (most important): describe the creative DNA visible across the frames — pacing you can infer, the 3-second hook pattern, scene structure (shot count, framing, close-up vs lifestyle), on-screen caption style, transitions, and how the product is shown. Write it as reusable direction for a creator shooting a similar video for a different market.
- facts: ONLY claims readable as on-screen text or labels in the frames; each fact's "source" MUST be an exact readable snippet. Everything else must NOT become a fact.
- textFromImage: transcribe all readable on-screen text and captions across frames, in frame order, prefixed by "Frame N:".
- risks: any price, availability, launch date, ranking, award, or comparative claim you see, plus anything ambiguous that needs human verification.
- Respond in English.`

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json()
    const { kind, assets, hint, model, provider, apiKey, openAIBaseURL } = body

    if (!assets?.length || !model || !provider || !apiKey || !["image", "video"].includes(kind)) {
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

    const content: ({ type: "text"; text: string } | { type: "image"; image: string })[] = [
      {
        type: "text",
        text: hint?.trim()
          ? `Analyzing ${assets.length} uploaded asset(s). Operator hint: ${hint.trim()}`
          : `Analyzing ${assets.length} uploaded asset(s).`,
      },
      ...assets.map(asset => ({ type: "image" as const, image: asset.dataUrl })),
    ]

    const { object } = await generateObject({
      model: aiModel(model),
      system: kind === "video" ? videoSystem : imageSystem,
      messages: [{ role: "user", content }],
      temperature: 0.2,
      schema: z.object({
        textFromImage: z.string().describe("All readable text in the assets, newline separated (frame-prefixed for video)"),
        facts: z.array(z.object({
          fact: z.string().describe("A marketing-relevant fact visible in the asset"),
          source: z.string().describe("Exact readable text snippet backing the fact")
        })),
        styleNotes: z.string().describe("Reusable creative-direction notes for short-video creators"),
        risks: z.array(z.string()).describe("Claims needing human verification (prices, availability, rankings...) or ambiguous readings")
      })
    })

    const { supported, unmatched } = verifyFactsAgainstAsset(object.facts || [], object.textFromImage || "")
    const risks = [...(object.risks || [])]
    for (const fact of unmatched) {
      risks.push(`${fact} — could not be matched to readable text in the asset`)
    }

    const evidence: Omit<VisualEvidence, "id" | "createdAt"> = {
      name: assets.length === 1 ? assets[0].name : `${assets[0].name} +${assets.length - 1}`,
      kind,
      facts: supported,
      textFromImage: (object.textFromImage || "").slice(0, 4000),
      styleNotes: object.styleNotes || "",
      risks: risks.slice(0, 12),
    }

    return NextResponse.json({ evidence })
  } catch (error) {
    console.error("Error in analyze-reference API:", error)
    return NextResponse.json({ error: "Failed to analyze reference assets" }, { status: 500 })
  }
}
