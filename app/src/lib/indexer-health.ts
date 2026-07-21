/**
 * Indexer health store consumed through `useSyncExternalStore`.
 *
 * Failure moves the store to `down`; recovery passes through `degraded`
 * before returning to `healthy`.
 */

export type IndexerHealth = 'healthy' | 'degraded' | 'down'

export interface HealthSnapshot {
  health: IndexerHealth
  lastSuccessAt: number | null
  lastFailureAt: number | null
  failureCount: number
  consecutiveFailures: number
}

export const RECOVERY_WINDOW_MS = 60_000

class IndexerHealthTracker {
  private lastSuccessAt: number | null = null
  private lastFailureAt: number | null = null
  private failureCount = 0
  private consecutiveFailures = 0
  private lastEvent: 'success' | 'failure' | null = null
  private listeners = new Set<() => void>()
  private cachedSnapshot: HealthSnapshot | null = null
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null

  private computeHealth(): IndexerHealth {
    if (this.lastEvent === null) return 'healthy'
    if (this.lastEvent === 'failure') return 'down'
    // A recovered connection remains degraded until the recovery window closes.
    if (this.failureCount > 0) return 'degraded'
    return 'healthy'
  }

  private buildSnapshot(): HealthSnapshot {
    return {
      health: this.computeHealth(),
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      failureCount: this.failureCount,
      consecutiveFailures: this.consecutiveFailures,
    }
  }

  private rebuildAndNotify(): void {
    this.cachedSnapshot = this.buildSnapshot()
    for (const listener of this.listeners) {
      try { listener() } catch { /* must not crash */ }
    }
  }

  private clearRecoveryTimer(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer)
      this.recoveryTimer = null
    }
  }

  recordSuccess(): void {
    const wasDown = this.computeHealth() === 'down'
    this.lastSuccessAt = Date.now()
    this.consecutiveFailures = 0
    this.lastEvent = 'success'

    if (wasDown) {
      this.clearRecoveryTimer()
      // Schedule transition degraded → healthy after the recovery window.
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = null
        this.failureCount = 0
        this.rebuildAndNotify()
      }, RECOVERY_WINDOW_MS)
    } else if (this.failureCount > 0) {
      // Already recovering. Do not push the recovery deadline forward on
      // every successful query; busy pages would otherwise remain degraded
      // forever because each success reset the timer.
      if (!this.recoveryTimer) {
        this.recoveryTimer = setTimeout(() => {
          this.recoveryTimer = null
          this.failureCount = 0
          this.rebuildAndNotify()
        }, RECOVERY_WINDOW_MS)
      }
    } else {
      this.clearRecoveryTimer()
      this.failureCount = 0
    }

    this.rebuildAndNotify()
  }

  recordFailure(): void {
    this.lastFailureAt = Date.now()
    this.failureCount++
    this.consecutiveFailures++
    this.lastEvent = 'failure'

    this.clearRecoveryTimer()
    this.rebuildAndNotify()
  }

  reset(): void {
    this.clearRecoveryTimer()
    this.lastSuccessAt = null
    this.lastFailureAt = null
    this.failureCount = 0
    this.consecutiveFailures = 0
    this.lastEvent = null
    this.rebuildAndNotify()
  }

  snapshot(): HealthSnapshot {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = this.buildSnapshot()
    }
    return this.cachedSnapshot
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
}

export const indexerHealth = new IndexerHealthTracker()
