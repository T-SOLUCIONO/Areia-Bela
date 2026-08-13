'use client'

import { BookOpen, MessageCircleQuestion, Minus, Plus } from 'lucide-react'
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

/**
 * Shared by both accordions so the two read as one component.
 *
 * Each row is its own card rather than a rule between siblings: on the tinted
 * band this section now sits on, a hairline border was the only thing telling
 * one question from the next, and it measured as nothing.
 */
const ITEM =
  'group overflow-hidden rounded-2xl border border-border bg-card shadow-soft last:border-b transition-colors data-[state=open]:border-primary/40'
/** The built-in chevron is hidden; the +/− chip below replaces it. */
const TRIGGER =
  'items-center gap-4 px-5 py-4 text-left hover:no-underline [&>svg:last-child]:hidden'

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
      className="relative overflow-hidden bg-secondary/60 py-20 lg:py-28"
      aria-labelledby="details-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            {copy.eyebrow}
          </span>
          <h2
            id="details-heading"
            className="mt-3 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            {copy.title}
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{copy.lead}</p>
        </div>

        {/* What the house has on the left, what guests ask on the right. Two
            kinds of reading side by side rather than one under the other. */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          {amenityTags.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 self-start" aria-label={amenities?.label}>
              {amenityTags.map((tag) => (
                <li
                  key={tag.key}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <ContentIcon name={tag.icon} className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium leading-tight text-foreground">
                    {tag.label}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* The questions and, under them, the long pages. Both are "things
              the guest reads before booking", and putting the pages in a band of
              their own across the full width made them look like a separate
              section that had wandered in. */}
          <div className="flex flex-col gap-3">
            {faqs.length > 0 && (
              <Accordion type="single" collapsible className="flex flex-col gap-3">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className={ITEM}>
                    <AccordionTrigger className={TRIGGER}>
                      <span className="flex min-w-0 items-center gap-3">
                        <MessageCircleQuestion
                          className="h-5 w-5 shrink-0 text-primary/60 transition-colors group-data-[state=open]:text-primary"
                          aria-hidden
                        />
                        <span className="font-display text-base font-semibold text-foreground">
                          {faq.question}
                        </span>
                      </span>
                      <ToggleChip />
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
                        {faq.answer}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}

            {sections.length > 0 && (
              <>
                <h3 className="mt-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden />
                  {copy.house}
                </h3>
                {/* Nada abierto al cargar. Abrir la primera por defecto obliga a
                    quien llega a cerrarla para ver el índice completo, y da a esa
                    sección una prominencia que no pidió nadie. */}
                <Accordion type="single" collapsible className="flex flex-col gap-3">
                  {sections.map(({ slug, icon, page }) => (
                    <AccordionItem key={slug} value={slug} className={ITEM}>
                      <AccordionTrigger className={TRIGGER}>
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground">
                            <ContentIcon name={icon} className="h-4 w-4" />
                          </span>
                          <span className="font-display text-base font-semibold text-foreground">
                            {page!.title}
                          </span>
                        </span>
                        <ToggleChip />
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
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
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The square that turns teal when its row opens.
 *
 * Decorative: the row is a real `button` with `aria-expanded`, so a screen
 * reader already knows the state and does not need a plus sign read to it.
 */
function ToggleChip() {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-foreground transition-colors group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground"
    >
      <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
      <Minus className="hidden h-4 w-4 group-data-[state=open]:block" />
    </span>
  )
}
