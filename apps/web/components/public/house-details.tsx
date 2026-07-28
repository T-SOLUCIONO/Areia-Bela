'use client'

import { BookOpen, HelpCircle } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@areia-bela/ui/accordion'
import type { CMSPageSlug } from '@/lib/cms-client'
import { useSiteContent } from '@/components/public/site-content-provider'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'

/** The order these read in on the page, not the order they were written. */
const SECTIONS: CMSPageSlug[] = [
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
  'POLICIES',
]

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
export function HouseDetails() {
  const content = useSiteContent()
  const { language } = useLanguage()
  const copy = translations[language].details

  const sections = SECTIONS.map((slug) => content?.pages[slug]).filter((page) => page !== undefined)
  const faqs = content?.faqs ?? []

  if (sections.length === 0 && faqs.length === 0) return null

  return (
    <section
      id="details"
      className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-10"
      aria-labelledby="details-heading"
    >
      <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#174d7a]">
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

        <div className="mt-8 grid gap-x-12 gap-y-10 lg:grid-cols-2">
          {sections.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.house}
              </h3>
              <Accordion type="single" collapsible>
                {sections.map((page) => (
                  <AccordionItem key={page.slug} value={page.slug} className="border-slate-200">
                    <AccordionTrigger className="text-left font-serif text-lg text-[#173a57] hover:text-[#174d7a] hover:no-underline">
                      {page.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      {/* Stored as plain text: blank lines are paragraph breaks. */}
                      <div className="space-y-3 text-[15px] leading-7 text-slate-600">
                        {page.body.split(/\n{2,}/).map((paragraph, index) => (
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
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                <HelpCircle className="h-4 w-4 text-[#174d7a]" aria-hidden />
                {copy.faqs}
              </h3>
              <Accordion type="single" collapsible>
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id} className="border-slate-200">
                    <AccordionTrigger className="text-left text-[15px] font-medium text-[#173a57] hover:text-[#174d7a] hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-[15px] leading-7 text-slate-600">
                      {faq.answer}
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
