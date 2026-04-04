import Image from 'next/image'
import Link from 'next/link'
import { Star, Award, User, Waves, Key, MapPin, Wind, Cat, Calendar, ChevronRight, CheckCircle2, MessageSquare, Map, Tag, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BookingWidget } from '@/components/BookingWidget'
import { ContactSection } from '@/components/ContactSection'
import { ImageGallery } from '@/components/rooms/image-gallery'
import { reviews, propertyInfo } from '@/lib/mock-data'
import { propertyData } from "@/lib/property-data";
import { ChatAssistant } from '@/components/chat/chat-assistant'
export default function HomePage() {
  const galleryImages = propertyData.photos?.map((photo) => photo.large) ?? propertyInfo.images
  return (
    <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-10 mb-12 sm:py-6">
      {/* Listing Header */}
      <div className="mb-6 hidden md:block">
        <h1 className="text-[26px] sm:text-[28px] font-semibold text-foreground mb-2">
          {/* {propertyInfo.name} */}
          Heated Pool & Coffee Bar • 5 minutes to Madeira Beach
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-custom">
          <div className="flex items-center gap-1 font-semibold">
            <Star className="h-4 w-4 fill-foreground" />
            <span>4.9</span>
            <span>·</span>
            <Link href="#reviews" className="underline hover:opacity-80">
              {reviews.length} reviews
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Award className="h-4 w-4" />
            <span>Superhost</span>
          </div>
          <div className="flex items-center gap-1 font-semibold underline hover:opacity-80 cursor-pointer">
            <Link href="#location">
              {propertyInfo.city}, Florida, United States
            </Link>
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="lg:mb-12">
        <ImageGallery images={galleryImages} title={propertyInfo.name} />
      </div>
      <div className='px-[8px]'>
      <h1 className="mb-4 text-[26px] sm:text-[28px] font-semibold text-foreground flex flex-col justify-between items-center text-center ">
          {/* {propertyInfo.name} */}
          Heated Pool & Coffee Bar• 5-min to Madeira Beach
        </h1>
      </div>
      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-14 lg:gap-24 relative">

        {/* Left Column */}
        <div className="w-full">
          {/* Host Info */}
          <div className="pb-6 border-b border-border">


            <div className='text-sm flex flex-col justify-between items-center text-center font-(<inherit>)'>
              <h2 className="text-muted-custom mb-1">
                Alojamiento entero: alojamiento en San Petersburgo, Florida, Estados Unidos
              </h2>
              <p className="text-muted-custom">
                8 huéspedes · 3 dormitorios · 5 camas · 2 baños
              </p>
            </div>
            {/*<div className="h-12 w-12 md:h-14 md:w-14 rounded-full overflow-hidden bg-muted ml-4 flex-shrink-0 relative">

              {propertyData.host.pictureUrl ? (
                <Image src={propertyData.host.pictureUrl} alt={propertyData.host.name} fill className="object-cover" />
              ) : (
                <User className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
              )}
            </div>*/}
          </div>

          {/* Highlights */}
          <div className="py-8 border-b border-border space-y-6">
            <div className="flex gap-4 items-start">
              <Waves className="h-7 w-7 flex-shrink-0 mt-0.5 text-foreground" />
              <div>
                <h3 className="font-semibold text-foreground text-base">Sumérgete</h3>
                <p className="text-muted-custom text-sm">Este es uno de los pocos lugares en la zona con una piscina climatizada privada.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <Key className="h-7 w-7 flex-shrink-0 mt-0.5 text-foreground" />
              <div>
                <h3 className="font-semibold text-foreground text-base">Llegada autónoma</h3>
                <p className="text-muted-custom text-sm">Accede al alojamiento mediante la cerradura inteligente.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <Calendar className="h-7 w-7 flex-shrink-0 mt-0.5 text-foreground" />
              <div>
                <h3 className="font-semibold text-foreground text-base">Cancelación gratuita durante 48 horas</h3>
                <p className="text-muted-custom text-sm">Asegura este gran alojamiento con total tranquilidad.</p>
              </div>
            </div>
          </div>

          {/* Description Content */}
          <div className="py-8 border-b border-border">
            <p className="text-muted-custom leading-relaxed whitespace-pre-wrap">
              {propertyInfo.description}
            </p>
            <Button variant="link" className="px-0 font-semibold underline underline-offset-4 text-muted-custom mt-4 flex items-center">
              Mostrar más <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Amenities Summary */}
          <div className="py-12 border-b border-border">
            <h2 className="text-[22px] font-semibold text-foreground mb-6">Qué ofrece este lugar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
              {propertyInfo.amenities.slice(0, 8).map((amenity, index) => (
                <div key={amenity} className="flex items-center gap-4 text-muted-custom">
                  {/* Pseudo-randomizing icons for visual fidelity */}
                  {index % 4 === 0 && <Waves className="h-6 w-6 text-foreground/80" />}
                  {index % 4 === 1 && <Wind className="h-6 w-6 text-foreground/80" />}
                  {index % 4 === 2 && <Cat className="h-6 w-6 text-foreground/80" />}
                  {index % 4 === 3 && <User className="h-6 w-6 text-foreground/80" />}
                  <span className="text-base">{amenity}</span>
                </div>
              ))}
            </div>
              <Button variant="outline" className="mt-8 px-6 py-6 font-semibold rounded-xl text-base w-full sm:w-auto h-auto border-border text-muted-custom hover:bg-muted">
              Mostrar los {propertyInfo.amenities.length} servicios
            </Button>
          </div>
        </div>

        {/* Right Column: Sticky Booking Widget (Desktop) */}
        <div className="hidden lg:block relative">
          <div className="sticky top-28 z-10 w-[380px]">
            <div className="bg-background border border-border rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.12)] p-6">
              <BookingWidget className="border-0 p-0 shadow-none" />
            </div>

            <div className="mt-6 p-4 border border-border rounded-xl flex items-start gap-4">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Este es un alojamiento muy popular.</p>
              <p className="text-sm text-muted-custom">Se ha reservado 50 veces en la última semana.</p>
            </div>
            </div>
          </div>
        </div>

      </div>

      {/* Reviews Section */}
      <section id="reviews" className="py-12 border-b border-border">
        {/* Guest Favorite Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="flex items-center justify-center gap-4 sm:gap-8 mb-4 relative">
            <div className="relative h-[120px] w-[80px] sm:h-[160px] sm:w-[100px]">
              <Image
                src="/images/left.avif"
                alt="Decoración izquierda"
                fill
                className="object-contain"
              />
            </div>
            <div className="text-[70px] sm:text-[100px] leading-none font-bold text-foreground pt-4">4.91</div>
            <div className="relative h-[120px] w-[80px] sm:h-[160px] sm:w-[100px]">
              <Image
                src="/images/right.avif"
                alt="Decoración derecha"
                fill
                className="object-contain"
              />
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="text-[22px] font-semibold text-foreground mb-2">Favorito entre huéspedes</h2>
            <p className="text-muted-custom leading-relaxed text-base mb-2">
              Este alojamiento es uno de los favoritos en Areia Bela, según las valoraciones, evaluaciones y confiabilidad entre los viajeros
            </p>
            <Button variant="link" className="px-0 font-semibold underline underline-offset-4 text-muted-custom text-sm">
              Cómo funcionan las evaluaciones
            </Button>
          </div>

          {/* Ratings Breakdown */}
          <div className="w-full mt-12 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-8 border-t border-border pt-12 pb-4">
            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Calificación general</span>
              <div className="flex flex-col gap-1 w-full mt-2">
                {[5, 4, 3, 2, 1].map((n) => (
                  <div key={n} className="flex items-center gap-2 w-full">
                    <span className="text-[10px] w-2">{n}</span>
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full bg-foreground ${n === 5 ? 'w-[90%]' : n === 4 ? 'w-[10%]' : 'w-0'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Limpieza</span>
              <span className="text-lg font-semibold mb-3">4.9</span>
              <Sparkles className="h-6 w-6 text-foreground/60 mt-auto" />
            </div>

            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Veracidad</span>
              <span className="text-lg font-semibold mb-3">5.0</span>
              <CheckCircle2 className="h-6 w-6 text-foreground/60 mt-auto" />
            </div>

            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Llegada</span>
              <span className="text-lg font-semibold mb-3">5.0</span>
              <Key className="h-6 w-6 text-foreground/60 mt-auto" />
            </div>

            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Comunicación</span>
              <span className="text-lg font-semibold mb-3">5.0</span>
              <MessageSquare className="h-6 w-6 text-foreground/60 mt-auto" />
            </div>

            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Ubicación</span>
              <span className="text-lg font-semibold mb-3">5.0</span>
              <Map className="h-6 w-6 text-foreground/60 mt-auto" />
            </div>

            <div className="flex flex-col items-start text-left border-r border-border pr-4 last:border-0">
              <span className="text-xs font-semibold text-foreground mb-1">Calidad-precio</span>
              <span className="text-lg font-semibold mb-3">4.9</span>
              <Tag className="h-6 w-6 text-foreground/60 mt-auto" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
          {reviews.map((review) => (
            <div key={review.id} className="w-full">
              <div className="flex items-center gap-4 mb-4">
                {review.guestAvatar ? (
                  <Image
                    src={review.guestAvatar}
                    alt={review.guestName}
                    width={48}
                    height={48}
                    className="rounded-full object-cover bg-muted"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-foreground text-base">{review.guestName}</h3>
                  <div className="text-sm text-muted-custom flex items-center gap-1">
                    <span>{review.rating >= 4 ? `${review.rating} años en Airbnb` : 'Se unió en 2024'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-custom mb-2">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-2.5 w-2.5 ${i < review.rating
                        ? 'fill-foreground text-foreground'
                        : 'fill-muted text-muted'
                        }`}
                    />
                  ))}
                </div>
                <span className="text-muted-custom/70">·</span>
                <span className="font-semibold text-muted-custom">{review.rating >= 4.5 ? 'Hace 2 semanas' : 'Hace 1 mes'}</span>
                <span className="text-muted-custom/70">·</span>
                <span className="text-muted-custom">Se quedó unas noches</span>
              </div>

              <p className="text-muted-custom leading-relaxed mb-3 line-clamp-4">
                {review.comment}
              </p>
              <Button variant="link" className="px-0 h-auto font-semibold text-muted-custom underline underline-offset-4 hover:opacity-80 transition-opacity">
                Mostrar más
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" className="mt-8 px-6 py-6 font-semibold rounded-xl text-base h-auto border-foreground hover:bg-muted">
          Mostrar las {reviews.length} reseñas
        </Button>
      </section>

      {/* Location Section */}
      <section id="location" className="py-12 border-b border-border">
        <div className="mb-6">
          <h2 className="font-serif text-[26px] font-semibold text-foreground">
            Dónde vas a estar
          </h2>
          <p className="text-muted-custom mt-1">St. Petersburg, Florida, Estados Unidos</p>
        </div>

        <div className="group relative w-full h-[350px] md:h-[500px] rounded-3xl overflow-hidden shadow-sm mb-8">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3528.27419102434!2d-82.78821252441964!3d27.816251620242203!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88c2fd15ebc9ec1f%3A0xea5d3d7f3368a9aa!2sAreia%20Bela!5e0!3m2!1sen!2sus!4v1710128828956!5m2!1sen!2sus"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Areia Bela Exact Location Map"
            className="transition-transform duration-700 group-hover:scale-[1.02]"
          ></iframe>
        </div>

        <div className="flex flex-col md:flex-row gap-8 justify-between">
          <div className="max-w-2xl">
            <h3 className="font-semibold text-foreground mb-3 text-lg">
              Areia Bela, Madeira Beach, Florida
            </h3>
            <p className="text-muted-custom leading-relaxed text-base">
              La propiedad está idealmente situada a solo 5 minutos a pie de las impresionantes arenas blancas de Madeira Beach.
              Estarás cerca de tiendas locales, restaurantes frente al mar y el famoso John's Pass Village & Boardwalk.
            </p>
            <div className="mt-4">
              <Button variant="link" className="px-0 h-auto font-semibold text-muted-custom underline underline-offset-4 hover:opacity-80 transition-opacity flex items-center" asChild>
                <a href="https://www.google.com/maps/place/Areia+Bela/@27.8162469,-82.7856376,17z/data=!3m1!4b1!4m6!3m5!1s0x88c2fd15ebc9ec1f:0xea5d3d7f3368a9aa!8m2!3d27.8162469!4d-82.7856376!16s%2Fg%2F11ysmwhml3!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MDMwOC4wIKXMDSoASAFQAw%3D%3D" target="_blank" rel="noopener noreferrer">
                  Mostrar más <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </Button>
            </div>
          </div>

          <div className="w-full md:w-[300px] bg-muted/30 p-6 rounded-2xl flex-shrink-0">
            <h4 className="font-semibold text-foreground mb-4">Lugares destacados</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm text-muted-custom">
                <Waves className="h-5 w-5 text-primary" />
                <span>5 min de Madeira Beach</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-custom">
                <MapPin className="h-5 w-5 text-primary" />
                <span>John's Pass Village</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-custom">
                <Star className="h-5 w-5 text-primary" />
                <span>Restaurantes frente al mar</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <ContactSection />

      <ChatAssistant />

      {/* Mobile Sticky Booking Footer
      <div className="lg:hidden sticky bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4 flex justify-between items-center z-40">
        <div className="flex flex-col">
          <div className="font-semibold text-muted-custom text-lg leading-tight">
             $150 <span className="text-base font-normal text-muted-custom">noche</span>
          </div>
          <p className="text-sm text-muted-custom underline font-medium mt-0.5">12 – 17 oct</p>
        </div>
        <Button className="w-auto px-10 rounded-lg font-semibold text-base py-6 bg-[#E31C5F] hover:bg-[#D70466] text-white h-auto">
          Reservar
        </Button>
      </div> */}

    </div>
  )
}
