'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { SiteLogo } from '@/components/public/site-logo'
import { apiFetch, ApiError } from '@/lib/api-client'

interface LoginResponse {
  requiresTotp: boolean
  challengeToken?: string
}

function LoginForm() {
  const searchParams = useSearchParams()
  const destination = searchParams.get('from') ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeToken, setChallengeToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePasswordStep = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (result.requiresTotp && result.challengeToken) {
        setChallengeToken(result.challengeToken)
        return
      }

      // Full navigation, not router.push: the server-side admin layout has to
      // re-run to pick up the new session cookie.
      window.location.assign(destination)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Incorrect email or password.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleTotpStep = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await apiFetch('/auth/login/totp', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code }),
      })
      window.location.assign(destination)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : 'That code is not valid. Try again, or use a recovery code.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const isTotpStep = challengeToken !== null

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to website
        </Link>

        <Card>
          <CardHeader className="text-center">
            {/* The mark on the first step, the key on the second.
                
                A generic office-building glyph stood here, which said nothing
                about whose panel this is — and this is the one screen someone
                sees before there is any other branding on it. The key stays on
                the code step: there it is not decoration, it says which of the
                two things is being asked for.
                
                No circle behind the logo: a mark inside a tinted disc reads as
                an avatar. */}
            {isTotpStep ? (
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <KeyRound className="h-8 w-8 text-primary" />
              </div>
            ) : (
              <SiteLogo className="mx-auto mb-4 h-12 w-auto" />
            )}
            <CardTitle className="font-serif text-2xl">
              {isTotpStep ? 'Two-step verification' : 'Admin portal'}
            </CardTitle>
            <CardDescription>
              {isTotpStep
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Sign in to manage bookings for Areia Bela.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            {isTotpStep ? (
              <form onSubmit={handleTotpStep} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input
                    id="code"
                    name="code"
                    inputMode="text"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="123456"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lost your device? Enter one of your recovery codes instead.
                  </p>
                </div>

                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Verifying...' : 'Verify and sign in'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setChallengeToken(null)
                    setCode('')
                    setError('')
                  }}
                >
                  Start over
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordStep} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-10"
                      placeholder="you@areiabela.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-10"
                      placeholder="Enter your password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="brand"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>

                <p className="text-center text-sm">
                  <Link
                    href="/admin/forgot-password"
                    className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
