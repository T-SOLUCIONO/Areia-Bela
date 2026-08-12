'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, MailCheck, Mail } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { PASSWORD_RESET_TTL_MINUTES } from '@areia-bela/shared'
import { apiFetch, ApiError } from '@/lib/api-client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err) {
      // The API answers 200 whether or not the account exists, so anything here
      // is a transport or rate-limit problem, never "no such account".
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many requests. Wait a minute and try again.'
          : 'Something went wrong. Try again in a moment.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Link
          href="/admin/login"
          className="mb-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary-foreground">
              {sent ? (
                <MailCheck className="h-8 w-8 text-primary" />
              ) : (
                <Mail className="h-8 w-8 text-primary" />
              )}
            </div>
            <CardTitle className="font-serif text-2xl">
              {sent ? 'Check your email' : 'Forgot your password?'}
            </CardTitle>
            <CardDescription>
              {sent
                ? 'If that email has an account, a reset link is on its way.'
                : "Enter your email and we'll send you a link to set a new one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  The link expires in {PASSWORD_RESET_TTL_MINUTES} minutes and can only be used
                  once. If it doesn&apos;t arrive, check your spam folder.
                </p>
                <Button asChild variant="brand" size="lg" className="w-full">
                  <Link href="/admin/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@areiabela.com"
                  />
                </div>

                <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>
                  {busy ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
