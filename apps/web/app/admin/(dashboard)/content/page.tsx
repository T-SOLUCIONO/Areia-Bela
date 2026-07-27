'use client'

import { FileText, HelpCircle, Images } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import { PagesEditor } from '@/components/admin/content/pages-editor'
import { FaqsManager } from '@/components/admin/content/faqs-manager'
import { GalleryManager } from '@/components/admin/content/gallery-manager'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * The guest site's own content, editable without touching code. Everything
 * here is bilingual by construction: there is no way to save a Spanish string
 * without an English one beside it, because half a translation shipping to
 * production is the failure mode this screen exists to prevent.
 */
export default function ContentPage() {
  const t = useAdminCopy()

  return (
    <Tabs defaultValue="pages" className="space-y-6">
      <TabsList>
        <TabsTrigger value="pages" className="gap-1.5">
          <FileText className="h-4 w-4" aria-hidden />
          {t.content.pages}
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

      <TabsContent value="pages">
        <PagesEditor />
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
