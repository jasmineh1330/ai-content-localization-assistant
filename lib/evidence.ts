import type { VisualEvidence } from "./types"

/**
 * Shared evidence-checking helpers.
 * The core product rule lives here: every product fact must be traceable to a
 * source the user actually supplied (pasted text, uploaded image or reference
 * video), and anything untraceable must surface in reviewRequired instead of
 * being published.
 */

export function normalizeForEvidenceCheck(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim()
}

export function validateProductFacts(facts: { fact: string; source: string }[], evidenceSourceText: string) {
    const sourceText = normalizeForEvidenceCheck(evidenceSourceText)
    const supported: { fact: string; source: string }[] = []
    const unsupported: string[] = []
    for (const item of facts || []) {
        const source = normalizeForEvidenceCheck(item.source)
        if (source.length >= 4 && sourceText.includes(source)) supported.push(item)
        else unsupported.push(`${item.fact} — source could not be matched to the supplied product information`)
    }
    return { supported, unsupported }
}

// Returns banned phrases that actually appear in the content.
export function findBannedPhrases(content: string, bannedPhrases?: string) {
    if (!bannedPhrases?.trim() || !content) return []
    const normalizedContent = normalizeForEvidenceCheck(content)
    if (!normalizedContent) return []
    const phrases = bannedPhrases.split(/[,\n，、]+/).map(p => p.trim()).filter(p => p.length >= 2)
    const seen = new Set<string>()
    const matched: string[] = []
    for (const phrase of phrases) {
        const normalizedPhrase = normalizeForEvidenceCheck(phrase)
        if (normalizedPhrase && normalizedContent.includes(normalizedPhrase) && !seen.has(normalizedPhrase)) {
            seen.add(normalizedPhrase)
            matched.push(phrase)
        }
    }
    return matched
}

// Text the fact checker may match against: pasted knowledge base + every visual evidence entry.
export function buildEvidenceSourceText(config: { knowledgeBase?: string; visualEvidence?: VisualEvidence[] }) {
    const parts = [config.knowledgeBase || ""]
    for (const evidence of config.visualEvidence || []) {
        parts.push(evidence.textFromImage || "")
        parts.push((evidence.facts || []).map(f => `${f.fact} ${f.source}`).join(" "))
    }
    return parts.filter(Boolean).join("\n")
}

// Compact prompt-side summary of the visual evidence the user attached.
export function buildVisualEvidencePrompt(config: { visualEvidence?: VisualEvidence[] }) {
    const entries = config.visualEvidence || []
    if (entries.length === 0) return ""
    return entries.map(evidence => {
        const lines = [`[Visual reference: ${evidence.name} (${evidence.kind})]`]
        if (evidence.facts?.length) {
            lines.push("Facts visible in this asset (each fact is backed by the quoted source text):")
            lines.push(...evidence.facts.map(f => `- ${f.fact} | source: "${f.source}"`))
        }
        if (evidence.textFromImage) lines.push(`Readable text: ${evidence.textFromImage}`)
        if (evidence.styleNotes) lines.push(`Style notes: ${evidence.styleNotes}`)
        if (evidence.risks?.length) lines.push(`Claims that need human verification: ${evidence.risks.join("; ")}`)
        return lines.join("\n")
    }).join("\n\n")
}
