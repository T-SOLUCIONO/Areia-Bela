import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'
import { propertyInfo } from '@/lib/mock-data'

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#ebebeb]">
      <div className="px-6 md:px-12 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          {/* Brand & Contact */}
          <div className="flex flex-col gap-4">
          <div className="flex flex-col">
            <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Areia Bela
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Vacation Rental
            </span>
          </div>
            <div className="flex flex-col gap-1.5 text-sm text-[#717171]">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                <span>{propertyInfo.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" />
                <span>{propertyInfo.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                <span>{propertyInfo.email}</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <Link href="/checkout" className="text-[#717171] hover:text-[#222222] transition-colors">Reserve</Link>
            <Link href="/checkout" className="text-[#717171] hover:text-[#222222] transition-colors">Contact</Link>
            <Link href="#" className="text-[#717171] hover:text-[#222222] transition-colors">Privacy</Link>
            <Link href="#" className="text-[#717171] hover:text-[#222222] transition-colors">Terms</Link>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-6 pt-6 border-t border-[#ebebeb] flex justify-center">
          <p className="text-xs text-[#717171]">
            &copy; {new Date().getFullYear()} Areia Bela. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
