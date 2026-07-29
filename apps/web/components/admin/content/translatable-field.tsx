'use client'

import { Languages } from 'lucide-react'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@areia-bela/ui/tooltip'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  id?: string
}

/**
 * A field the guest site translates on its own.
 *
 * This used to be two inputs side by side, Spanish and English, with a button
 * to fill one from the other. That does not survive five languages: the host
 * would write every sentence five times. Now they write it once and the API
 * translates it into the rest when they save.
 *
 * The globe is the only affordance — a quiet mark that says "this text will
 * appear in other languages", so nobody wonders where the second box went.
 */
export function TranslatableField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  id,
}: Props) {
  const t = useAdminCopy()
  const Control = multiline ? Textarea : Input

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help text-muted-foreground">
              <Languages className="h-3.5 w-3.5" aria-label={t.content.autoTranslated} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t.content.autoTranslatedHint}</TooltipContent>
        </Tooltip>
      </div>
      <Control
        id={id}
        value={value}
        rows={multiline ? rows : undefined}
        placeholder={placeholder}
        onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
      />
    </div>
  )
}
