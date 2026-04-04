'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Grid, ChevronLeft, X, Heart, Share2, ArrowUp, ArrowUp01, ArrowUp01Icon, ArrowUpCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageGalleryProps {
  images: string[]
  title: string
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [showAllPhotos, setShowAllPhotos] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [translateX, setTranslateX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const totalImages = images.length

  // Refs para los handlers — evitan el problema de closures stale
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const translateXRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, totalImages - 1))
    setCurrentIndex(clamped)
    setTranslateX(0)
    translateXRef.current = 0
    setIsAnimating(true)
  }, [totalImages])

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    const tx = translateXRef.current
    const width = containerRef.current?.offsetWidth ?? 320
    const threshold = Math.min(100, width * 0.18)

    setIsAnimating(true)
    setCurrentIndex(prev => {
      if (tx < -threshold && prev < totalImages - 1) return prev + 1
      if (tx > threshold && prev > 0) return prev - 1
      return prev
    })
    setTranslateX(0)
    translateXRef.current = 0
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab'
    }
  }, [totalImages])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      e.preventDefault()
    }
    isDraggingRef.current = true
    startXRef.current = e.clientX
    translateXRef.current = 0
    setIsAnimating(false)
    containerRef.current?.setPointerCapture(e.pointerId)
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing'
    }
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const width = containerRef.current?.offsetWidth ?? 320
    let diff = e.clientX - startXRef.current
    const atStart = currentIndex === 0 && diff > 0
    const atEnd = currentIndex === totalImages - 1 && diff < 0
    if (atStart || atEnd) {
      diff = 0
    }
    const maxOffset = width
    diff = Math.max(-maxOffset, Math.min(maxOffset, diff))
    translateXRef.current = diff
    setTranslateX(diff)
  }, [currentIndex, totalImages])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    containerRef.current?.releasePointerCapture(e.pointerId)
    endDrag()
  }, [endDrag])

  const handleShare = useCallback(async () => {
    if (typeof window === 'undefined') return
    const shareData = {
      title,
      url: window.location.href,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }

      await navigator.clipboard.writeText(shareData.url)
      window.alert('Enlace copiado al portapapeles')
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return
      }
      console.error('Share failed', error)
    }
  }, [title])

  const handleLike = useCallback(() => {
    window.alert('Guardado en favoritos')
  }, [])

  useEffect(() => {
    const handleWindowPointerUp = () => {
      if (!isDraggingRef.current) return
      endDrag()
    }
    window.addEventListener('pointerup', handleWindowPointerUp)
    window.addEventListener('pointercancel', handleWindowPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleWindowPointerUp)
      window.removeEventListener('pointercancel', handleWindowPointerUp)
    }
  }, [endDrag])

  useEffect(() => {
    if (isDraggingRef.current) return
    setTranslateX(0)
    translateXRef.current = 0
  }, [currentIndex])

  if (showAllPhotos) {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-y-auto w-full h-full animate-in fade-in zoom-in duration-300">
        <div className="sticky top-0 bg-background z-10 w-full px-4 py-4 md:px-8 border-b border-border flex justify-between items-center">
          <Button variant="ghost" size="icon" onClick={() => setShowAllPhotos(false)} className="rounded-full">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowAllPhotos(false)} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          {images.map((img, idx) => (
            <div key={idx} className="relative aspect-video w-full">
              <Image src={img} alt={`${title} - Photo ${idx + 1}`} fill className="object-cover" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Mobile carousel ─────────────────────────────────────────────
  const MobileCarousel = () => (
    <div
      ref={containerRef}
      className="md:hidden relative overflow-hidden z-0 select-none touch-pan-y"
      style={{ height: 'min(100vw, 403px)', cursor: 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(-${currentIndex * 100}% + ${translateX}px))`,
          transition: isAnimating ? 'transform 220ms cubic-bezier(0.3, 0.8, 0.45, 1)' : 'none',
        }}
      >
        {images.map((img, idx) => (
          <div key={idx} className="w-full h-full flex-shrink-0 relative">
            <Image
              src={img}
              alt={`${title} - Photo ${idx + 1}`}
              fill
              className="object-cover"
              draggable={false}
              priority={idx === 0}
            />
          </div>
        ))}
      </div>

      {/* Pagination dots
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            className={`rounded-full transition-all ${
              idx === currentIndex ? 'bg-white w-2 h-2' : 'bg-white/50 w-1.5 h-1.5'
            }`}
            aria-label={`Ver foto ${idx + 1}`}
          />
        ))}
      </div>*/}

      {/* Counter */}
      <div className="absolute bottom-12 right-4 bg-[rgba(34,34,34,0.66)] text-white text-xs font-semibold px-3 py-1.5 rounded-md">
        {currentIndex + 1} / {totalImages}
      </div>
    </div>
  )

  // ── Desktop grid ────────────────────────────────────────────────
  const DesktopGrid = () => (
    <div className="hidden md:block relative">
      <div className="grid grid-cols-4 gap-2 h-[500px] rounded-xl overflow-hidden">
        <div className="col-span-2 relative h-full group">
          <Image
            src={images[0]}
            alt={`${title} - Main Photo`}
            fill
            className="object-cover group-hover:opacity-90 transition-opacity cursor-pointer"
            onClick={() => setShowAllPhotos(true)}
            priority
          />
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-2 h-full">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="relative h-full group">
              <Image
                src={images[i]}
                alt={`${title} - Photo ${i + 1}`}
                fill
                className="object-cover group-hover:opacity-90 transition-opacity cursor-pointer"
                onClick={() => setShowAllPhotos(true)}
              />
            </div>
          ))}
        </div>
      </div>
      <Button
        variant="outline"
        className="absolute bottom-4 right-4 bg-background/90 hover:bg-background border-border shadow-sm font-semibold rounded-lg"
        onClick={() => setShowAllPhotos(true)}
      >
        <Grid className="mr-2 h-4 w-4" />
        Show all photos
      </Button>
    </div>
  )
  

  return (
    <div className="relative -mx-4 md:mx-0 md:rounded-xl md:overflow-hidden">
      <MobileCarousel />
      <DesktopGrid />
      <div className="absolute top-4 right-4 z-10 flex gap-3">
        <button
          type="button"
          onClick={handleShare}
          aria-label="Compartir este alojamiento"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(250,250,250,0.85)] text-neutral-900 cursor-pointer hover:bg-white transition shadow-md"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleLike}
          aria-label="Guardar en favoritos"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-[rgba(250,250,250,0.85)] text-neutral-900 cursor-pointer hover:bg-white transition shadow-md"
        >
          <Heart className="w-4 h-4" />
        </button>
      </div>
      <div
        className="
          md:hidden
          absolute inset-x-0 bottom-0
          z-10
          pointer-events-none
          bg-white
          h-[24px]
          rounded-t-[24px]
        "
      />
    </div>
  )
}
