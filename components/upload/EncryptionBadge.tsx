import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function EncryptionBadge() {
  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
      <Lock className="h-3.5 w-3.5" />
      Encrypted before upload
    </Badge>
  )
}
