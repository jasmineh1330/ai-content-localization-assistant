"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { toast } from "sonner"
import { Send } from "lucide-react"
import type { LLMModel } from "@/lib/models"
import type { ApiKeys, GeneratedPost, UserConfig } from "@/lib/types"

interface RefineChatProps {
  post: GeneratedPost
  userConfig: UserConfig
  selectedModel: LLMModel
  apiKeys: ApiKeys
  openAIBaseURL: string
  onRefined: (post: GeneratedPost) => void
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

const QUICK_INSTRUCTIONS = [
  "Hook 更强一点",
  "更口语化，像本地创作者",
  "压缩到 20 秒左右",
  "换一个开场场景",
]

// Conversational refinement for a single post. Every revision goes through the
// server-side evidence gate again, so human-review guarantees survive edits.
export function RefineChat({ post, userConfig, selectedModel, apiKeys, openAIBaseURL, onRefined }: RefineChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
    setInput("")
  }, [post.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const currentKey = selectedModel.provider === "OpenAI" ? apiKeys.openai : apiKeys.gemini

  const send = async (instruction: string) => {
    const trimmed = instruction.trim()
    if (!trimmed || loading) return
    if (!currentKey) {
      toast.error(`请先在设置中添加 ${selectedModel.provider === "OpenAI" ? "OpenAI" : "Google"} API key。`)
      return
    }

    setLoading(true)
    setInput("")
    const history = messages
    setMessages(prev => [...prev, { role: "user", text: trimmed }])

    try {
      const response = await fetch("/api/refine-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post,
          instruction: trimmed,
          history,
          config: userConfig,
          model: selectedModel.id,
          provider: selectedModel.provider,
          apiKey: currentKey,
          openAIBaseURL,
        }),
      })
      if (!response.ok) throw new Error("精修失败")
      const data = await response.json()
      const replyText = data.evidenceGated > 0
        ? `${data.assistantReply}\n⚠ ${data.evidenceGated} 条内容未通过证据校验，已转入待人工确认。`
        : `${data.assistantReply}\n✓ 修改已通过事实证据校验。`
      setMessages(prev => [...prev, { role: "assistant", text: replyText }])
      onRefined(data.post as GeneratedPost)
    } catch (error) {
      toast.error(`精修失败：${error instanceof Error ? error.message : error}`)
      setMessages(prev => prev.slice(0, -1))
      setInput(trimmed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div ref={scrollRef} className="max-h-44 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            用一句话让 AI 修改这条内容。每次修改都会重新校验事实来源与禁用词，结果不会绕过审核门控。
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-1.5 text-sm ${message.role === "user"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100"}`}>
              {message.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_INSTRUCTIONS.map(instruction => (
            <button
              key={instruction}
              onClick={() => send(instruction)}
              disabled={loading}
              className="text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              {instruction}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(input) }}
          placeholder="例如：把 hook 改成提问式，但不要新增任何规格数字"
          className="h-9 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={loading}
        />
        <Button size="sm" onClick={() => send(input)} disabled={loading || !input.trim()} className="h-9 w-9 p-0">
          {loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
