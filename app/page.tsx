"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { FloatingInputArea } from "@/components/input-area/FloatingInputArea"
import { HeaderArea } from "@/components/HeaderArea"
import { ContentArea } from "@/components/ContentArea"
import { PostDetailDialog } from "@/components/post-detail/PostDetailDialog"
import { FooterArea } from "@/components/FooterArea";
import { getAvailableModels, type LLMModel } from "@/lib/models";
import { decryptApiKeys } from "@/lib/encryption"
import { ApiKeys, GeneratedPost, UserConfig } from "@/lib/types";
import { stopSpeaking } from "@/lib/speech"

export default function SocialMediaGenerator() {
  const modelOptions = getAvailableModels();

  const [prompt, setPrompt] = useState("")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["tiktok"])
  const [selectedModel, setSelectedModel] = useState<LLMModel>(modelOptions[0])
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [apiKeysOpen, setApiKeysOpen] = useState(false)
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null)
  const [editedContent, setEditedContent] = useState("")
  const { theme, setTheme } = useTheme()

  const [openAIBaseURL, setOpenAIBaseURL] = useState("");

  const [userConfig, setUserConfig] = useState<UserConfig>({
    knowledgeBase: "品牌：TECNO\n产品：CAMON 40 Pro 5G\n事实来源：请粘贴官方尼日利亚产品页参数。\n高风险字段（价格/上市时间）：待市场确认。",
    topic: "夜景人像与年轻摄影爱好者",
    tone: "professional",
    targetAudience: "尼日利亚年轻摄影爱好者",
    targetMarket: "Nigeria",
    bannedPhrases: "waterproof, best in the market, never charge again, guaranteed",
    postLength: "20-35 seconds",
    postsPerPlatform: {
      tiktok: 3,
      linkedin: 1,
      reddit: 3,
      twitter: 3,
    },
  })

  const [apiKeys, setApiKeys] = useState<ApiKeys>({
    openai: "",
    gemini: "",
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load API keys from localStorage on mount
  useEffect(() => {
    const savedKeys = localStorage.getItem("ai-api-keys");
    const openaiBaseURL = localStorage.getItem("openai-base-url");
    const savedConfigs = localStorage.getItem("post-config");
    const generatedContent = localStorage.getItem("get-generated-content");

    setOpenAIBaseURL(openaiBaseURL ?? "")

    if (savedConfigs) {
      try {
        setUserConfig(JSON.parse(savedConfigs))
      } catch (error) {
        console.error("Error loading Post configs:", error)
      }
    }

    if (savedKeys) {
      try {
        const encryptedKeys = JSON.parse(savedKeys)
        const decryptedKeys = decryptApiKeys(encryptedKeys)

        setApiKeys(decryptedKeys)
      } catch (error) {
        console.error("Error loading API keys:", error)

        try {
          const plainKeys = JSON.parse(savedKeys)
          setApiKeys(plainKeys)
        } catch (e) {
          console.error("Failed to load API keys:", e)
        }
      }
    }

    if (generatedContent) {
      try {
        setGeneratedPosts(JSON.parse(generatedContent))
      } catch (error) {
        console.error("Error loading generated posts from local: ", error)
      }
    }
  }, [])

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]))
  }

  const generateContent = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt to generate content.")
      return
    }

    if (selectedPlatforms.length === 0) {
      toast.warning("Please select at least one platform.")
      return
    }

    const currentApiKey = selectedModel.provider === "OpenAI" ? apiKeys.openai : apiKeys.gemini
    if (!currentApiKey) {
      toast.error(`Please add your ${selectedModel.provider === "OpenAI" ? "OpenAI" : "Google"} API key.`)
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          platforms: selectedPlatforms,
          config: userConfig,
          model: selectedModel.id,
          provider: selectedModel.provider,
          apiKey: currentApiKey,
          openAIBaseURL: openAIBaseURL
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate content")
      }

      const data = await response.json()

      setGeneratedPosts((prev) => {
        const updatedPosts = [...prev, ...data.posts];
        localStorage.setItem("get-generated-content", JSON.stringify(updatedPosts));
        return updatedPosts;
      });

      setPrompt("")
      toast.success(`Generated ${data.posts.length} posts successfully.`)
    } catch (error) {
      toast.error(`Failed to generate content: ${error}. Please try again.`)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("Content copied to clipboard.")
  }

  const saveEditedPost = () => {
    if (!selectedPost || !editedContent.trim() || editedContent.trim() === selectedPost.content.trim()) return
    const updated = { ...selectedPost, content: editedContent }
    setGeneratedPosts((prev) => { const next = prev.map((p) => p.id === updated.id ? updated : p); localStorage.setItem("get-generated-content", JSON.stringify(next)); return next })
    setSelectedPost(updated); toast.success("Saved as a new version")
  }

  // Replace a post after a conversational refinement (evidence gate re-run server-side).
  const applyRefinedPost = (updated: GeneratedPost) => {
    setGeneratedPosts((prev) => {
      const next = prev.map((p) => p.id === updated.id ? updated : p);
      localStorage.setItem("get-generated-content", JSON.stringify(next));
      return next
    })
    setSelectedPost(updated)
    setEditedContent(updated.content)
  }

  const exportPost = () => {
    if (!selectedPost) return
    const scenePlanText = selectedPost.scenePlan?.length
      ? `\n\nScene Plan:\n${selectedPost.scenePlan.map(s => `${s.start}-${s.end}s | Visual: ${s.visual} | VO: ${s.voiceover}${s.onScreenText ? ` | Caption: ${s.onScreenText}` : ""}`).join("\n")}`
      : ""
    const text = `${selectedPost.title || "Social Media Post"}\n\n${editedContent || selectedPost.content}\n\nHashtags: ${(selectedPost.hashtags || []).join(" #")}${scenePlanText}`
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `${selectedPost.platform}-content.txt`; link.click(); URL.revokeObjectURL(url)
  }

  const openSocialMedia = (platform: string, content: string, title: string) => {
    const urls = {
      tiktok: `https://www.tiktok.com/`,
      linkedin: "https://www.linkedin.com/sharing/share-offsite/",
      reddit: `https://www.reddit.com/submit?title=${title}&text=${content}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`,
    }

    window.open(urls[platform as keyof typeof urls], "_blank")
  }

  const closeDetailDialog = () => {
    stopSpeaking()
    setSelectedPost(null)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <HeaderArea
          theme={theme || "light"}
          setTheme={setTheme}
          apiKeysOpen={apiKeysOpen}
          setApiKeysOpen={setApiKeysOpen}
          apiKeys={apiKeys}
          setApiKeys={setApiKeys}
          setOpenAIBaseURL={setOpenAIBaseURL}
          openAIBaseURL={openAIBaseURL}
        />
      </div>

      {/* Scrollable Content Area */}
      <ContentArea
        generatedPosts={generatedPosts}
        setGeneratedPosts={setGeneratedPosts}
        setSelectedPost={(post) => { setSelectedPost(post); setEditedContent(post.content) }}
        copyToClipboard={copyToClipboard}
        setPrompt={setPrompt}
      />


      {/* Fixed Floating Input Area */}
      <div className="flex-shrink-0 fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 px-6 w-full max-w-3xl">
        <div className="relative">
          <FloatingInputArea
            textareaRef={textareaRef}
            prompt={prompt}
            setPrompt={setPrompt}
            generateContent={generateContent}
            selectedPlatforms={selectedPlatforms}
            togglePlatform={togglePlatform}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            isGenerating={isGenerating}
            userConfig={userConfig}
            setUserConfig={setUserConfig}
            apiKeys={apiKeys}
            openAIBaseURL={openAIBaseURL}
          />
        </div>
      </div>

      {/* Footer Area */}
      <FooterArea />

      {/* Post Detail Dialog with scene plan, voice preview and refine chat */}
      <PostDetailDialog
        selectedPost={selectedPost}
        onClose={closeDetailDialog}
        editedContent={editedContent}
        setEditedContent={setEditedContent}
        userConfig={userConfig}
        selectedModel={selectedModel}
        apiKeys={apiKeys}
        openAIBaseURL={openAIBaseURL}
        onRefined={applyRefinedPost}
        saveEditedPost={saveEditedPost}
        exportPost={exportPost}
        copyToClipboard={copyToClipboard}
        openSocialMedia={openSocialMedia}
      />
    </div>
  )
}
