import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'
export type TxStepStatus = 'waiting' | 'active' | 'done' | 'error'

export interface TxStep {
  label: string
  status: TxStepStatus
}

export interface Toast {
  id: string
  type: ToastType
  message: string
  txHash?: string
  steps?: TxStep[]
  persist?: boolean
}

interface ToastStore {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, txHash?: string) => string
  addProgressToast: (message: string, steps: TxStep[]) => string
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void
  removeToast: (id: string) => void
}

let nextId = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message, txHash) => {
    const id = String(++nextId)
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, txHash }],
    }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 5000)
    return id
  },
  addProgressToast: (message, steps) => {
    const id = String(++nextId)
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'info', message, steps, persist: true }],
    }))
    return id
  },
  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => t.id === id ? { ...t, ...updates } : t),
    }))
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

// Convenience functions
export function toast(message: string, txHash?: string) {
  useToastStore.getState().addToast('info', message, txHash)
}

export function toastSuccess(message: string, txHash?: string) {
  useToastStore.getState().addToast('success', message, txHash)
}

export function toastError(message: string) {
  useToastStore.getState().addToast('error', message)
}
