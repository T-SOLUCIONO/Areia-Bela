'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { useLanguage } from '@/components/language-provider'
import { translations, type Language } from '@/lib/i18n'

type Message = {
  id: string
  from: 'bot' | 'user'
  text: string
}

const AUTO_REPLIES = {
  en: [
    {
      keywords: /(reserva|booking|disponible|availability)/i,
      reply:
        'You can start your booking from the main widget. If you need help with specific dates, tell me your preferred range.',
    },
    {
      keywords: /(precio|cost|tarifa)/i,
      reply:
        'Rates change based on season and guest count. Share your dates and I can guide you with an estimated price.',
    },
    {
      keywords: /(mascota|pet)/i,
      reply:
        'Yes! We welcome pets and have amenities for them. Just remember to include them in your booking.',
    },
    {
      keywords: /(check-in|check out|llegada)/i,
      reply:
        'Check-in starts at 4:00 PM and check-out is at 10:00 AM. Special timings can be arranged depending on availability.',
    },
    {
      keywords: /(piscina|pool|amenidades|amenities)/i,
      reply:
        'We offer a private heated pool, coffee bar, games, and beach gear. Want details on something specific?',
    },
  ],
  es: [
    {
      keywords: /(reserva|booking|disponible|availability)/i,
      reply:
        'Puedes iniciar tu reserva desde el widget principal. Si necesitas ayuda con fechas específicas dime desde cuándo hasta cuándo te interesa.',
    },
    {
      keywords: /(precio|cost|tarifa)/i,
      reply:
        'Las tarifas cambian según temporada y número de huéspedes. Indícame tus fechas y te orientaré con la tarifa aproximada.',
    },
    {
      keywords: /(mascota|pet)/i,
      reply:
        '¡Sí! Aceptamos mascotas y tenemos amenidades pensadas para ellas. Solo recuerda incluirlas en tu reserva.',
    },
    {
      keywords: /(check-in|check out|llegada)/i,
      reply:
        'El check-in es a partir de las 4:00 PM y el check-out a las 10:00 AM. Podemos coordinar horarios especiales según disponibilidad.',
    },
    {
      keywords: /(piscina|pool|amenidades|amenities)/i,
      reply:
        'Contamos con piscina climatizada privada, coffee bar, juegos y equipo de playa. ¿Te gustaría que te detalle algo en específico?',
    },
  ],
} as const

/**
 * The catch-all, in every language the site speaks. The scripted answers above
 * only exist in English and Spanish, and their keywords wouldn't match French
 * or German text anyway — so a visitor in one of the other three lands here,
 * which is the honest outcome: a real host will answer.
 */
const HANDOFF: Record<Language, string> = {
  en: 'Thanks for your message. One of our hosts will reply with more detail soon.',
  es: 'Gracias por tu mensaje. En breve uno de nuestros anfitriones te dará una respuesta más detallada.',
  pt: 'Obrigado pela sua mensagem. Em breve um de nossos anfitriões responderá com mais detalhes.',
  fr: "Merci pour votre message. L'un de nos hôtes vous répondra bientôt plus en détail.",
  de: 'Danke für Ihre Nachricht. Einer unserer Gastgeber meldet sich in Kürze ausführlicher.',
}

const getAutoReply = (message: string, language: Language) => {
  const scripted = language === 'en' || language === 'es' ? AUTO_REPLIES[language] : []
  return scripted.find((item) => item.keywords.test(message))?.reply ?? HANDOFF[language]
}

export function ChatAssistant() {
  const { language } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      from: 'bot',
      text:
        language === 'en'
          ? 'Hi 👋 Have a question? I am here to help with your stay.'
          : 'Hola 👋 ¿Tienes alguna duda? Estoy aquí para ayudarte con tu estancia.',
    },
  ])

  const inactivityTimer = useRef<NodeJS.Timeout | null>(null)

  const resetTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(() => {
      setIsVisible(true)
    }, 5000)
  }

  useEffect(() => {
    const events = ['mousemove', 'scroll', 'keydown', 'touchstart'] as const
    const handleActivity = () => {
      if (!isOpen) setIsVisible(false)
      resetTimer()
    }
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }))
    resetTimer()
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      events.forEach((event) => window.removeEventListener(event, handleActivity))
    }
  }, [isOpen])

  useEffect(() => {
    setMessages((prev) => {
      const welcome = prev[0]
      if (!welcome) return prev
      return [
        {
          ...welcome,
          text:
            language === 'en'
              ? 'Hi 👋 Have a question? I am here to help with your stay.'
              : 'Hola 👋 ¿Tienes alguna duda? Estoy aquí para ayudarte con tu estancia.',
        },
        ...prev.slice(1),
      ]
    })
  }, [language])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!input.trim()) return
    const text = input.trim()
    const userMessage: Message = { id: crypto.randomUUID(), from: 'user', text }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          from: 'bot',
          text: getAutoReply(text, language),
        },
      ])
    }, 600)
  }

  const ui = translations[language].ui
  const assistantTitle = ui.chatTitle
  const assistantSubtitle = ui.chatSubtitle
  const placeholder = ui.chatPlaceholder

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <div className="flex flex-col items-end gap-3">
          {isVisible && (
            <div className="max-w-[220px] rounded-2xl bg-white px-4 py-3 text-sm text-foreground shadow-lg">
              {language === 'en'
                ? 'Need help? Click to chat with us.'
                : '¿Necesitas ayuda? Haz clic para chatear con nosotros.'}
            </div>
          )}
          <Button
            onClick={() => {
              setIsOpen(true)
              setIsVisible(false)
            }}
            className="h-12 w-12 rounded-full shadow-lg"
            aria-label={ui.chatOpen}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        </div>
      )}

      {isOpen && (
        <div className="w-[320px] overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-in fade-in zoom-in sm:w-[360px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{assistantTitle}</p>
              <p className="text-xs text-muted-foreground">{assistantSubtitle}</p>
            </div>
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="max-h-[280px] space-y-3 overflow-y-auto bg-muted/20 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.from === 'user'
                    ? 'ml-auto max-w-[80%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-white'
                    : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-sm text-foreground shadow-sm'
                }
              >
                {message.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
