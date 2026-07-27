'use client'

import Link from 'next/link'
import { CalendarPlus, Users } from 'lucide-react'
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
 * Genuinely empty rather than "under construction": guests will appear here
 * once bookings exist, and the booking API lands in Fase 6. An empty state
 * that says what will fill it is more useful than a placeholder box.
 */
export default function GuestsPage() {
  const { language } = useAdminLanguage()
  const isEnglish = language === 'en'

  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyTitle>{isEnglish ? 'No guests yet' : 'Todavía no hay huéspedes'}</EmptyTitle>
        <EmptyDescription>
          {isEnglish
            ? 'Anyone who books the house will show up here, with their stays and contact details.'
            : 'Quien reserve la casa aparecerá aquí, con sus estadías y datos de contacto.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/admin/calendar">
            <CalendarPlus className="h-4 w-4" />
            {isEnglish ? 'Open the calendar' : 'Abrir el calendario'}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
