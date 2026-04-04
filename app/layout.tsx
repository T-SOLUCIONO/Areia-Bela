import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-inter',
});

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: '--font-playfair',
});

export const metadata: Metadata = {
  title: 'Areia Bela | Book direct',
  description: 'Book your stay at Areia Bela. Modern amenities, fast booking, and a professional host experience.',
  keywords: ['vacation rental', 'booking', 'stays', 'property', 'hospitality', 'pms'],
  openGraph: {
    title: 'Areia Bela | Book direct',
    description: 'Book your stay at Areia Bela with a modern booking experience.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Areia Bela',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Areia Bela | Book direct',
    description: 'Book your stay at Areia Bela with a modern booking experience.',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
