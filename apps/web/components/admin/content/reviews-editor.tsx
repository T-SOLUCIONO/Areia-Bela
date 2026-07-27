'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, MessageSquareQuote, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Switch } from '@areia-bela/ui/switch'
import { ApiError } from '@/lib/api-client'
import { landing, type Review } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { BilingualField } from '@/components/admin/content/bilingual-field'
import { ImageField } from '@/components/admin/content/image-field'
import { cn } from '@/lib/utils'

export function ReviewsEditor() {
  const t = useAdminCopy()
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Review>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const load = useCallback(async () => {
    try {
      setReviews(await landing.reviews())
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.loadFailed)
      setReviews([])
    }
  }, [t.content.loadFailed])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  if (!reviews) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )
  }

  const draftFor = (review: Review) => drafts[review.id] ?? review
  const isDirty = (review: Review) =>
    drafts[review.id] !== undefined && JSON.stringify(drafts[review.id]) !== JSON.stringify(review)

  const edit = (review: Review, patch: Partial<Review>) =>
    setDrafts((prev) => ({ ...prev, [review.id]: { ...draftFor(review), ...patch } }))

  const run = async (id: string | null, action: () => Promise<unknown>, success?: string) => {
    setPendingId(id)
    try {
      await action()
      await load()
      if (success) toast.success(success)
      return true
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
      return false
    } finally {
      setPendingId(null)
    }
  }

  const save = async (review: Review) => {
    const draft = draftFor(review)
    const ok = await run(
      review.id,
      () =>
        landing.updateReview(review.id, {
          authorName: draft.authorName,
          authorPhotoUrl: draft.authorPhotoUrl,
          rating: draft.rating,
          textEs: draft.textEs,
          textEn: draft.textEn,
          stayedAtEs: draft.stayedAtEs,
          stayedAtEn: draft.stayedAtEn,
          verified: draft.verified,
          featured: draft.featured,
          published: draft.published,
        }),
      t.content.saved,
    )
    if (ok) setDrafts((prev) => ({ ...prev, [review.id]: undefined as unknown as Review }))
  }

  const add = async () => {
    setIsAdding(true)
    try {
      await landing.createReview({
        authorName: t.content.reviewNewAuthor,
        textEs: t.content.reviewNewText,
        textEn: t.content.reviewNewText,
      })
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setIsAdding(false)
    }
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= reviews.length) return
    const next = [...reviews]
    ;[next[index], next[target]] = [next[target], next[index]]
    void run(next[target].id, () => landing.reorderReviews(next.map((r) => r.id)))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t.content.reviewsHint}</p>
        <Button disabled={isAdding} onClick={() => void add()}>
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {t.content.reviewAdd}
        </Button>
      </div>

      {reviews.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <MessageSquareQuote aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t.content.reviews}</EmptyTitle>
          <EmptyDescription>{t.content.reviewsEmpty}</EmptyDescription>
        </Empty>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review, index) => {
            const draft = draftFor(review)
            return (
              <li
                key={review.id}
                className={cn(
                  'rounded-xl border bg-card p-5',
                  pendingId === review.id && 'opacity-60',
                  draft.featured && 'border-primary/40 ring-1 ring-primary/20',
                  !draft.published && 'border-dashed',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1 pt-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      aria-label={t.content.moveUp}
                      disabled={index === 0 || pendingId !== null}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      aria-label={t.content.moveDown}
                      disabled={index === reviews.length - 1 || pendingId !== null}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>

                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {draft.featured && <Badge>{t.content.reviewFeatured}</Badge>}
                      {!draft.published && <Badge variant="outline">{t.content.hidden}</Badge>}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`author-${review.id}`}>{t.content.reviewAuthor}</Label>
                        <Input
                          id={`author-${review.id}`}
                          value={draft.authorName}
                          onChange={(e) => edit(review, { authorName: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`rating-${review.id}`}>{t.content.reviewRating}</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`rating-${review.id}`}
                            type="number"
                            min={1}
                            max={5}
                            className="w-20"
                            value={draft.rating}
                            onChange={(e) =>
                              edit(review, {
                                rating: Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                              })
                            }
                          />
                          <div className="flex gap-0.5" aria-hidden>
                            {Array.from({ length: draft.rating }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <BilingualField
                      label={t.content.reviewText}
                      multiline
                      rows={4}
                      valueEs={draft.textEs}
                      valueEn={draft.textEn}
                      onChange={(p) =>
                        edit(review, {
                          ...(p.es !== undefined && { textEs: p.es }),
                          ...(p.en !== undefined && { textEn: p.en }),
                        })
                      }
                    />

                    <BilingualField
                      label={t.content.reviewDate}
                      valueEs={draft.stayedAtEs}
                      valueEn={draft.stayedAtEn}
                      placeholder="noviembre de 2025"
                      onChange={(p) =>
                        edit(review, {
                          ...(p.es !== undefined && { stayedAtEs: p.es }),
                          ...(p.en !== undefined && { stayedAtEn: p.en }),
                        })
                      }
                    />

                    <ImageField
                      label={t.content.reviewPhoto}
                      shape="square"
                      value={draft.authorPhotoUrl}
                      onChange={(authorPhotoUrl) => edit(review, { authorPhotoUrl })}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                      <div className="flex flex-wrap gap-4">
                        <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                          <Switch
                            checked={draft.published}
                            onCheckedChange={(published) => edit(review, { published })}
                          />
                          {draft.published ? t.content.published : t.content.hidden}
                        </Label>
                        <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                          <Switch
                            checked={draft.verified}
                            onCheckedChange={(verified) => edit(review, { verified })}
                          />
                          {t.content.reviewVerified}
                        </Label>
                        {/* Promoting one demotes the rest, server-side. */}
                        <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                          <Switch
                            checked={draft.featured}
                            onCheckedChange={(featured) => edit(review, { featured })}
                          />
                          {t.content.reviewFeature}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={pendingId !== null}
                          onClick={() =>
                            void run(
                              review.id,
                              () => landing.deleteReview(review.id),
                              t.content.reviewDeleted,
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          {t.content.faqDelete}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!isDirty(review) || pendingId !== null}
                          onClick={() => void save(review)}
                        >
                          {t.common.save}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
