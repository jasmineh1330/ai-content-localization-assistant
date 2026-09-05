"use client"

import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Badge } from "../ui/badge"
import { ScrollArea } from "../ui/scroll-area"
import { Separator } from "../ui/separator"
import { toast } from "sonner"
import { Film, Image as ImageIcon, ScanSearch, Trash2, Upload, X } from "lucide-react"
import type { LLMModel } from "@/lib/models"
import type { ApiKeys, UserConfig, VisualEvidence } from "@/lib/types"
import { fileToDownscaledDataUrl, extractVideoFrames } from "@/lib/media"

interface ReferenceStudioProps {
  userConfig: UserConfig
  setUserConfig: (config: UserConfig | ((prev: UserConfig) => UserConfig)) => void
  selectedModel: LLMModel
  apiKeys: ApiKeys
  openAIBaseURL: string
}

interface StagedAsset {
  name: string
  dataUrl: string
}

export function ReferenceStudio({ userConfig, setUserConfig, selectedModel, apiKeys, openAIBaseURL }: ReferenceStudioProps) {
  const [open, setOpen] = useState(false)
  const [staged, setStaged] = useState<StagedAsset[]>([])
  const [kind, setKind] = useState<"image" | "video">("image")
  const [hint, setHint] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<Omit<VisualEvidence, "id" | "createdAt"> | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const currentKey = selectedModel.provider === "OpenAI" ? apiKeys.openai : apiKeys.gemini

  const resetStaging = () => {
    setStaged([])
    setResult(null)
    setHint("")
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setKind("image")
    setResult(null)
    const images = Array.from(files).slice(0, 4)
    try {
      const assets: StagedAsset[] = []
      for (const file of images) {
        assets.push({ name: file.name, dataUrl: await fileToDownscaledDataUrl(file) })
      }
      setStaged(prev => [...prev, ...assets].slice(0, 4))
    } catch (error) {
      toast.error(`图片处理失败：${error instanceof Error ? error.message : error}`)
    }
  }

  const handleVideoUpload = async (file: File | null) => {
    if (!file) return
    setKind("video")
    setResult(null)
    setAnalyzing(true)
    setStaged([{ name: file.name, dataUrl: "" }])
    try {
      const frames = await extractVideoFrames(file, 4)
      setStaged(frames.map((dataUrl, index) => ({ name: `${file.name} · 帧${index + 1}`, dataUrl })))
      toast.success("已抽取 4 个关键帧，可直接分析参考风格。")
    } catch (error) {
      setStaged([])
      toast.error(`视频抽帧失败：${error instanceof Error ? error.message : error}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const analyze = async () => {
    if (staged.length === 0) {
      toast.warning("请先上传图片或视频。")
      return
    }
    if (!currentKey) {
      toast.error(`请先在设置中添加 ${selectedModel.provider === "OpenAI" ? "OpenAI" : "Google"} API key。`)
      return
    }

    setAnalyzing(true)
    try {
      const response = await fetch("/api/analyze-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          assets: staged,
          hint,
          model: selectedModel.id,
          provider: selectedModel.provider,
          apiKey: currentKey,
          openAIBaseURL,
        }),
      })
      if (!response.ok) throw new Error("分析失败")
      const data = await response.json()
      setResult(data.evidence)
      toast.success("分析完成，请核对后再并入事实库。")
    } catch (error) {
      toast.error(`参考素材分析失败：${error instanceof Error ? error.message : error}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const saveEvidence = () => {
    if (!result) return
    const entry: VisualEvidence = {
      ...result,
      id: `ve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    }
    setUserConfig(prev => ({ ...prev, visualEvidence: [...(prev.visualEvidence || []), entry] }))
    localStorage.setItem("post-config", JSON.stringify({
      ...userConfig, visualEvidence: [...(userConfig.visualEvidence || []), entry],
    }))
    toast.success("已并入事实库，生成文案时会作为证据来源参与校验。")
    resetStaging()
  }

  const removeEvidence = (id: string) => {
    setUserConfig(prev => {
      const next = { ...prev, visualEvidence: (prev.visualEvidence || []).filter(e => e.id !== id) }
      localStorage.setItem("post-config", JSON.stringify(next))
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetStaging() }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 px-2" title="上传参考图片 / 参考视频">
          <Film className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="dark:text-white">多模态互动</DialogTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            上传产品图或参考短视频，AI 提取可核验的产品事实与创作风格；只有能对应到素材原文的事实才会进入证据链。
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[62vh]">
          <div className="space-y-4 px-1">
            {/* Upload controls */}
            <div className="flex flex-wrap gap-2">
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { handleImageUpload(e.target.files); e.target.value = "" }} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
                onChange={(e) => { handleVideoUpload(e.target.files?.[0] || null); e.target.value = "" }} />
              <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={analyzing}>
                <ImageIcon className="w-4 h-4 mr-1" /> 上传产品图（最多 4 张）
              </Button>
              <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} disabled={analyzing}>
                <Upload className="w-4 h-4 mr-1" /> 上传参考视频（自动抽帧）
              </Button>
            </div>

            {/* Staged previews */}
            {staged.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {staged.map((asset, index) => (
                  <div key={index} className="relative group rounded-md overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                    {asset.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.dataUrl} alt={asset.name} className="w-full h-20 object-cover" />
                    ) : (
                      <div className="h-20 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">{asset.name}</div>
                    )}
                    <button
                      className="absolute top-1 right-1 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition"
                      onClick={() => setStaged(prev => prev.filter((_, i) => i !== index))}
                      title="移除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="reference-hint" className="dark:text-gray-200">分析重点（可选）</Label>
              <Input
                id="reference-hint"
                placeholder="例如：重点提取相机规格；或：分析这个竞品视频的 hook 和节奏"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={analyze} disabled={analyzing || staged.length === 0} size="sm">
                {analyzing ? (
                  <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />分析中…</>
                ) : (
                  <><ScanSearch className="w-4 h-4 mr-1" />开始分析</>
                )}
              </Button>
              {staged.length > 0 && !analyzing && (
                <Button variant="ghost" size="sm" onClick={resetStaging}>清空</Button>
              )}
            </div>

            {/* Analysis result */}
            {result && (
              <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{result.kind === "video" ? "参考视频" : "产品图"} · {result.name}</Badge>
                  <Button size="sm" onClick={saveEvidence}>并入事实库</Button>
                </div>

                {result.facts?.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-green-700 dark:text-green-300">可核验的产品事实</Label>
                    <ul className="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200 space-y-0.5">
                      {result.facts.map((fact, index) => (
                        <li key={index}>
                          <span className="font-medium">{fact.fact}</span>
                          <span className="block text-xs opacity-70">来源原文："{fact.source}"</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.styleNotes && (
                  <div>
                    <Label className="text-sm font-medium dark:text-gray-200">创作风格笔记</Label>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{result.styleNotes}</p>
                  </div>
                )}

                {result.risks?.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-amber-700 dark:text-amber-300">需人工确认（不会作为事实进入文案）</Label>
                    <ul className="mt-1 list-disc pl-5 text-sm text-amber-700 dark:text-amber-200">
                      {result.risks.map((risk, index) => <li key={index}>{risk}</li>)}
                    </ul>
                  </div>
                )}

                {result.textFromImage && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-500 dark:text-gray-400">查看素材原文（用于证据比对）</summary>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded">{result.textFromImage}</p>
                  </details>
                )}
              </div>
            )}

            {userConfig.visualEvidence && userConfig.visualEvidence.length > 0 && (
              <>
                <Separator className="dark:bg-gray-600" />
                <div>
                  <Label className="text-sm font-medium dark:text-gray-200">已并入的视觉证据（参与事实校验）</Label>
                  <div className="mt-2 space-y-2">
                    {userConfig.visualEvidence.map(evidence => (
                      <div key={evidence.id} className="flex items-start justify-between gap-2 rounded-md bg-gray-50 dark:bg-gray-900 p-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {evidence.kind === "video" ? "🎬" : "🖼️"} {evidence.name}
                            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{evidence.facts.length} 条事实</span>
                          </p>
                          {evidence.styleNotes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{evidence.styleNotes}</p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => removeEvidence(evidence.id)} title="移除">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
