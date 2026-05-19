// src/lib/particle.ts — spawnParticles() (CLAUDE.md Section 2.5.A)

export function spawnParticles(
  src: HTMLElement,
  tgt: HTMLElement,
  container: HTMLElement,
) {
  const sR = src.getBoundingClientRect()
  const tR = tgt.getBoundingClientRect()
  const cR = container.getBoundingClientRect()
  const sx = sR.left - cR.left + sR.width  / 2
  const sy = sR.top  - cR.top  + sR.height / 2
  const tx = tR.left - cR.left + tR.width  / 2
  const ty = tR.top  - cR.top  + tR.height / 2

  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const p = document.createElement("div")
      const ox = (Math.random() - 0.5) * 16
      const oy = (Math.random() - 0.5) * 16
      p.style.cssText = `
        position:absolute;pointer-events:none;z-index:9999;
        width:7px;height:7px;border-radius:50%;
        background:#FF8C00;box-shadow:0 0 6px #FF6B00;
        left:${sx + ox}px;top:${sy + oy}px;
      `
      container.appendChild(p)
      let t = 0
      const dx = tx - (sx + ox)
      const dy = ty - (sy + oy)
      const iv = setInterval(() => {
        t += 0.055
        if (t >= 1) { clearInterval(iv); p.remove(); return }
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        p.style.left      = `${sx + ox + dx * e}px`
        p.style.top       = `${sy + oy + dy * e - Math.sin(t * Math.PI) * 50}px`
        p.style.opacity   = `${1 - t * 0.8}`
        p.style.transform = `scale(${1 - t * 0.4})`
      }, 16)
    }, i * 45)
  }
}
