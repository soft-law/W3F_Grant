import { Component, type ReactNode } from 'react'
import { translations } from '@/lib/i18n/translations'
import { useI18nStore } from '@/lib/i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
  }

  render() {
    if (this.state.hasError) {
      const lang = useI18nStore.getState().language
      const t = translations[lang].errorBoundary
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold">{t.title}</h2>
            <p className="text-sm text-gray-400">
              {this.state.error?.message || t.defaultMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-lg bg-amber-500 text-black font-medium hover:bg-amber-400 transition-colors"
            >
              {t.reload}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
