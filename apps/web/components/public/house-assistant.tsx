'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Phone, Send, X } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { API_URL } from '@/lib/api-client'
import { useLanguage } from '@/components/language-provider'
import { translations } from '@/lib/i18n'

interface Turn {
  role: 'user' | 'assistant'
  content: string
}

interface Answer {
  answer: string
  handoff: boolean
  contact: { whatsapp: string | null; phone: string | null }
}

/** Matches the API's cap, so the browser refuses before the server has to. */
const MAX_QUESTION = 500

/**
 * Answers guests' questions about the house, and knows when to stop.
 *
 * The interesting part of this component is not the chat: it is what happens
 * when the assistant does not know. Rather than a polite dead end, the guest gets
 * the two channels the host actually reads — WhatsApp and a text message — built
 * from the numbers in the panel. A question that cannot be answered still ends
 * somewhere useful.
 *
 * Renders nothing at all when the API reports no assistant configured. A chat
 * that only apologises is worse than no chat, and it would apologise in the voice
 * of the house.
 */
export function HouseAssistant() {
  const { language } = useLanguage()
  const copy = translations[language].assistant

  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [asking, setAsking] = useState(false)
  const [contact, setContact] = useState<Answer['contact']>({ whatsapp: null, phone: null })
  const [handoff, setHandoff] = useState(false)
  const [failed, setFailed] = useState(false)

  const endOfLog = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Asked once, and a failure means "do not offer it": the guest cannot fix a
    // missing API key, and a chat that cannot answer is not worth a button.
    fetch(`${API_URL}/assistant/status`)
      .then((r) => r.json())
      .then((s: { available: boolean }) => setAvailable(s.available))
      .catch(() => setAvailable(false))
  }, [])

  useEffect(() => {
    endOfLog.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, asking])

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!available) return null

  const ask = async () => {
    const asked = question.trim()
    if (!asked || asking) return

    setQuestion('')
    setFailed(false)
    setHandoff(false)
    // The question appears immediately: the guest should never wonder whether it
    // was sent while the answer is on its way.
    const history = turns
    setTurns([...history, { role: 'user', content: asked }])
    setAsking(true)

    try {
      const response = await fetch(`${API_URL}/assistant/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: asked, locale: language, history }),
      })
      if (!response.ok) throw new Error(String(response.status))

      const data = (await response.json()) as Answer
      setContact(data.contact)
      setHandoff(data.handoff)
      if (data.answer) setTurns((prev) => [...prev, { role: 'assistant', content: data.answer }])
      else setFailed(!data.contact.whatsapp && !data.contact.phone)
    } catch {
      setFailed(true)
    } finally {
      setAsking(false)
    }
  }

  const wa = contact.whatsapp?.replace(/\D/g, '')
  const sms = contact.phone?.replace(/[^\d+]/g, '')

  return (
    <>
      {!open && (
        <Button
          variant="brand"
          size="lg"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 min-h-12 gap-2 rounded-full px-5 shadow-lg"
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {copy.launch}
        </Button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={copy.title}
          className="fixed bottom-5 right-5 z-40 flex max-h-[min(32rem,calc(100vh-2.5rem))] w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:w-96"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border bg-secondary px-4 py-3">
            <div>
              <p className="font-serif text-base text-foreground">{copy.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={copy.close}
              className="-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.length === 0 && (
              <p className="text-sm text-muted-foreground">{copy.disclaimer}</p>
            )}
            {turns.map((turn, index) => (
              <div
                key={index}
                className={
                  turn.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground'
                    : 'mr-auto max-w-[90%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-foreground'
                }
              >
                {turn.content}
              </div>
            ))}

            {asking && <p className="text-sm text-muted-foreground">{copy.thinking}</p>}
            {failed && <p className="text-sm text-muted-foreground">{copy.failed}</p>}

            {/* The point of the whole component: not knowing is not a dead end. */}
            {handoff && (wa || sms) && (
              <div className="space-y-2 rounded-xl border border-border bg-secondary p-3">
                <p className="text-xs text-muted-foreground">{copy.handoffLead}</p>
                <div className="flex flex-wrap gap-2">
                  {wa && (
                    <Button asChild variant="brand" size="sm" className="min-h-11 gap-2">
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        {copy.whatsapp}
                      </a>
                    </Button>
                  )}
                  {sms && (
                    <Button asChild variant="outline" size="sm" className="min-h-11 gap-2">
                      <a href={`sms:${sms}`}>
                        <Phone className="h-4 w-4" aria-hidden />
                        {copy.sms}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div ref={endOfLog} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void ask()
            }}
            className="flex items-center gap-2 border-t border-border px-3 py-3"
          >
            <input
              ref={field}
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, MAX_QUESTION))}
              placeholder={copy.placeholder}
              aria-label={copy.title}
              className="min-h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <Button
              type="submit"
              variant="brand"
              size="icon"
              disabled={asking || !question.trim()}
              aria-label={copy.send}
              className="h-11 w-11 shrink-0 rounded-full"
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
