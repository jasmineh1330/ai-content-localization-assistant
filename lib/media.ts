// Client-side media helpers for the multimodal reference studio.
// Images are downscaled and video files are sampled into frames in the
// browser, so only small JPEG payloads reach the vision API.

export async function fileToDownscaledDataUrl(file: File, maxSide = 768, quality = 0.75): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not supported in this browser")
    ctx.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL("image/jpeg", quality)
  } finally {
    bitmap.close()
  }
}

// Sample evenly spaced frames from a local video file for reference analysis
// without uploading the whole clip.
export async function extractVideoFrames(file: File, count = 4, width = 640, quality = 0.7): Promise<string[]> {
  const url = URL.createObjectURL(file)
  const video = document.createElement("video")
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = "auto"

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("视频读取超时")), 15000)
      video.onloadedmetadata = () => { clearTimeout(timeout); resolve() }
      video.onerror = () => { clearTimeout(timeout); reject(new Error("无法读取该视频文件")) }
    })

    const duration = video.duration
    if (!duration || !isFinite(duration)) throw new Error("无法读取视频时长")

    const scale = Math.min(1, width / (video.videoWidth || width))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round((video.videoWidth || 640) * scale))
    canvas.height = Math.max(1, Math.round((video.videoHeight || 360) * scale))
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not supported in this browser")

    const ratios = [0.08, 0.3, 0.55, 0.8].slice(0, count)
    const frames: string[] = []
    for (const ratio of ratios) {
      await new Promise<void>((resolve) => {
        let settled = false
        const done = () => { if (!settled) { settled = true; video.removeEventListener("seeked", onSeeked); resolve() } }
        const onSeeked = () => done()
        video.addEventListener("seeked", onSeeked)
        video.currentTime = Math.max(0, Math.min(duration - 0.05, duration * ratio))
        setTimeout(done, 3000)
      })
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      frames.push(canvas.toDataURL("image/jpeg", quality))
    }
    return frames
  } finally {
    URL.revokeObjectURL(url)
  }
}
