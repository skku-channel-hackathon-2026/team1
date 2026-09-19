// Small presentational primitives styled with the Airbnb-derived tokens in sameClass.css.
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'text'

export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  block = false,
  danger = false,
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  pill?: boolean
  block?: boolean
  danger?: boolean
  loading?: boolean
}) {
  const classes = ['sc-btn']
  if (variant !== 'primary') classes.push(`sc-btn--${variant}`)
  if (size === 'sm') classes.push('sc-btn--sm')
  if (pill) classes.push('sc-btn--pill')
  if (block) classes.push('sc-btn--block')
  if (danger) classes.push('sc-btn--danger')
  if (className) classes.push(className)
  return (
    <button
      type="button"
      className={classes.join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? '잠시만요…' : children}
    </button>
  )
}

export type BadgeTone =
  | 'default'
  | 'ink'
  | 'primary'
  | 'soft'
  | 'tint'
  | 'tone-free'
  | 'tone-building'
  | 'success'

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={`sc-badge${tone === 'default' ? '' : ` sc-badge--${tone}`}`}
    >
      {children}
    </span>
  )
}

export function Segmented<Value extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: Value
  options: { value: Value; label: string }[]
  onChange: (value: Value) => void
  label: string
}) {
  return (
    <div
      className="sc-seg"
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className="sc-seg__item"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="sc-switch"
      onClick={() => onChange(!checked)}
    />
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="sc-field">
      <span className="sc-label">{label}</span>
      {children}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`sc-input${props.className ? ` ${props.className}` : ''}`}
    />
  )
}
