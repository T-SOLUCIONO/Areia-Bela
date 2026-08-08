'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  GripVertical,
  ImagePlus,
  Images,
  Loader2,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@areia-bela/ui/alert-dialog'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { Input } from '@areia-bela/ui/input'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Switch } from '@areia-bela/ui/switch'
import { ApiError } from '@/lib/api-client'
import { cms, type GalleryImage } from '@/lib/cms-client'
import { useAdminCopy, useAdminCopyRef } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

interface Props {
  /** Lets the rail refresh its count after an add or a delete. */
  onChanged?: () => void | Promise<void>
}

/**
 * One photo, draggable.
 *
 * `useSortable` is a hook, so it cannot live inside a `.map`. It returns the
 * grip's props rather than drawing the grip, so the handle joins the row of
 * controls that already sits on the image.
 */
function SortablePhoto({
  id,
  disabled,
  className,
  children,
}: {
  id: string
  disabled: boolean
  className?: string
  children: (handle: { props: Record<string, unknown> }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(className, isDragging && 'z-10 opacity-60 shadow-lg')}
    >
      {children({ props: { ...attributes, ...listeners } })}
    </li>
  )
}

export function GalleryManager({ onChanged }: Props) {
  const t = useAdminCopy()
  const copyRef = useAdminCopyRef()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GalleryImage | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setImages(await cms.gallery())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copyRef.current.content.loadFailed)
    } finally {
      setIsLoading(false)
    }
  }, [copyRef])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  /** Sequential, not parallel: the progress line names one file at a time. */
  const upload = async (files: FileList) => {
    let added = 0
    for (const file of Array.from(files)) {
      setUploading(file.name)
      try {
        await cms.uploadImage(file, '')
        added += 1
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t.content.saveFailed)
      }
    }
    setUploading(null)
    if (added > 0) {
      await load()
      await onChanged?.()
      toast.success(fill(t.content.galleryUploaded, { count: String(added) }))
    }
  }

  const act = async (id: string, run: () => Promise<unknown>, success?: string) => {
    setPendingId(id)
    try {
      await run()
      await load()
      await onChanged?.()
      if (success) toast.success(success)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setPendingId(null)
    }
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = images.findIndex((i) => i.id === active.id)
    const to = images.findIndex((i) => i.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(images, from, to)
    void act(
      String(active.id),
      () => cms.reorderImages(next.map((i) => i.id)),
      t.content.galleryReordered,
    )
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setImages(next)
    void act(moved.id, () => cms.reorderImages(next.map((i) => i.id)), t.content.galleryReordered)
  }

  /** Alt text saves on blur — one request per photo, not one per keystroke. */
  const saveAlt = (image: GalleryImage, value: string) => {
    if (image.alt === value) return
    setImages((prev) => prev.map((i) => (i.id === image.id ? { ...i, alt: value } : i)))
    void act(image.id, () => cms.updateImage(image.id, { alt: value }))
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="aspect-4/3" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {fill(t.content.galleryCount, { count: String(images.length) })} · {t.content.galleryHint}
        </p>
        <Button onClick={() => fileInput.current?.click()} disabled={uploading !== null}>
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          {uploading
            ? fill(t.content.galleryUploading, { name: uploading })
            : t.content.galleryUpload}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) void upload(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {images.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Images aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t.content.gallery}</EmptyTitle>
          <EmptyDescription>{t.content.galleryEmpty}</EmptyDescription>
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          {/* `rectSortingStrategy` y no la vertical: esto es una rejilla, y las
              fotos se mueven en dos ejes. */}
          <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <SortablePhoto
                  key={image.id}
                  id={image.id}
                  disabled={pendingId !== null}
                  className={cn(
                    'group overflow-hidden rounded-xl border bg-card transition-shadow',
                    'hover:shadow-md',
                    pendingId === image.id && 'pointer-events-none opacity-60',
                  )}
                >
                  {(handle) => (
                    <>
                      <div className="relative aspect-4/3 bg-muted">
                        <Image
                          src={image.url}
                          alt={image.alt}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className={cn('object-cover', !image.published && 'grayscale')}
                        />
                        {index === 0 && (
                          <Badge className="absolute left-2 top-2">{t.content.galleryCover}</Badge>
                        )}
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          {/* El asa, no la tarjeta entera: debajo hay un campo de texto y
                      un interruptor, y una tarjeta que se arrastra al intentar
                      escribir el pie de foto pelea contigo. */}
                          <button
                            type="button"
                            aria-label={t.content.dragToReorder}
                            className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md bg-secondary text-secondary-foreground shadow-sm active:cursor-grabbing"
                            {...handle.props}
                          >
                            <GripVertical className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            aria-label={t.content.moveUp}
                            disabled={index === 0}
                            onClick={() => reorder(index, index - 1)}
                          >
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            aria-label={t.content.moveDown}
                            disabled={index === images.length - 1}
                            onClick={() => reorder(index, index + 1)}
                          >
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7"
                            aria-label={t.content.galleryDelete}
                            onClick={() => setConfirmDelete(image)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2 p-3">
                        <Input
                          defaultValue={image.alt}
                          placeholder={t.content.galleryAlt}
                          aria-label={t.content.galleryAlt}
                          onBlur={(event) => saveAlt(image, event.target.value)}
                          className="h-8 text-sm"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={image.published}
                            onCheckedChange={(published) =>
                              void act(image.id, () => cms.updateImage(image.id, { published }))
                            }
                          />
                          {image.published ? t.content.published : t.content.hidden}
                        </label>
                      </div>
                    </>
                  )}
                </SortablePhoto>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">{t.content.galleryDelete}</AlertDialogTitle>
            <AlertDialogDescription>{t.content.galleryDeleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const image = confirmDelete
                setConfirmDelete(null)
                if (image) {
                  void act(image.id, () => cms.deleteImage(image.id), t.content.galleryDeleted)
                }
              }}
            >
              {t.content.faqDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
