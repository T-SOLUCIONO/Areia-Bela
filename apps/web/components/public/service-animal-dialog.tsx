'use client'

import Image from 'next/image'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@areia-bela/ui/dialog'
import { translations, type Language } from '@/lib/i18n'

/**
 * Says plainly that a service animal is not a pet and carries no fee — the
 * question a guest would otherwise have to email to ask.
 *
 * Shared by the quoter and the checkout's guest dialog, because both offer the
 * pet counter and both therefore raise the same question.
 */
export function ServiceAnimalDialog({
  open,
  onOpenChange,
  language,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  language: Language
}) {
  const copy = translations[language].availability

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-[22px] p-0">
        <div className="relative aspect-[7/6] w-full bg-slate-100">
          <Image
            src="/images/service-animal.webp"
            alt={copy.serviceAnimalAlt}
            fill
            sizes="(max-width: 640px) 100vw, 512px"
            className="object-cover"
          />
        </div>

        <div className="space-y-4 p-6">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-left font-serif text-2xl text-[#173a57]">
              {copy.serviceAnimalTitle}
            </DialogTitle>
          </DialogHeader>

          <p className="text-[15px] leading-7 text-slate-600">{copy.serviceAnimalBody}</p>
          <p className="text-[15px] leading-7 text-slate-600">{copy.serviceAnimalNote}</p>

          <div className="flex justify-end pt-1">
            <Button type="button" onClick={() => onOpenChange(false)}>
              {copy.understood}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
