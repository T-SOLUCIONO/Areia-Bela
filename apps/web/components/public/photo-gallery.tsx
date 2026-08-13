'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, X } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@areia-bela/ui/dialog'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@areia-bela/ui/carousel'
import { cn } from '@/lib/utils'

type Photo = { id: number; large: string; caption?: string }

type Props = {
  photos: Photo[]
  propertyName: string
  showAllLabel: string
  /** Read aloud instead of "button": an icon is not a name. */
  closeLabel: string
}

/**
 * The caption, or the house.
 *
 * `??` was here, and it only catches null. Nine of the forty-six photos carry
 * `caption: ''` — an empty string is not null, so those rendered `alt=""` and
 * the button around them had no accessible name at all: a screen reader read
 * out "button" and nothing else.
 */
function captionOf(photo: { caption?: string }, fallback: string): string {
  return photo.caption?.trim() || fallback
}

/**
 * All forty-six photos, behind one button.
 *
 * It used to draw a five-tile mosaic of its own with the button pinned in a
 * corner. The section around it now shows the house through the three cards the
 * host writes in the panel and the two photos under them, so a second grid of
 * the same photographs directly above them was the page saying the same thing
 * twice. What is left is what the mosaic could not do: every photo, full size,
 * with a keyboard-navigable carousel.
 */
export function PhotoGallery({ photos, propertyName, showAllLabel, closeLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [startIndex] = useState(0)

  if (photos.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-4',
          'text-sm font-semibold text-foreground shadow-soft transition-all',
          'hover:-translate-y-0.5 hover:border-primary hover:text-primary',
        )}
      >
        {showAllLabel}
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-4xl border-none bg-transparent p-0 shadow-none sm:max-w-4xl"
        >
          <DialogTitle className="sr-only">{propertyName}</DialogTitle>
          <div className="relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-full bg-card"
            >
              <X className="h-4 w-4" />
              {/* An icon is not a name. Without this a screen reader announces
                  "button" and the only way out of the gallery is unlabelled. */}
              <span className="sr-only">{closeLabel}</span>
            </Button>
            <Carousel key={startIndex} opts={{ startIndex, loop: true }}>
              <CarouselContent>
                {photos.map((photo) => (
                  <CarouselItem key={photo.id}>
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-black sm:aspect-video">
                      <Image
                        src={photo.large}
                        alt={captionOf(photo, propertyName)}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
