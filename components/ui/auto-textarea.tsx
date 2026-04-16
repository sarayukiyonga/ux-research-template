'use client'

import {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  type TextareaHTMLAttributes,
} from 'react'

/**
 * Textarea cuya altura sigue al contenido (sin scroll interno).
 * Útil para textos largos controlados o borradores locales.
 */
export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AutoTextarea(
    { className, style, onChange, rows = 1, value, defaultValue, ...rest },
    forwardedRef
  ) {
    const innerRef = useRef<HTMLTextAreaElement>(null)

    const resize = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [])

    useLayoutEffect(() => {
      resize()
    }, [value, defaultValue, resize])

    const setRefs = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
      } else if (forwardedRef) {
        forwardedRef.current = node
      }
    }

    return (
      <textarea
        ref={setRefs}
        {...rest}
        rows={rows}
        className={className}
        style={{
          ...style,
          overflow: 'hidden',
          resize: 'none',
        }}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => {
          onChange?.(e)
          requestAnimationFrame(resize)
        }}
      />
    )
  }
)

AutoTextarea.displayName = 'AutoTextarea'
