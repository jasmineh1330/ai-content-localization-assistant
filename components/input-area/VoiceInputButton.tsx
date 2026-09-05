"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "../ui/button"
import { toast } from "sonner"
import { Mic, MicOff } from "lucide-react"

// Voice dictation via the browser's Web Speech API — a zero-key multimodal
// input path so operators can speak their brief instead of typing it.

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

interface VoiceInputButtonProps {
  prompt: string
  setPrompt: (value: string) => void
  disabled?: boolean
}

export function VoiceInputButton({ prompt, setPrompt, disabled }: VoiceInputButtonProps) {
  const [listening, setListening] = useState(false)
  const [lang, setLang] = useState<"zh-CN" | "en-US">("zh-CN")
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const getRecognition = (): SpeechRecognitionLike | null => {
    if (typeof window === "undefined") return null
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    return Ctor ? new Ctor() : null
  }

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = getRecognition()
    if (!recognition) {
      toast.error("当前浏览器不支持语音输入，请使用 Chrome 或 Edge。")
      return
    }

    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      let transcript = ""
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      if (transcript.trim()) {
        setPrompt(prompt ? `${prompt} ${transcript.trim()}` : transcript.trim())
        toast.success("语音已转为文字。")
      }
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        toast.error("麦克风权限被拒绝，请在浏览器设置中允许。")
      } else if (event.error !== "aborted") {
        toast.error("语音识别失败，请重试。")
      }
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  return (
    <div className="flex items-center">
      <Button
        variant={listening ? "default" : "ghost"}
        size="sm"
        className={`h-8 px-2 ${listening ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
        onClick={toggleListening}
        disabled={disabled}
        title={listening ? "停止录音" : "语音输入需求"}
      >
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>
      {listening && (
        <button
          className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          onClick={() => setLang(lang === "zh-CN" ? "en-US" : "zh-CN")}
          title="切换识别语言"
        >
          {lang === "zh-CN" ? "中文" : "EN"}
        </button>
      )}
    </div>
  )
}
