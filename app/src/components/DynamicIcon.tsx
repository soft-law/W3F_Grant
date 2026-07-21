import { createElement, type ComponentProps } from 'react'
import type { LucideIcon } from 'lucide-react'

interface DynamicIconProps extends Omit<ComponentProps<LucideIcon>, 'ref'> {
  icon: LucideIcon
}

/** Render a selected Lucide icon without constructing a component in render. */
export function DynamicIcon({ icon, ...props }: DynamicIconProps) {
  return createElement(icon, props)
}
