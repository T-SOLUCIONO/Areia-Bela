'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Message = {
  id: string
  from: 'bot' | 'user'
  text: string
}

const AUTO_REPLIES: Array<{ keywords: RegExp; reply: string }> = [
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
    reply: '¡Sí! Aceptamos mascotas y tenemos amenidades pensadas para ellas. Solo recuerda incluirlas en tu reserva.',
  },
  {
    keywords: /(check-in|check out|llegada)/i,
    reply: 'El check-in es a partir de las 4:00 PM y el check-out a las 10:00 AM. Podemos coordinar horarios especiales según disponibilidad.',
  },
  {
    keywords: /(piscina|pool|amenidades|amenities)/i,
    reply:
      'Contamos con piscina climatizada privada, coffee bar, juegos y equipo de playa. ¿Te gustaría que te detalle algo en específico?',
  },
]

const getAutoReply = (message: string) => {
  const match = AUTO_REPLIES.find((item) => item.keywords.test(message))
  if (match) return match.reply
  return 'Gracias por tu mensaje. En breve uno de nuestros anfitriones te dará una respuesta más detallada.'
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      from: 'bot',
      text: 'Hola 👋 ¿Tienes alguna duda? Estoy aquí para ayudarte con tu estancia.',
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
          text: getAutoReply(text),
        },
      ])
    }, 600)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <div className="flex flex-col items-end gap-3">
          {isVisible && (
            <div className="bg-white text-sm shadow-lg rounded-2xl px-4 py-3 max-w-[220px] text-foreground">
              ¿Necesitas ayuda? Haz clic para chatear con nosotros.
            </div>
          )}
          <Button
            onClick={() => {
              setIsOpen(true)
              setIsVisible(false)
            }}
            className="rounded-full h-12 w-12 shadow-lg"
            aria-label="Abrir chat de ayuda"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
      )}

      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-[320px] sm:w-[360px] overflow-hidden border border-border animate-in fade-in zoom-in">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Asistente Areia Bela</p>
              <p className="text-xs text-muted-foreground">Respuestas automáticas</p>
            </div>
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto bg-muted/20">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.from === 'user'
                    ? 'text-sm text-white bg-primary px-3 py-2 rounded-2xl rounded-br-sm self-end max-w-[80%] ml-auto'
                    : 'text-sm text-foreground bg-white px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm max-w-[85%]'
                }
              >
                {message.text}
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="p-4 border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="icon" className="shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
