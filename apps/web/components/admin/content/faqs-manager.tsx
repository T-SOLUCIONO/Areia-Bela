'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, HelpCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@areia-bela/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@areia-bela/ui/empty'
import { Label } from '@areia-bela/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { Switch } from '@areia-bela/ui/switch'
import { ApiError } from '@/lib/api-client'
import { TranslatableField } from '@/components/admin/content/translatable-field'
import { cms, type FAQ, type FAQCategory } from '@/lib/cms-client'
import { useAdminCopy, useAdminCopyRef } from '@/components/admin/admin-language-provider'

const CATEGORIES: FAQCategory[] = ['GENERAL', 'PETS', 'POOL', 'TRASH', 'PARTIES']

type Draft = Pick<FAQ, 'question' | 'answer' | 'category' | 'published'>

const EMPTY_DRAFT: Draft = {
  question: '',
  answer: '',
  category: 'GENERAL',
  published: true,
}

interface Props {
  /** Lets the rail refresh its count after an add or a delete. */
  onChanged?: () => void | Promise<void>
}

export function FaqsManager({ onChanged }: Props) {
  const t = useAdminCopy()
  const copyRef = useAdminCopyRef()
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<FAQ | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setFaqs(await cms.faqs())
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

  const openNew = () => {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
  }

  const openEdit = (faq: FAQ) => {
    setEditing(faq)
    setDraft({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      published: faq.published,
    })
  }

  const save = async () => {
    if (!draft) return
    setIsSaving(true)
    try {
      if (editing) await cms.updateFaq(editing.id, draft)
      else await cms.createFaq(draft)
      setDraft(null)
      await load()
      await onChanged?.()
      toast.success(t.content.saved)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setIsSaving(false)
    }
  }

  const act = async (id: string, run: () => Promise<unknown>, success: string) => {
    setPendingId(id)
    try {
      await run()
      await load()
      await onChanged?.()
      toast.success(success)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.content.saveFailed)
    } finally {
      setPendingId(null)
    }
  }

  /**
   * Reorders locally and sends the whole list; the API writes it in one
   * transaction, so a half-applied order can't happen.
   */
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= faqs.length) return
    const next = [...faqs]
    ;[next[index], next[target]] = [next[target], next[index]]
    setFaqs(next)
    void act(next[target].id, () => cms.reorderFaqs(next.map((f) => f.id)), t.content.saved)
  }

  const isComplete = Boolean(draft?.question.trim() && draft.answer.trim())

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" aria-hidden />
          {t.content.faqAdd}
        </Button>
      </div>

      {faqs.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <HelpCircle aria-hidden />
          </EmptyMedia>
          <EmptyTitle>{t.content.faqs}</EmptyTitle>
          <EmptyDescription>{t.content.faqEmpty}</EmptyDescription>
        </Empty>
      ) : (
        <ul className="space-y-3">
          {faqs.map((faq, index) => (
            <li
              key={faq.id}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex flex-col gap-1 pt-0.5">
                <Button
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
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  aria-label={t.content.moveDown}
                  disabled={index === faqs.length - 1 || pendingId !== null}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{faq.question}</p>
                  <Badge variant="secondary">{t.content.categories[faq.category]}</Badge>
                  {!faq.published && <Badge variant="outline">{t.content.hidden}</Badge>}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{faq.answer}</p>
              </div>

              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t.content.faqEdit}
                  onClick={() => openEdit(faq)}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t.content.faqDelete}
                  disabled={pendingId === faq.id}
                  onClick={() =>
                    void act(faq.id, () => cms.deleteFaq(faq.id), t.content.faqDeleted)
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editing ? t.content.faqEdit : t.content.faqNew}
            </DialogTitle>
            <DialogDescription>{t.content.subtitle}</DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <TranslatableField
                id="faq-question"
                label={t.content.faqQuestion}
                value={draft.question}
                onChange={(question) => setDraft({ ...draft, question })}
              />
              <TranslatableField
                id="faq-answer"
                label={t.content.faqAnswer}
                multiline
                rows={4}
                value={draft.answer}
                onChange={(answer) => setDraft({ ...draft, answer })}
              />

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="faq-category">{t.content.faqCategory}</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(category: FAQCategory) => setDraft({ ...draft, category })}
                  >
                    <SelectTrigger id="faq-category" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {t.content.categories[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Label className="flex items-center gap-2 pb-2 text-sm font-normal">
                  <Switch
                    checked={draft.published}
                    onCheckedChange={(published) => setDraft({ ...draft, published })}
                  />
                  {draft.published ? t.content.published : t.content.hidden}
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={!isComplete || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isSaving ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
