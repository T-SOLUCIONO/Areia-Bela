'use client'

import { useState } from 'react'
import { ChevronDown, EyeOff } from 'lucide-react'
import type { CMSPageSlug, ContentSectionKey } from '@/lib/cms-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { cn } from '@/lib/utils'

/** The landing sections in the order a visitor scrolls past them. */
export const SECTION_ORDER: ContentSectionKey[] = [
  'HERO',
  'FEATURES',
  'AMENITIES',
  'REVIEWS',
  'LOCATION',
  'DIRECT_BOOKING',
  'HOST',
  'FOOTER',
]

/** The house pages, in the order the guest site reads them. */
export const PAGE_ORDER: CMSPageSlug[] = [
  'ABOUT_SPACE',
  'ACCOMMODATION',
  'LIVING_AREAS',
  'KITCHEN_DINING',
  'BEDROOMS_BATHROOMS',
  'OUTDOOR_LIFE',
  'AMENITIES',
  'LOCATION',
  'GUEST_ACCESS',
  'HOUSE_RULES',
  'FAQS',
  'POLICIES',
]

/** Where the editor is pointing. */
export type ContentTarget =
  | { kind: 'section'; key: ContentSectionKey }
  | { kind: 'page'; slug: CMSPageSlug }
  | { kind: 'reviews' }
  | { kind: 'faqs' }
  | { kind: 'gallery' }

/** What the rail knows without opening anything. */
export interface ContentState {
  hiddenSections: Set<ContentSectionKey>
  emptySections: Set<ContentSectionKey>
  emptyPages: Set<CMSPageSlug>
  reviews: number
  faqs: number
  photos: number
}

interface Props {
  state: ContentState | null
  target: ContentTarget
  onSelect: (target: ContentTarget) => void
}

/**
 * One rail for everything the guest site shows.
 *
 * It replaces two stacked levels of navigation — five tabs, and inside two of
 * them another list of eight and twelve. Twenty-odd editable things behind a
 * menu inside a menu is why someone opening this for the first time could not
 * tell what the screen was for.
 *
 * ## Grouped the way the site is, not the way the data is
 *
 * The tabs were named after shapes in the database: Landing, Pages, Reviews,
 * FAQs, Gallery. That is the developer's model. A host's model is "the page
 * people scroll" and "the lists that feed it", so the groups are those.
 *
 * ## The numbers are real
 *
 * Landing sections are numbered because a visitor genuinely meets them in that
 * order — the number says *where on the page*, which is the question a host
 * asks when something looks wrong. Nothing else here is numbered, because
 * nothing else is a sequence.
 *
 * ## State without clicking
 *
 * Hidden and empty used to be discoverable only by opening each one in turn.
 * A library's count answers "is there anything in there?" the same way.
 */
export function ContentNav({ state, target, onSelect }: Props) {
  const t = useAdminCopy()
  // Twelve legal and information pages are the least-visited corner of this
  // screen, and expanded they doubled the rail. Folded, they stay one click
  // away and stop competing with the page people actually edit.
  const [pagesOpen, setPagesOpen] = useState(target.kind === 'page')

  const row = (
    active: boolean,
    key: string,
    label: string,
    onClick: () => void,
    extra?: React.ReactNode,
    index?: number,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
        active
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {index !== undefined && (
        <span
          className={cn(
            'w-4 shrink-0 text-right text-[11px] tabular-nums',
            active ? 'text-primary/70' : 'text-muted-foreground/60',
          )}
          aria-hidden
        >
          {index}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
    </button>
  )

  const count = (value: number) => (
    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{value}</span>
  )

  return (
    <nav className="space-y-5" aria-label={t.content.title}>
      <div className="space-y-0.5">
        <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {t.content.groupLanding}
        </p>
        {SECTION_ORDER.map((key, index) =>
          row(
            target.kind === 'section' && target.key === key,
            key,
            t.content.sections[key],
            () => onSelect({ kind: 'section', key }),
            <>
              {state?.emptySections.has(key) && (
                <span className="shrink-0 text-[11px] text-amber-600">{t.content.stateEmpty}</span>
              )}
              {state?.hiddenSections.has(key) && (
                <EyeOff
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-label={t.content.hidden}
                />
              )}
            </>,
            index + 1,
          ),
        )}
      </div>

      <div className="space-y-0.5">
        <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {t.content.groupLibraries}
        </p>
        {row(
          target.kind === 'reviews',
          'reviews',
          t.content.libraryReviews,
          () => onSelect({ kind: 'reviews' }),
          state && count(state.reviews),
        )}
        {row(
          target.kind === 'faqs',
          'faqs',
          t.content.libraryFaqs,
          () => onSelect({ kind: 'faqs' }),
          state && count(state.faqs),
        )}
        {row(
          target.kind === 'gallery',
          'gallery',
          t.content.libraryPhotos,
          () => onSelect({ kind: 'gallery' }),
          state && count(state.photos),
        )}
      </div>

      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => setPagesOpen((open) => !open)}
          aria-expanded={pagesOpen}
          className="flex w-full items-center gap-1.5 px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', !pagesOpen && '-rotate-90')}
            aria-hidden
          />
          {t.content.groupPages}
          <span className="ml-auto tabular-nums normal-case tracking-normal">
            {PAGE_ORDER.length}
          </span>
        </button>
        {pagesOpen &&
          PAGE_ORDER.map((slug) =>
            row(
              target.kind === 'page' && target.slug === slug,
              slug,
              t.content.slugs[slug],
              () => onSelect({ kind: 'page', slug }),
              state?.emptyPages.has(slug) ? (
                <span className="shrink-0 text-[11px] text-amber-600">{t.content.stateEmpty}</span>
              ) : undefined,
            ),
          )}
      </div>
    </nav>
  )
}
