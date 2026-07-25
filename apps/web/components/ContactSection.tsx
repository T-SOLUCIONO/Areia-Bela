'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { Mail, MessageCircle, Phone, Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import { propertyData } from '@/lib/property-data'
import { RESPONSE_TIME_CLAUSE } from '@/lib/host-response'
import { useLanguage } from '@/components/language-provider'
import { HostResponseBadges } from '@/components/public/host-response-badges'

const contact = {
  phone: '+1 (727) 555-3043',
  phoneHref: '+17275553043',
  email: 'host@areiabela.com',
  whatsapp: '17275553043',
}

export function ContactSection() {
  const [sent, setSent] = useState(false)
  const { language } = useLanguage()
  const isEnglish = language === 'en'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSent(true)
    event.currentTarget.reset()
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
              {isEnglish ? 'Message the host' : 'Escribe a tu anfitriona'}
            </p>
            <h2 className="truncate font-serif text-2xl text-[#173a57]">
              {propertyData.host.firstName}
            </h2>
            <p className="text-sm text-slate-500">
              {isEnglish ? 'Host since' : 'Anfitriona desde'} {propertyData.hostSinceYear}
            </p>
          </div>
        </div>

        <HostResponseBadges
          isSuperhost={propertyData.host.isSuperhost}
          responseTime={propertyData.hostResponseTime}
          responseRate={propertyData.host.responseRateWithoutNa}
          isEnglish={isEnglish}
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
            <span className="text-xs font-medium text-slate-600">
              {isEnglish ? 'Call' : 'Llamar'}
            </span>
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
            {isEnglish ? 'or send a message' : 'o envía un mensaje'}
          </span>
          <span className="h-px flex-1 bg-slate-100" />
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 rounded-[20px] bg-emerald-50 px-6 py-10 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">
                {isEnglish ? 'Message sent' : 'Mensaje enviado'}
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                {propertyData.host.firstName}{' '}
                {RESPONSE_TIME_CLAUSE[isEnglish ? 'en' : 'es'][propertyData.hostResponseTime]}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">{isEnglish ? 'Name' : 'Nombre'}</Label>
                <Input
                  id="contact-name"
                  required
                  type="text"
                  placeholder={isEnglish ? 'Your name' : 'Tu nombre'}
                  className="h-11 rounded-[12px] border-slate-200 focus-visible:border-[#174d7a] focus-visible:ring-[#174d7a]/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  required
                  type="email"
                  placeholder={isEnglish ? 'you@email.com' : 'tu@email.com'}
                  className="h-11 rounded-[12px] border-slate-200 focus-visible:border-[#174d7a] focus-visible:ring-[#174d7a]/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">{isEnglish ? 'Message' : 'Mensaje'}</Label>
              <Textarea
                id="contact-message"
                required
                rows={4}
                placeholder={
                  isEnglish ? 'Tell us your dates or questions' : 'Cuéntanos tus fechas o dudas'
                }
                className="resize-none rounded-[12px] border-slate-200 focus-visible:border-[#174d7a] focus-visible:ring-[#174d7a]/20"
              />
            </div>
            <Button type="submit" variant="brand" size="lg" className="w-full font-semibold">
              <Send className="h-4 w-4" />
              {isEnglish ? 'Send message' : 'Enviar mensaje'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
