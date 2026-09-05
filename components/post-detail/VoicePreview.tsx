"use client"

import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Pause, Play } from "lucide-react"
import { isSpeechSynthesisSupported, setSpeechRate, speak, stopSpeaking } from "@/lib/speech"

// Zero-key voiceover preview: reads the script aloud with the browser TTS so
// operators can judge pacing before recording.
export function VoicePreview({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    setSupported(isSpeechSynthesisSupported())
    return () => stopSpeaking()
  }, [])

  if (!supported) return null

  const togglePlay = () => {
    if (playing) {
      stopSpeaking()
      setPlaying(false)
      return
    }
    setSpeechRate(rate)
    const ok = speak(text, "en-US", () => setPlaying(false))
    setPlaying(ok)
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant={playing ? "default" : "outline"} onClick={togglePlay} className="h-8">
        {playing ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
        {playing ? "停止" : "整段试听"}
      </Button>
      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        语速
        <input
          type="range"
          min={0.6}
          max={1.4}
          step={0.1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="w-20 accent-blue-600"
        />
        {rate.toFixed(1)}x
      </label>
    </div>
  )
}
