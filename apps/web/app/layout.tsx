import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { SITE_URL } from '@/lib/site-url'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
})

export const metadata: Metadata = {
  // Everything relative below resolves against this. Without it an Open Graph
  // image is a path, and the server rendering a shared link has no page to
  // resolve a path against — so the preview comes out blank.
  metadataBase: new URL(SITE_URL),
  title: 'Areia Bela | Book direct',
  description:
    'Book your stay at Areia Bela. Modern amenities, fast booking, and a professional host experience.',
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
  /**
   * The starfish, in the two versions a tab strip needs.
   *
   * Both are generated from `public/images/favicon.png`, which is a cyan
   * line-art starfish on transparency. Cyan against white is about 1.9:1 —
   * legible on a dark tab strip and all but gone on a light one — so the light
   * variant is recoloured to the site's navy and its glow is cut back, because
   * at 32px a soft halo is not atmosphere, it is blur.
   *
   * The Apple icon carries its own navy background: iOS composites a home
   * screen icon onto a solid tile, and a transparent one lands badly.
   *
   * The `/icon.svg` that used to sit here was the Next.js starter placeholder —
   * a black rounded square. Browsers prefer SVG when offered, so it was the one
   * being shown.
   *
   * This layout is the root, so /admin inherits it: the panel gets the same
   * mark without declaring anything.
   */
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
