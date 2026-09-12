'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

type CopyButtonProps = {
  value: string
  label?: string
  className?: string
}

export function CopyButton({ value, label = 'Copy', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return undefined
    }

    const timeout = window.setTimeout(() => {
      setCopied(false)
    }, 2_000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [copied])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void handleCopy().catch(() => undefined)
      }}
      className={className}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}
