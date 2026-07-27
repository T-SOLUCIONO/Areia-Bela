'use client'

import Link from 'next/link'
import { CalendarDays, ClipboardList } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@areia-bela/ui/empty'
import { useAdminLanguage } from '@/components/admin/admin-language-provider'

/**
 * The booking API (create, hold, confirm) is Fase 6 work, so there is nothing
 * real to list yet. Says so plainly instead of showing invented rows.
 */
export default function ReservationsPage() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'

  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ClipboardList />
        </EmptyMedia>
        <EmptyTitle>{isEnglish ? 'No reservations yet' : 'Todavía no hay reservas'}</EmptyTitle>
        <EmptyDescription>
          {isEnglish
            ? 'Bookings made on the website will land here, where you can confirm or cancel them.'
            : 'Las reservas hechas en el sitio llegarán aquí, y podrás confirmarlas o cancelarlas.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/admin/calendar">
            <CalendarDays className="h-4 w-4" />
            {isEnglish ? 'See availability' : 'Ver disponibilidad'}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
