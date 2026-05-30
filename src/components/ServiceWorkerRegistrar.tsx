'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    // Ghi nhớ trước khi register: đã có controller chưa (= không phải lần cài đầu tiên)
    const hadController = !!navigator.serviceWorker.controller
    let refreshing = false

    navigator.serviceWorker.register('/sw.js').catch(() => {})

    // Khi SW mới take control → reload để lấy code mới
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return   // bỏ qua lần cài đầu tiên
      refreshing = true
      window.location.reload()
    })

    // Nhận tín hiệu SW_UPDATED từ service worker (backup channel)
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'SW_UPDATED' && !refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  }, []);

  return null;
}
