'use client'

import { useState } from 'react'
import { Languages, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@areia-bela/ui/tooltip'
import { ApiError } from '@/lib/api-client'
import { landing } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { useTranslationAvailable } from '@/components/admin/content/translation-provider'

interface Props {
  label: string
  valueEs: string
  valueEn: string
  onChange: (patch: { es?: string; en?: string }) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  id?: string
}

/**
 * One label, both languages side by side, with a button that asks the API for
 * the missing side.
 *
 * The translation lands in the input as a draft the host still has to save.
 * That is the whole point: CLAUDE.md forbids inventing copy, and a machine
 * translation nobody read before it reached guests is exactly that. Here a
 * person always sees it first.
 */
export function BilingualField({
  label,
  valueEs,
  valueEn,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  id,
}: Props) {
  const t = useAdminCopy()
  const canTranslate = useTranslationAvailable()
  const [pending, setPending] = useState<'es' | 'en' | null>(null)

  const translateInto = async (target: 'es' | 'en') => {
    const source = target === 'es' ? 'en' : 'es'
    const text = (target === 'es' ? valueEn : valueEs).trim()
    if (!text) {
      toast.error(t.content.translateNoSource)
      return
    }

    setPending(target)
    try {
      const translated = await landing.translate(text, source, target)
      onChange({ [target]: translated })
      toast.success(t.content.translateDone)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.translateFailed)
    } finally {
      setPending(null)
    }
  }

  const Control = multiline ? Textarea : Input

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['es', t.content.spanish, valueEs],
            ['en', t.content.english, valueEn],
          ] as const
        ).map(([code, languageLabel, value]) => (
          <div key={code} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {languageLabel}
              </span>
              {canTranslate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-primary"
                      disabled={pending !== null}
                      onClick={() => void translateInto(code)}
                    >
                      {pending === code ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      ) : (
                        <Languages className="h-3 w-3" aria-hidden />
                      )}
                      {t.content.translate}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t.content.translateHint}</TooltipContent>
                </Tooltip>
              )}
            </div>
            <Control
              id={id ? `${id}-${code}` : undefined}
              value={value}
              rows={multiline ? rows : undefined}
              placeholder={placeholder}
              onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                onChange({ [code]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
    </div>
  )
}
