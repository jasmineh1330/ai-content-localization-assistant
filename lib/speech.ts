// Zero-key voiceover preview via the browser's Web Speech API.
// Lets operators hear the generated script read out loud without any TTS cost.

let currentRate = 1

export function setSpeechRate(rate: number) {
  currentRate = rate
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
}

export function speak(text: string, lang = "en-US", onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.()
    return false
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = currentRate
  const voices = window.speechSynthesis.getVoices()
  const voice = voices.find(v => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
  if (voice) utterance.voice = voice
  if (onEnd) {
    utterance.onend = () => onEnd()
    utterance.onerror = () => onEnd()
  }
  window.speechSynthesis.speak(utterance)
  return true
}

export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window
}
