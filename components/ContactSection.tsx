"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { Mail, MessageCircle, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { propertyData } from "@/lib/property-data";

const contact = {
  phone: "+1 (727) 555-3043",
  email: "host@areiabela.com",
  whatsapp: "17275553043",
};

export function ContactSection() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
    event.currentTarget.reset();
  };

  return (
    <section className="py-12 border-b border-border">
      <h2 className="mb-6 text-[22px] font-semibold text-foreground">Contacto</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border p-6">
          <h3 className="mb-4 text-lg font-semibold">Información del anfitrión</h3>
          <div className="mb-5 flex items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-muted">
              {propertyData.host.pictureUrl ? (
                <Image src={propertyData.host.pictureUrl} alt={propertyData.host.name} fill className="object-cover" />
              ) : (
                <User className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold">{propertyData.host.name}</p>
              <p className="text-sm text-foreground/70">Anfitrión desde {propertyData.hostSinceYear}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" />{contact.phone}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" />{contact.email}</p>
          </div>
          <a
            href={`https://wa.me/${contact.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-semibold hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        </div>

        <div className="rounded-2xl border border-border p-6">
          <h3 className="mb-4 text-lg font-semibold">Envíanos un mensaje</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input required type="text" placeholder="Nombre" className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <input required type="email" placeholder="Email" className="h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <textarea required rows={4} placeholder="Mensaje" className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <Button type="submit" className="h-11 w-full rounded-xl bg-[#E31C5F] text-white hover:bg-[#D70466]">Enviar mensaje</Button>
            {sent ? <p className="text-sm text-emerald-700">Mensaje enviado. Te responderemos pronto.</p> : null}
          </form>
        </div>
      </div>
    </section>
  );
}
