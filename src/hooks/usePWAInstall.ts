"use client"
import { useEffect, useState } from "react"

export type Platform = "android-chrome" | "ios-safari" | "ios-other" | "desktop" | "unknown"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unknown"
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua) && !/Chrome/.test(ua)
  const isChrome = /Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua)

  if (isIOS && isSafari) return "ios-safari"
  if (isIOS) return "ios-other"
  if (isAndroid && isChrome) return "android-chrome"
  return "desktop"
}

function checkInstalled(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true ||
    localStorage.getItem("pwa_installed") === "true"
  )
}

export function usePWAInstall() {
  const [platform,      setPlatform]      = useState<Platform>("unknown")
  const [showModal,     setShowModal]     = useState(false)   // full modal
  const [showReminder,  setShowReminder]  = useState(false)   // nhắc nhẹ lần 2+
  const [installed,     setInstalled]     = useState(false)
  const [deferredPrompt,setDeferredPrompt]= useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (checkInstalled()) { setInstalled(true); return }

    const p = detectPlatform()
    setPlatform(p)

    // Đếm lượt visit
    const visits = parseInt(localStorage.getItem("pwa_visits") ?? "0") + 1
    localStorage.setItem("pwa_visits", String(visits))

    const dismissed = localStorage.getItem("pwa_dismissed") === "true"

    // Android / Desktop — bắt native prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (visits === 1 || !dismissed) setShowModal(true)
      else if (visits >= 2) setShowReminder(true)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)

    // iOS Safari — không có beforeinstallprompt, hiện hướng dẫn thủ công
    if (p === "ios-safari" || p === "ios-other") {
      if (!dismissed) setShowModal(true)
      else if (visits >= 2) setShowReminder(true)
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Gọi khi user bấm "Cài đặt" (Android/Desktop)
  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        localStorage.setItem("pwa_installed", "true")
        setInstalled(true)
      }
    }
    setShowModal(false)
    setShowReminder(false)
    localStorage.setItem("pwa_dismissed", "true")
  }

  // Gọi khi iOS user bấm "Đã cài xong"
  const confirmInstalled = () => {
    localStorage.setItem("pwa_installed", "true")
    localStorage.setItem("pwa_dismissed", "true")
    setInstalled(true)
    setShowModal(false)
    setShowReminder(false)
  }

  const dismiss = () => {
    localStorage.setItem("pwa_dismissed", "true")
    setShowModal(false)
    setShowReminder(false)
  }

  return { platform, showModal, showReminder, installed, install, confirmInstalled, dismiss }
}
