'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, Loader2, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import { propertyData } from '@/lib/property-data'
import { RESPONSE_TIME_CLAUSE } from '@/lib/host-response'
import { useLanguage } from '@/components/language-provider'
import { API_URL } from '@/lib/api-client'
import { HostResponseBadges } from '@/components/public/host-response-badges'
import { translations } from '@/lib/i18n'

const contact = {
  phone: '+1 (727) 555-3043',
  phoneHref: '+17275553043',
  email: 'host@areiabela.com',
  whatsapp: '17275553043',
}

export function ContactSection() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const { language } = useLanguage()
  const copy = translations[language].contact

  /**
   * Sends the message.
   *
   * This used to set "sent" and clear the form without contacting anyone: a
   * guest was told their message had arrived when nothing had been sent and
   * nobody had been told. It now only says so once the API accepted it.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)

    setSending(true)
    setFailed(false)
    try {
      const response = await fetch(`${API_URL}/notifications/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? ''),
          email: String(data.get('email') ?? ''),
          message: String(data.get('message') ?? ''),
        }),
      })
      if (!response.ok) throw new Error(String(response.status))

      setSent(true)
      form.reset()
    } catch {
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      id="contact"
      className="overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
    >
      {/* Host header */}
      <div className="bg-[#f7f2ea] px-6 pb-7 pt-8 sm:px-8">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-4 ring-white">
            <Image
              src={propertyData.host.pictureUrl}
              alt={propertyData.host.name}
              fill
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[#174d7a]/70">
              {copy.title}
            </p>
            <h2 className="truncate font-serif text-2xl text-[#173a57]">
              {propertyData.host.firstName}
            </h2>
            <p className="text-sm text-slate-500">
              {copy.hostSince} {propertyData.hostSinceYear}
            </p>
          </div>
        </div>

        <HostResponseBadges
          isSuperhost={propertyData.host.isSuperhost}
          responseTime={propertyData.hostResponseTime}
          responseRate={propertyData.host.responseRateWithoutNa}
          language={language}
          className="mt-4"
        />
      </div>

      <div className="px-6 py-7 sm:px-8">
        {/* Quick contact row */}
        <div className="grid grid-cols-3 gap-2">
          <a
            href={`tel:${contact.phoneHref}`}
            className="flex flex-col items-center gap-1.5 rounded-[16px] border border-slate-200 py-3 text-center transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Phone className="h-4 w-4 text-[#174d7a]" />
            <span className="text-xs font-medium text-slate-600">{copy.call}</span>
          </a>
          <a
            href={`mailto:${contact.email}`}
            className="flex flex-col items-center gap-1.5 rounded-[16px] border border-slate-200 py-3 text-center transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Mail className="h-4 w-4 text-[#174d7a]" />
            <span className="text-xs font-medium text-slate-600">Email</span>
          </a>
          <a
            href={`https://wa.me/${contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 rounded-[16px] border border-slate-200 py-3 text-center transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <MessageCircle className="h-4 w-4 text-[#174d7a]" />
            <span className="text-xs font-medium text-slate-600">WhatsApp</span>
          </a>
        </div>

        <div className="my-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-100" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {copy.orMessage}
          </span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-[20px] bg-emerald-50 px-6 py-10 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">{copy.sent}</p>
              <p className="mt-1 text-sm text-emerald-700">
                {propertyData.host.firstName}{' '}
                {RESPONSE_TIME_CLAUSE[language][propertyData.hostResponseTime]}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">{copy.name}</Label>
                <Input
                  id="contact-name"
                  name="name"
                  required
                  type="text"
                  placeholder={copy.namePlaceholder}
                  className="h-11 rounded-[12px] border-slate-200 focus-visible:border-[#174d7a] focus-visible:ring-[#174d7a]/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  name="email"
                  required
                  type="email"
                  placeholder={copy.emailPlaceholder}
                  className="h-11 rounded-[12px] border-slate-200 focus-visible:border-[#174d7a] focus-visible:ring-[#174d7a]/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">{copy.message}</Label>
              <Textarea
                id="contact-message"
                name="message"
                required
                rows={4}
                placeholder={copy.messagePlaceholder}
                className="resize-none rounded-[12px] border-slate-200 focus-visible:border-[#174d7a] focus-visible:ring-[#174d7a]/20"
              />
            </div>
            {failed && (
              <p className="rounded-[12px] bg-red-50 px-4 py-3 text-sm text-red-700">
                {copy.sendFailed}
              </p>
            )}

            <Button
              type="submit"
              variant="brand"
              size="lg"
              disabled={sending}
              className="w-full font-semibold"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? copy.sending : copy.send}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
