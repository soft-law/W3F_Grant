import { Loader2 } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'

export function Loader({ colors }: { colors: ThemeColors }) {
  return <div className="flex justify-center py-8"><Loader2 className="w-9 h-9 animate-spin" style={{ color: colors.accent.goldText }} /></div>
}
