'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Grid2x2, X } from 'lucide-react'
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

export function PhotoGallery({ photos, propertyName, showAllLabel, closeLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [startIndex, setStartIndex] = useState(0)

  const openAt = (index: number) => {
    setStartIndex(index)
    setOpen(true)
  }

  const tiles = photos.slice(0, 5)
  const hero = tiles[0]
  const thumbs = tiles.slice(1, 5)

  if (!hero) return null

  return (
    <>
      <div className="grid grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-[28px] sm:gap-3">
        <button
          type="button"
          onClick={() => openAt(0)}
          className="relative col-span-4 row-span-2 aspect-[4/3] overflow-hidden sm:col-span-2 sm:aspect-auto"
        >
          <Image
            src={hero.large}
            alt={captionOf(hero, propertyName)}
            fill
            className="object-cover transition-transform duration-700 hover:scale-[1.03]"
            priority
          />
        </button>

        {thumbs.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => openAt(index + 1)}
            className={cn(
              'relative hidden aspect-square overflow-hidden sm:block',
              index < 2 ? 'sm:col-span-1' : 'sm:col-span-1',
            )}
          >
            <Image
              src={photo.large}
              alt={captionOf(photo, propertyName)}
              fill
              className="object-cover transition-transform duration-700 hover:scale-[1.03]"
            />
          </button>
        ))}

        <button
          type="button"
          onClick={() => openAt(0)}
          className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-[#173a57] shadow-[0_8px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-50"
        >
          <Grid2x2 className="h-4 w-4" />
          {showAllLabel}
        </button>
      </div>

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
              className="absolute right-2 top-2 z-10 rounded-full bg-white"
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
