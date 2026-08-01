'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { guest } from '@/lib/guest-client'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'

/**
 * Spends the emailed link and opens the session.
 *
 * A page rather than a redirect the API performs, because the link must be
 * spent by a POST from the browser that will hold the cookie — following a
 * link is a GET, and a GET that changes state is a link that email scanners
 * and link previews can burn before the guest ever clicks it.
 */
function EnterContent() {
  const params = useSearchParams()
  const router = useRouter()
  const { language } = useLanguage()
  const copy = translations[language].guestArea

  const [failed, setFailed] = useState(false)
  const spent = useRef(false)

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      // Synchronous, but on a mount with nothing else to render — not the
      // cascade the rule is about.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true)
      return
    }
    // Effects run twice in development; spending the token twice would burn a
    // single-use link on the way in.
    if (spent.current) return
    spent.current = true

    void guest.redeem(token).then(
      () => router.replace(`/${language}/my-booking`),
      () => setFailed(true),
    )
  }, [params, router, language])

  if (failed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <AlertCircle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="mb-2 font-serif text-2xl text-foreground">{copy.badLink}</h1>
        <p className="max-w-sm text-muted-foreground">{copy.badLinkLead}</p>
        <Button asChild variant="brand" size="lg" className="mt-8">
          <Link href="/my-booking">{copy.askAgain}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <Loader2 className="mb-5 h-9 w-9 animate-spin text-[#174d7a]" />
      <p className="text-muted-foreground">{copy.checking}</p>
    </div>
  )
}

export default function EnterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-[#174d7a]" />
        </div>
      }
    >
      <EnterContent />
    </Suspense>
  )
}
