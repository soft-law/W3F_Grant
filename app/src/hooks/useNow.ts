import { useSyncExternalStore } from 'react'

const TICK_MS = 1_000

let currentNow = Date.now()
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function emitTick() {
  currentNow = Date.now()
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    emitTick()
    timer = setInterval(emitTick, TICK_MS)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot(): number {
  return currentNow
}

/** Shared external clock for expiry and countdown UI. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
