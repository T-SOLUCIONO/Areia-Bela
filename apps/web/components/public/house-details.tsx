'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@areia-bela/ui/accordion'
import type { CMSPageSlug } from '@/lib/cms-client'
import { useSiteContent } from '@/components/public/site-content-provider'
import { useLanguage } from '@/components/language-provider'

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
 * The long-form copy and the questions, straight from the CMS. Renders nothing
 * when there is nothing published — an empty accordion is worse than no
 * section at all.
 */
export function HouseDetails() {
  const content = useSiteContent()
  const { language } = useLanguage()
  const isEnglish = language === 'en'

  const sections = SECTIONS.map((slug) => content?.pages[slug]).filter((page) => page !== undefined)
  const faqs = content?.faqs ?? []

  if (sections.length === 0 && faqs.length === 0) return null

  return (
    <section
      id="details"
      className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
      aria-labelledby="details-heading"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <div className="mx-auto mb-4 h-px w-12 bg-primary/30" />
          <h2 id="details-heading" className="font-serif text-3xl tracking-tight sm:text-4xl">
            {isEnglish ? 'Everything about the house' : 'Todo sobre la casa'}
          </h2>
          <p className="mt-3 text-muted-foreground">
            {isEnglish
              ? 'The details worth knowing before you book.'
              : 'Los detalles que conviene saber antes de reservar.'}
          </p>
        </div>

        {sections.length > 0 && (
          <Accordion type="single" collapsible className="mt-8">
            {sections.map((page) => (
              <AccordionItem key={page.slug} value={page.slug}>
                <AccordionTrigger className="text-left font-serif text-lg">
                  {page.title}
                </AccordionTrigger>
                <AccordionContent>
                  {/* Stored as plain text: blank lines are paragraph breaks. */}
                  <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
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
        )}

        {faqs.length > 0 && (
          <div className="mt-12">
            <h3 className="font-serif text-2xl">
              {isEnglish ? 'Frequently asked' : 'Preguntas frecuentes'}
            </h3>
            <Accordion type="single" collapsible className="mt-4">
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    </section>
  )
}
