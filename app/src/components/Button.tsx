import { type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const getStyles = () => {
    switch (variant) {
      case 'primary':
        // Primary styling, including theme-specific shadows, lives in CSS.
        return undefined
      case 'secondary':
        return {
          backgroundColor: 'var(--bg-elev)',
          color: 'var(--ink)',
          border: '1px solid var(--line)',
        }
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--gold-text)',
          border: '1px solid var(--gold)',
        }
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--ink-2)',
          border: 'none',
        }
    }
  }

  return (
    <motion.button
      className={`
        inline-flex items-center justify-center gap-2 font-medium
        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${variant === 'primary' ? 'btn-primary' : 'rounded-sm'} ${sizeClasses[size]} ${className}
      `}
      style={getStyles()}
      // No inline hover box-shadow: it would override the theme shadow
      // (.btn-primary's hard offset in light / ring glow in dark).
      whileHover={!disabled ? { scale: 1.02 } : undefined}
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      disabled={disabled || isLoading}
      // Keep the loading state available to assistive technology.
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </motion.button>
  )
}
