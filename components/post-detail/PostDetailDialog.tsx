"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Label } from "../ui/label"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { ScrollArea } from "../ui/scroll-area"
import { Copy, ExternalLink, Film, Linkedin, MessageCircle } from "lucide-react"
import type { LLMModel } from "@/lib/models"
import type { ApiKeys, GeneratedPost, UserConfig } from "@/lib/types"
import { TikTokIcon } from "../icons/TikTokIcon"
import { ScenePlanView } from "./ScenePlanView"
import { VoicePreview } from "./VoicePreview"
import { RefineChat } from "./RefineChat"
import { stopSpeaking } from "@/lib/speech"

const platformIcons = {
  tiktok: TikTokIcon,
  linkedin: Linkedin,
  reddit: MessageCircle,
  twitter: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
}

const platformNames = {
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  twitter: "X",
}

interface PostDetailDialogProps {
  selectedPost: GeneratedPost | null
  onClose: () => void
  editedContent: string
  setEditedContent: (content: string) => void
  userConfig: UserConfig
  selectedModel: LLMModel
  apiKeys: ApiKeys
  openAIBaseURL: string
  onRefined: (post: GeneratedPost) => void
  saveEditedPost: () => void
  exportPost: () => void
  copyToClipboard: (content: string) => void
  openSocialMedia: (platform: string, content: string, title: string) => void
}

export function PostDetailDialog({
  selectedPost,
  onClose,
  editedContent,
  setEditedContent,
  userConfig,
  selectedModel,
  apiKeys,
  openAIBaseURL,
  onRefined,
  saveEditedPost,
  exportPost,
  copyToClipboard,
  openSocialMedia,
}: PostDetailDialogProps) {
  return (
    <Dialog
      open={!!selectedPost}
      onOpenChange={(open) => { if (!open) { stopSpeaking(); onClose() } }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-hidden dark:bg-gray-800">
        {selectedPost && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 dark:text-white">
                {(() => {
                  const IconComponent = platformIcons[selectedPost.platform]
                  return <IconComponent className="w-5 h-5" />
                })()}
                {platformNames[selectedPost.platform]} Post
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[62vh]">
              <div className="space-y-4 pr-4">
                {selectedPost.title && (
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">Title</Label>
                    <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-md dark:text-white">
                      {selectedPost.title}
                    </p>
                  </div>
                )}

                {/* Voiceover preview + script */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium dark:text-gray-200">Content</Label>
                    <VoicePreview text={editedContent || selectedPost.content} />
                  </div>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap dark:text-white">
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="mt-1 w-full min-h-40 p-3 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap dark:text-white"
                    />
                  </div>
                </div>

                {/* Shot-by-shot storyboard (TikTok) */}
                {selectedPost.scenePlan && selectedPost.scenePlan.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200 flex items-center gap-1.5">
                      <Film className="w-4 h-4" /> 分镜卡 · Scene Plan
                    </Label>
                    <div className="mt-2">
                      <ScenePlanView shots={selectedPost.scenePlan} />
                    </div>
                  </div>
                )}

                {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">Hashtags</Label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedPost.hashtags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="dark:bg-gray-600 dark:text-gray-200">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPost.productFacts && selectedPost.productFacts.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-green-700 dark:text-green-300">Verified Product Facts</Label>
                    <ul className="mt-1 list-disc pl-5 p-3 bg-green-50 dark:bg-green-950 rounded-md text-sm dark:text-green-100">
                      {selectedPost.productFacts.map((fact, index) => {
                        const item = typeof fact === "string" ? { fact, source: "Legacy result; regenerate to add a source" } : fact
                        return <li key={index}><span className="font-medium">{item.fact}</span><span className="block text-xs opacity-80">Source: {item.source}</span></li>
                      })}
                    </ul>
                  </div>
                )}

                {selectedPost.reviewRequired && selectedPost.reviewRequired.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-amber-700 dark:text-amber-300">Human Review Required</Label>
                    <ul className="mt-1 list-disc pl-5 p-3 bg-amber-50 dark:bg-amber-950 rounded-md text-sm dark:text-amber-100">
                      {selectedPost.reviewRequired.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                  </div>
                )}

                {/* Conversational refinement with the evidence gate re-run */}
                <div>
                  <Label className="text-sm font-medium dark:text-gray-200">AI 对话精修</Label>
                  <div className="mt-2">
                    <RefineChat
                      post={selectedPost}
                      userConfig={userConfig}
                      selectedModel={selectedModel}
                      apiKeys={apiKeys}
                      openAIBaseURL={openAIBaseURL}
                      onRefined={onRefined}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="flex flex-wrap gap-2 pt-4">
              <Button variant="outline" onClick={saveEditedPost} className="flex-1 min-w-[120px]">Save Version</Button>
              <Button variant="outline" onClick={exportPost} className="flex-1 min-w-[110px]">Export TXT</Button>
              <Button variant="outline" onClick={() => copyToClipboard(editedContent || selectedPost.content)} className="flex-1 min-w-[130px]">
                <Copy className="w-4 h-4 mr-2" />
                Copy Content
              </Button>
              <Button
                onClick={() => openSocialMedia(selectedPost.platform, editedContent || selectedPost.content, selectedPost.title ?? "")}
                className="flex-1 min-w-[150px]"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Post to {platformNames[selectedPost.platform]}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
