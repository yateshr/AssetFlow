import { useEffect, useRef, useState } from "react"

/** Animates a number from 0 to `value` with an ease-out curve. Respects reduced-motion. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const frame = useRef<number>(0)
  const from = useRef(0)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const startVal = from.current
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 4)
      const current = Math.round(startVal + (value - startVal) * eased)
      setDisplay(current)
      from.current = current
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, duration])

  return <span className="tabular-nums">{display}</span>
}
