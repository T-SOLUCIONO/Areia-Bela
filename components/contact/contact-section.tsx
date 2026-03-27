"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { Mail, MessageCircle, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { propertyData } from "@/lib/property-data";

const contactInfo = {
  phone: "+1 (727) 555-3043",
  email: "host@areiabela.com",
  whatsapp: "17275553043",
};

export function ContactSection() {
  const [sent, setSent] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <section id="contacto" className="py-12 border-b border-border">
      <h2 className="text-[22px] font-semibold text-foreground mb-6">Contacto</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Habla con el anfitrión</h3>
          <div className="flex items-center gap-4 mb-5">
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
              {propertyData.host.pictureUrl ? (
                <Image src={propertyData.host.pictureUrl} alt={propertyData.host.name} fill className="object-cover" />
              ) : (
                <User className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">{propertyData.host.name}</p>
              <p className="text-sm text-foreground/70">Anfitrión desde {propertyData.hostSinceYear}</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-foreground/85">
              <Phone className="h-4 w-4" />
              {contactInfo.phone}
            </p>
            <p className="flex items-center gap-2 text-foreground/85">
              <Mail className="h-4 w-4" />
              {contactInfo.email}
            </p>
          </div>
          <a
            href={`https://wa.me/${contactInfo.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" />
            Contactar por WhatsApp
          </a>
        </div>

        <div className="rounded-2xl border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Envíanos un mensaje</h3>
          <form className="space-y-3" onSubmit={onSubmit}>
            <input
              required
              type="text"
              name="name"
              placeholder="Nombre"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              required
              type="email"
              name="email"
              placeholder="Correo electrónico"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
            <textarea
              required
              name="message"
              placeholder="Escribe tu mensaje"
              rows={4}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" className="h-11 w-full rounded-xl bg-[#E31C5F] font-semibold text-white hover:bg-[#D70466]">
              Enviar mensaje
            </Button>
            {sent ? <p className="text-sm text-emerald-700">Mensaje enviado. Te responderemos pronto.</p> : null}
          </form>
        </div>
      </div>
    </section>
  );
}
