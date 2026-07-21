import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, Info, X, ExternalLink, CheckCircle2, Loader2 } from 'lucide-react'
import { useToastStore, type Toast, type TxStep } from '@/hooks/useToast'
import { getTxUrl } from '@/lib/contracts'
import { useTranslations } from '@/lib/i18n'

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const iconColors = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#d4af37',
}

function StepIcon({ step }: { step: TxStep }) {
  if (step.status === 'active') {
    return (
      <motion.span
        className="flex-shrink-0"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      >
        <Loader2 className="w-3 h-3" style={{ color: iconColors.info }} />
      </motion.span>
    )
  }
  if (step.status === 'done') {
    return (
      <motion.span
        className="flex-shrink-0"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        <CheckCircle2 className="w-3 h-3 text-green-400" />
      </motion.span>
    )
  }
  if (step.status === 'error') {
    return <XCircle className="w-3 h-3 flex-shrink-0 text-red-400" />
  }
  // waiting
  return (
    <span className="w-3 h-3 flex-shrink-0 flex items-center justify-center">
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ink-4)', opacity: 0.45 }} />
    </span>
  )
}

function StepList({ steps }: { steps: TxStep[] }) {
  return (
    <ol className="mt-2 space-y-1.5">
      {steps.map((step, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-2"
        >
          <StepIcon step={step} />
          <span
            className="text-xs leading-none"
            style={{
              color: step.status === 'done' ? '#4ade80'
                   : step.status === 'active' ? 'var(--ink)'
                   : step.status === 'error' ? '#f87171'
                   : 'var(--ink-4)',
            }}
          >
            {step.label}
          </span>
        </motion.li>
      ))}
    </ol>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore()
  const { t } = useTranslations()
  const Icon = icons[toast.type]
  const isSuccessReceipt = toast.type === 'success' && !!toast.steps

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        boxShadow: isSuccessReceipt
          ? [
              '0 0 0px rgba(34,197,94,0)',
              '0 0 18px rgba(34,197,94,0.35)',
              '0 0 8px rgba(34,197,94,0.15)',
            ]
          : '0 4px 12px rgba(0,0,0,0.3)',
      }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{
        duration: 0.2,
        boxShadow: isSuccessReceipt
          ? { duration: 1.2, ease: 'easeInOut' }
          : undefined,
      }}
      className="flex items-start gap-3.5 px-4 py-3.5 rounded-md backdrop-blur-md w-full sm:w-[360px]"
      style={{
        background: `color-mix(in srgb, var(--bg-elev) 94%, ${iconColors[toast.type]} 6%)`,
        border: `1px solid color-mix(in srgb, ${iconColors[toast.type]} ${isSuccessReceipt ? '48%' : '30%'}, var(--line))`,
        boxShadow: '0 12px 36px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)',
      }}
    >
      <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${iconColors[toast.type]} 16%, transparent)` }}>
        <Icon className="w-4 h-4" style={{ color: iconColors[toast.type] }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-5" style={{ color: 'var(--ink)' }}>{toast.message}</p>
        {toast.txHash && (
          <a
            href={getTxUrl(toast.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
            style={{ color: iconColors[toast.type] }}
          >
            {t.common.viewOnExplorer} <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {toast.steps && <StepList steps={toast.steps} />}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 p-1 rounded transition-colors hover:opacity-70"
      >
        <X className="w-4 h-4" style={{ color: 'var(--ink-4)' }} />
      </button>
    </motion.div>
  )
}

export function ToastContainer() {
  const { toasts } = useToastStore()

  // Announce every transaction confirmation and error to screen readers.
  // aria-atomic="false" so only the changed node is read (not the whole list).
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Notifications"
      className="fixed bottom-20 right-3 left-3 sm:right-5 sm:left-auto z-50 flex flex-col gap-3 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
