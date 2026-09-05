"use client"

import { useState } from "react"
import { Badge } from "../ui/badge"
import { Volume2 } from "lucide-react"
import type { SceneShot } from "@/lib/types"
import { speak, stopSpeaking } from "@/lib/speech"

// Shot-by-shot storyboard view (the scene_plan stage, borrowed from
// OpenMontage's pipeline: script -> shots -> voiceover -> caption).
export function ScenePlanView({ shots }: { shots: SceneShot[] }) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  const playShot = (shot: SceneShot, index: number) => {
    if (playingIndex === index) {
      stopSpeaking()
      setPlayingIndex(null)
      return
    }
    setPlayingIndex(index)
    speak(shot.voiceover, "en-US", () => setPlayingIndex(current => (current === index ? null : current)))
  }

  const totalSeconds = Math.max(...shots.map(s => s.end), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{shots.length} 个镜头</Badge>
        <span className="text-xs text-gray-500 dark:text-gray-400">约 {totalSeconds}s · 点击每条口播可单独试听</span>
      </div>
      <div className="space-y-2">
        {shots.map((shot, index) => (
          <div
            key={index}
            className={`rounded-lg border p-3 transition ${playingIndex === index
              ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40"
              : "border-gray-200 dark:border-gray-700"}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <Badge variant="secondary" className="text-xs">
                镜头 {index + 1} · {shot.start}s–{shot.end}s
              </Badge>
              <button
                onClick={() => playShot(shot, index)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition ${playingIndex === index
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
                title="试听该镜头口播"
              >
                <Volume2 className="w-3 h-3" />
                {playingIndex === index ? "停止" : "试听"}
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-200">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mr-1">画面</span>{shot.visual}
            </p>
            <p className="text-sm text-gray-800 dark:text-gray-100 mt-1 italic">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500 mr-1 not-italic">口播</span>“{shot.voiceover}”
            </p>
            {shot.onScreenText && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium mr-1">字幕</span>{shot.onScreenText}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
