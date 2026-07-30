'use client'

import { BookOpen, MessageCircleQuestion } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@areia-bela/ui/accordion'
import type { CMSPageSlug } from '@/lib/cms-client'
import { useSiteContent } from '@/components/public/site-content-provider'
import { useLanguage } from '@/components/language-provider'
import { ContentIcon } from '@/lib/content-icons'
import { translations } from '@/lib/i18n'

/**
 * The order these read in on the page, and the icon each one carries.
 *
 * An icon per section rather than a uniform list: eleven identical rows of
 * navy text is a wall, and the icon is what lets someone scanning for the pet
 * policy find it without reading every heading.
 */
const SECTIONS: Array<{ slug: CMSPageSlug; icon: string }> = [
  { slug: 'ABOUT_SPACE', icon: 'Home' },
  { slug: 'ACCOMMODATION', icon: 'Key' },
  { slug: 'LIVING_AREAS', icon: 'Tv' },
  { slug: 'KITCHEN_DINING', icon: 'ChefHat' },
  { slug: 'BEDROOMS_BATHROOMS', icon: 'Bath' },
  { slug: 'OUTDOOR_LIFE', icon: 'Palmtree' },
  { slug: 'AMENITIES', icon: 'Sparkles' },
  { slug: 'LOCATION', icon: 'MapPin' },
  { slug: 'GUEST_ACCESS', icon: 'Users' },
  { slug: 'HOUSE_RULES', icon: 'Shield' },
  { slug: 'POLICIES', icon: 'Leaf' },
]

/** Shared by both columns so the two accordions read as one component. */
const ITEM =
  'group border-b border-slate-200/80 last:border-b-0 data-[state=open]:border-[#174d7a]/25'
const TRIGGER = 'gap-3 py-4 text-left hover:no-underline [&>svg]:text-[#174d7a]'

/**
 * The long-form copy and the questions, straight from the CMS.
 *
 * Wears the same clothes as the sections around it — the rounded white card on
 * cream, the long soft shadow, the navy heading with an icon eyebrow. It used
 * to be a bare accordion in a narrow centred column with none of that, inside a
 * page that is otherwise 1440px wide, which is why it read as bolted on.
 *
 * Two columns rather than one stacked under the other: the prose and the
 * questions are different kinds of reading, and side by side they use the width
 * instead of pushing the page a screen taller.
 *
 * Renders nothing when there is nothing published — an empty accordion is worse
 * than no section at all.
 */
type AmenityTag = { key: string; icon: string; label: string }

export function HouseDetails({
  amenities,
}: {
  /** Rendered inside this card; see the note where it is passed in. */
  amenities?: { label: string; tags: AmenityTag[] }
} = {}) {
  const content = useSiteContent()
  const { language } = useLanguage()
  const copy = translations[language].details

  const sections = SECTIONS.map((entry) => ({ ...entry, page: content?.pages[entry.slug] })).filter(
    (entry) => entry.page !== undefined,
  )
  const faqs = content?.faqs ?? []

  const amenityTags = amenities?.tags ?? []
  if (sections.length === 0 && faqs.length === 0 && amenityTags.length === 0) return null

  return (
    <section
      id="details"
      className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
      aria-labelledby="details-heading"
    >
      <div className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-10">
        {/* A wash of brand colour in the corner, echoing the gallery section —
            enough that a tall block of text doesn't read as a plain white box. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(23,77,122,0.07),transparent_70%)]"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-amber-600">
              <BookOpen className="h-5 w-5" aria-hidden />
              <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                {copy.eyebrow}
              </span>
            </div>
            <h2
              id="details-heading"
              className="mt-3 font-serif text-3xl text-[#173a57] sm:text-4xl"
            >
              {copy.title}
            </h2>
          </div>
          <p className="max-w-xl text-[15px] leading-7 text-slate-600">{copy.lead}</p>
        </div>

        {amenityTags.length > 0 && (
          <div className="relative mt-8">
            <ColumnHeading label={amenities?.label ?? ''} count={amenityTags.length} />
            <div className="mt-4 flex flex-wrap gap-2">
              {amenityTags.map((tag) => (
                <span
                  key={tag.key}
                  className="flex items-center gap-2.5 rounded-full border border-slate-200/80 bg-white py-1.5 pl-1.5 pr-4 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#174d7a]/8 text-[#174d7a]">
                    <ContentIcon name={tag.icon} className="h-3.5 w-3.5" />
                  </span>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="relative mt-10 grid gap-x-14 gap-y-10 lg:grid-cols-2">
          {sections.length > 0 && (
            <div>
              <ColumnHeading label={copy.house} count={sections.length} />
              <Accordion type="single" collapsible defaultValue={sections[0]?.slug}>
                {sections.map(({ slug, icon, page }) => (
                  <AccordionItem key={slug} value={slug} className={ITEM}>
                    <AccordionTrigger className={TRIGGER}>
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#174d7a]/10 text-[#174d7a] transition-colors group-data-[state=open]:bg-[#174d7a] group-data-[state=open]:text-white">
                          <ContentIcon name={icon} className="h-4 w-4" />
                        </span>
                        <span className="font-serif text-lg text-[#173a57]">{page!.title}</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {/* Indented to the text, not the icon, so the open panel
                          lines up with the heading it belongs to. */}
                      <div className="space-y-3 pb-2 pl-12 text-[15px] leading-7 text-slate-600">
                        {page!.body.split(/\n{2,}/).map((paragraph, index) => (
                          <p key={index} className="whitespace-pre-line">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {faqs.length > 0 && (
            <div>
              <ColumnHeading label={copy.faqs} count={faqs.length} />
              <Accordion type="single" collapsible defaultValue={faqs[0]?.id}>
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className={ITEM}>
                    <AccordionTrigger className={TRIGGER}>
                      <span className="flex min-w-0 items-start gap-3">
                        <MessageCircleQuestion
                          className="mt-0.5 h-5 w-5 shrink-0 text-[#174d7a]/60 transition-colors group-data-[state=open]:text-[#174d7a]"
                          aria-hidden
                        />
                        <span className="text-[15px] font-medium text-[#173a57]">
                          {faq.question}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pb-2 pl-8 text-[15px] leading-7 text-slate-600">
                        {faq.answer}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/** The count sets an expectation: eleven sections is a lot to open blindly. */
function ColumnHeading({ label, count }: { label: string; count: number }) {
  return (
    <div className="mb-1 flex items-baseline gap-2 border-b border-slate-200/80 pb-3">
      {/* <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</h3>
      <span className="text-xs tabular-nums text-slate-400">{count}</span>*/}
    </div>
  )
}
