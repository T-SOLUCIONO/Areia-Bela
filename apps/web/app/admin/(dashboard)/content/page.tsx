'use client'

import { useCallback, useEffect, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@areia-bela/ui/sheet'
import { cms, landing } from '@/lib/cms-client'
import {
  ContentNav,
  PAGE_ORDER,
  SECTION_ORDER,
  type ContentState,
  type ContentTarget,
} from '@/components/admin/content/content-nav'
import { PropertySettings } from '@/components/admin/property-settings'
import { SiteSettings } from '@/components/admin/site-settings'
import { PagesEditor } from '@/components/admin/content/pages-editor'
import { FaqsManager } from '@/components/admin/content/faqs-manager'
import { GalleryManager } from '@/components/admin/content/gallery-manager'
import { LandingEditor } from '@/components/admin/content/landing-editor'
import { ReviewsEditor } from '@/components/admin/content/reviews-editor'
import { TranslationNotice } from '@/components/admin/content/translation-notice'
import { StorageNotice } from '@/components/admin/content/storage-notice'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * The guest site's own content, editable without touching code.
 *
 * Everything here is bilingual by construction: there is no way to save a
 * Spanish string without an English one beside it, because half a translation
 * shipping to production is the failure mode this screen exists to prevent.
 *
 * ## Why one rail instead of tabs
 *
 * This was five tabs, and inside two of them another list — eight sections and
 * twelve pages. Twenty-odd editable things behind a menu inside a menu, named
 * after shapes in the database rather than places on the site. Somebody opening
 * it for the first time could not tell what the screen was for.
 *
 * Now one rail holds all of it, grouped the way the site is: the page a visitor
 * scrolls, the lists that feed it, and the pages of house information.
 */
export default function ContentPage() {
  const t = useAdminCopy()
  const [target, setTarget] = useState<ContentTarget>({ kind: 'section', key: 'HERO' })
  const [state, setState] = useState<ContentState | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  /**
   * What the rail shows without opening anything.
   *
   * Fetched here and separately from the editors on purpose. The editors own
   * their own loading and saving, and threading their data up would couple five
   * independent screens to this one. The cost is a refetch after a save, which
   * is what `refresh` is for.
   */
  const refresh = useCallback(async () => {
    try {
      const [sections, pages, reviews, faqs, photos] = await Promise.all([
        landing.sections(),
        cms.pages(),
        landing.reviews(),
        cms.faqs(),
        cms.gallery(),
      ])
      setState({
        hiddenSections: new Set(
          sections.filter((section) => !section.published).map((section) => section.key),
        ),
        // "Empty" means the heading is blank: a section with no title is one
        // the visitor sees as a gap, whatever else it holds.
        emptySections: new Set(
          SECTION_ORDER.filter(
            (key) => !sections.find((section) => section.key === key)?.title.trim(),
          ),
        ),
        emptyPages: new Set(
          PAGE_ORDER.filter((slug) => !pages.find((page) => page.slug === slug)?.body.trim()),
        ),
        reviews: reviews.length,
        faqs: faqs.length,
        photos: photos.length,
      })
    } catch {
      // The rail's badges are a convenience; the editors report their own
      // failures. Losing a count must not blank the screen someone came to use.
      setState(null)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const label =
    target.kind === 'section'
      ? `${SECTION_ORDER.indexOf(target.key) + 1} · ${t.content.sections[target.key]}`
      : target.kind === 'page'
        ? t.content.slugs[target.slug]
        : target.kind === 'setup'
          ? t.content.setup[target.key]
          : t.content[target.kind]

  const select = (next: ContentTarget) => {
    setTarget(next)
    setNavOpen(false)
  }

  const nav = <ContentNav state={state} target={target} onSelect={select} />

  return (
    <div className="space-y-4">
      <TranslationNotice />
      <StorageNotice />

      {/* On a phone the rail would be twenty rows above the form someone came
          to fill in. It becomes a sheet, and the trigger doubles as the answer
          to "where am I". */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 lg:hidden">
            <PanelLeft className="h-4 w-4" aria-hidden />
            <span className="truncate">{label}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[19rem] overflow-y-auto">
          <SheetHeader className="pb-2">
            <SheetTitle>{t.content.title}</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6">{nav}</div>
        </SheetContent>
      </Sheet>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,16rem)_1fr]">
        <div className="hidden lg:block">
          {/* Sticky because the forms below are long and the rail is how you
              leave one. */}
          <div className="sticky top-6">{nav}</div>
        </div>

        <div className="min-w-0">
          {target.kind === 'section' && <LandingEditor selected={target.key} onSaved={refresh} />}
          {target.kind === 'page' && <PagesEditor selected={target.slug} onSaved={refresh} />}
          {target.kind === 'reviews' && <ReviewsEditor onChanged={refresh} />}
          {target.kind === 'faqs' && <FaqsManager onChanged={refresh} />}
          {target.kind === 'gallery' && <GalleryManager onChanged={refresh} />}
          {/* One row in the database behind five screens. Each panel loads and
              saves the whole row, so editing the phone number cannot wipe the
              search description. */}
          {target.kind === 'setup' && target.key === 'house' && <PropertySettings />}
          {target.kind === 'setup' && target.key === 'contact' && (
            <SiteSettings section="contact" />
          )}
          {target.kind === 'setup' && target.key === 'seo' && <SiteSettings section="seo" />}
          {target.kind === 'setup' && target.key === 'brand' && <SiteSettings section="brand" />}
          {target.kind === 'setup' && target.key === 'airbnb' && <SiteSettings section="airbnb" />}
        </div>
      </div>
    </div>
  )
}
