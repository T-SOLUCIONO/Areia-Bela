'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, Phone, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'

const navigation = [
  { name: 'Amenities', href: '/about#amenities' },
  { name: 'Offers', href: '/offers' },
  { name: 'Reviews', href: '/reviews' },
  { name: 'About', href: '/about' },
  { name: 'Contact', href: '/contact' },
]

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex h-16 items-center justify-between px-4 md:px-40">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Areia Bela
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Vacation Rental
            </span>
          </div>
        </Link>

        {/* Desktop Navigation 
        <nav className="hidden md:flex items-center gap-8">
          {/* {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="tel:+15551234567"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Phone className="h-4 w-4" />
            <span>+1 (555) 123-4567</span>
          </Link>
          <Link href="/admin">
            <Button variant="ghost" size="sm">
            {/* <User className="h-4 w-4 mr-2" /> 
              Admin*/} 
            </Button>
          </Link>
          <Link href="/rooms/1489399156507737323">
            <Button size="sm">
              Book Now
            </Button>
          </Link>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="overflow-y-auto">
            <SheetHeader className="pt-8">
              <SheetTitle className="font-serif text-xl font-semibold tracking-tight">
                Areia Bela
              </SheetTitle>
              <SheetDescription className="text-[10px] uppercase tracking-[0.2em]">
                Vacation Rental
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-6 pb-6 px-4">
              <nav className="flex flex-col gap-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>

              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
                <Link
                  href="tel:+15551234567"
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <Phone className="h-4 w-4" />
                  <span>+1 (555) 123-4567</span>
                </Link>
                <Link href="/admin" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" className="w-full">
                    <User className="h-4 w-4 mr-2" />
                    Admin Portal
                  </Button>
                </Link>
                <Link href="/rooms/1489399156507737323" onClick={() => setIsOpen(false)}>
                  <Button className="w-full">
                    Book Now
                  </Button>
                </Link>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
