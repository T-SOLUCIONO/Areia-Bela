'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ArrowUpRight, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@areia-bela/ui/dialog'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
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
 * It used to open a 4xl box floating over the page, with the photo letterboxed
 * on black inside it: two black bars on a wide screen, and on a phone an image
 * wider than the dialog with the arrows sitting on top of it. Half the thing was
 * empty and the half that wasn't was cropped.
 *
 * Now it takes the whole window. The ground is the same navy the rest of the
 * design uses, blurred, so the photo has nothing competing with it; the strip of
 * thumbnails along the bottom is what fills the space the letterbox used to
 * waste, and it turns forty-six photos from "press next forty-five times" into
 * one glance and one tap.
 */
export function PhotoGallery({ photos, propertyName, showAllLabel, closeLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!api) return
    const sync = () => setCurrent(api.selectedScrollSnap())
    sync()
    api.on('select', sync)
    return () => {
      api.off('select', sync)
    }
  }, [api])

  // Follows the photo. Without this the strip stays on the first six while the
  // carousel is somewhere in the thirties, so the highlight is off screen and
  // the thumbnails stop being a map of where you are.
  useEffect(() => {
    strip.current?.children[current]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [current])

  /**
   * Only the photos within reach carry an `<Image>`.
   *
   * Forty-six full-size photographs mounted at once is megabytes on open, and
   * `loading="lazy"` does not help inside a carousel — every slide is laid out,
   * so the browser considers them all visible. The window wraps, because the
   * carousel loops and slide 0 sits next to slide 45.
   */
  const near = useCallback(
    (index: number) => {
      const distance = Math.abs(index - current)
      return Math.min(distance, photos.length - distance) <= 2
    },
    [current, photos.length],
  )

  if (photos.length === 0) return null

  const currentCaption = photos[current] ? captionOf(photos[current], propertyName) : propertyName

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
          /* Edge to edge. `100dvh` and not `100vh` because a phone's address bar
             eats the difference, which is exactly where the thumbnails sit. */
          className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
        >
          <DialogTitle className="sr-only">{propertyName}</DialogTitle>

          {/* The ground: the design's navy, blurred, rather than plain black.
              The photo is the only thing that should be saturated in here. */}
          <div className="absolute inset-0 bg-ocean-deep/95 backdrop-blur-xl" aria-hidden />

          {/* `min-w-0` is load-bearing. The dialog lays its children out on a
              grid, and a grid item will not shrink below its content's own
              minimum — the carousel's track is forty-three slides wide, so the
              stage came out at 4512px and the photo, centred inside it, sat
              three screens to the right. */}
          <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <span className="glass-dark rounded-full px-3.5 py-1.5 text-xs font-semibold tabular-nums text-white">
                {current + 1} / {photos.length}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="glass-dark grid size-11 place-items-center rounded-full text-white transition-transform hover:scale-105"
              >
                <X className="h-5 w-5" aria-hidden />
                {/* An icon is not a name. Without this a screen reader announces
                    "button" and the only way out of the gallery is unlabelled. */}
                <span className="sr-only">{closeLabel}</span>
              </button>
            </div>

            <Carousel
              setApi={setApi}
              opts={{ loop: true }}
              /* `[&>div]:h-full` reaches the wrapper the carousel puts around
                 its track: it has no className of its own, and without a height
                 it collapses to nothing and takes the photo with it. */
              className="w-full min-w-0 flex-1 [&>div]:h-full"
            >
              <CarouselContent className="ml-0 h-full">
                {photos.map((photo, index) => (
                  <CarouselItem key={photo.id} className="h-full pl-0">
                    <div className="relative h-full w-full">
                      {near(index) && (
                        <Image
                          src={photo.large}
                          alt={captionOf(photo, propertyName)}
                          fill
                          sizes="100vw"
                          priority={index === 0}
                          className={cn(
                            'object-contain transition-opacity duration-500',
                            index === current ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {/* Hidden on a phone, where the gesture is the control and a pair
                  of buttons over the photo is just two things covering it. */}
              <CarouselPrevious className="left-4 hidden size-12 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex" />
              <CarouselNext className="right-4 hidden size-12 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex" />
            </Carousel>

            <div className="shrink-0 space-y-3 px-4 pb-4 pt-3 sm:px-6">
              {/* Two lines at most: some captions run a paragraph long and this
                  is a footer, not the description. */}
              <p className="line-clamp-2 text-center text-sm text-white/90">{currentCaption}</p>

              <div
                ref={strip}
                className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => api?.scrollTo(index)}
                    aria-current={index === current}
                    aria-label={captionOf(photo, propertyName)}
                    className={cn(
                      'relative h-12 w-16 shrink-0 overflow-hidden rounded-lg transition-all sm:h-16 sm:w-24',
                      index === current
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-transparent'
                        : 'opacity-50 hover:opacity-100',
                    )}
                  >
                    <Image
                      src={photo.large}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
