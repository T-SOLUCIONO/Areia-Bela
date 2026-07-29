'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import { Label } from '@areia-bela/ui/label'
import { landing } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | null
  onChange: (url: string | null) => void
  /** `square` for portraits and avatars, `wide` for cards and banners. */
  shape?: 'square' | 'wide'
}

/** Upload-and-preview for a single image field. Shares the gallery's storage. */
export function ImageField({ label, value, onChange, shape = 'wide' }: Props) {
  const t = useAdminCopy()
  const input = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const upload = async (file: File) => {
    setIsUploading(true)
    try {
      onChange(await landing.uploadImage(file))
      toast.success(t.content.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.content.saveFailed)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'relative shrink-0 overflow-hidden rounded-lg border bg-muted',
            shape === 'square' ? 'h-20 w-20' : 'h-20 w-32',
          )}
        >
          {value ? (
            <Image src={value} alt="" fill sizes="128px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImagePlus className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => input.current?.click()}
          >
            {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {value ? t.content.imageReplace : t.content.imageAdd}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => onChange(null)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              {t.content.imageRemove}
            </Button>
          )}
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
