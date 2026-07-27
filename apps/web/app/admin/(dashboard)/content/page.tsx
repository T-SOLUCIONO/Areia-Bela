'use client'

import { FileText, HelpCircle, Home, Images, MessageSquareQuote } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import { PagesEditor } from '@/components/admin/content/pages-editor'
import { FaqsManager } from '@/components/admin/content/faqs-manager'
import { GalleryManager } from '@/components/admin/content/gallery-manager'
import { LandingEditor } from '@/components/admin/content/landing-editor'
import { ReviewsEditor } from '@/components/admin/content/reviews-editor'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * The guest site's own content, editable without touching code. Everything
 * here is bilingual by construction: there is no way to save a Spanish string
 * without an English one beside it, because half a translation shipping to
 * production is the failure mode this screen exists to prevent. The translate
 * button proposes the missing side; a person still has to read it.
 */
export default function ContentPage() {
  const t = useAdminCopy()

  return (
    <Tabs defaultValue="landing" className="space-y-6">
      <TabsList>
        <TabsTrigger value="landing" className="gap-1.5">
          <Home className="h-4 w-4" aria-hidden />
          {t.content.landing}
        </TabsTrigger>
        <TabsTrigger value="pages" className="gap-1.5">
          <FileText className="h-4 w-4" aria-hidden />
          {t.content.pages}
        </TabsTrigger>
        <TabsTrigger value="reviews" className="gap-1.5">
          <MessageSquareQuote className="h-4 w-4" aria-hidden />
          {t.content.reviews}
        </TabsTrigger>
        <TabsTrigger value="faqs" className="gap-1.5">
          <HelpCircle className="h-4 w-4" aria-hidden />
          {t.content.faqs}
        </TabsTrigger>
        <TabsTrigger value="gallery" className="gap-1.5">
          <Images className="h-4 w-4" aria-hidden />
          {t.content.gallery}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="landing">
        <LandingEditor />
      </TabsContent>
      <TabsContent value="pages">
        <PagesEditor />
      </TabsContent>
      <TabsContent value="reviews">
        <ReviewsEditor />
      </TabsContent>
      <TabsContent value="faqs">
        <FaqsManager />
      </TabsContent>
      <TabsContent value="gallery">
        <GalleryManager />
      </TabsContent>
    </Tabs>
  )
}
