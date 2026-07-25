'use client'

import { FormEvent, useState } from 'react'
import Image from 'next/image'
import { Mail, MessageCircle, Phone, User, Send } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Textarea } from '@areia-bela/ui/textarea'
import { propertyData } from '@/lib/property-data'
import { useLanguage } from '@/components/language-provider'

const contact = {
  phone: '+1 (727) 555-3043',
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
    <section
      id="contact"
      className="rounded-[32px] border border-border/70 bg-card/80 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8"
    >
      <div className="mb-6 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {isEnglish ? 'Contact' : 'Contacto'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isEnglish
            ? 'We answer questions about availability, access, pets, and amenities before you book.'
            : 'Resolvemos dudas de disponibilidad, accesos, mascotas y servicios antes de reservar.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-border/70 bg-background p-6">
          <h3 className="text-lg font-semibold text-foreground">
            {isEnglish ? 'Host info' : 'Información del anfitrión'}
          </h3>
          <div className="mt-5 flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
              {propertyData.host.pictureUrl ? (
                <Image
                  src={propertyData.host.pictureUrl}
                  alt={propertyData.host.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <User className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">{propertyData.host.name}</p>
              <p className="text-sm text-muted-foreground">
                {isEnglish ? 'Host since' : 'Anfitrión desde'} {propertyData.hostSinceYear}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{contact.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>{contact.email}</span>
            </div>
          </div>

          <a
            href={`https://wa.me/${contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>

        <div className="rounded-[28px] border border-border/70 bg-background p-6">
          <h3 className="text-lg font-semibold text-foreground">
            {isEnglish ? 'Send us a message' : 'Envíanos un mensaje'}
          </h3>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">{isEnglish ? 'Name' : 'Nombre'}</Label>
              <Input
                id="contact-name"
                required
                type="text"
                placeholder={isEnglish ? 'Your name' : 'Tu nombre'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                required
                type="email"
                placeholder={isEnglish ? 'you@email.com' : 'tu@email.com'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">{isEnglish ? 'Message' : 'Mensaje'}</Label>
              <Textarea
                id="contact-message"
                required
                rows={5}
                placeholder={
                  isEnglish ? 'Tell us your dates or questions' : 'Cuéntanos tus fechas o dudas'
                }
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Send className="h-4 w-4" />
              {isEnglish ? 'Send message' : 'Enviar mensaje'}
            </Button>
            <p aria-live="polite" className="text-sm text-success">
              {sent
                ? isEnglish
                  ? 'Message sent. We will reply soon.'
                  : 'Mensaje enviado. Te responderemos pronto.'
                : ''}
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}
