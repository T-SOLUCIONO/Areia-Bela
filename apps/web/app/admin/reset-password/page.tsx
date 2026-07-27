'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, KeyRound, TriangleAlert } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { MIN_PASSWORD_LENGTH } from '@areia-bela/shared'
import { apiFetch, ApiError } from '@/lib/api-client'

function ResetForm() {
  const params = useSearchParams()
  const token = params.get('token')
  // Same token, same endpoint, same form — only the wording differs, so an
  // invitation doesn't need a second page to maintain.
  const isInvite = params.get('invite') === '1'

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      setDone(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? isInvite
            ? 'This invitation link is invalid or has expired. Ask for a new one.'
            : 'This link is invalid or has expired. Request a new one.'
          : 'Could not set your new password. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <TriangleAlert className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="font-serif text-2xl">Link is incomplete</CardTitle>
          <CardDescription>
            This page needs the link from your email. Request a new one to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="brand" size="lg" className="w-full">
            <Link href="/admin/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="font-serif text-2xl">
            {isInvite ? 'Your account is ready' : 'Password updated'}
          </CardTitle>
          <CardDescription>
            {isInvite
              ? 'Sign in with the password you just chose.'
              : 'You can sign in with your new password. Any other devices have been signed out.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="brand" size="lg" className="w-full">
            <Link href="/admin/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="font-serif text-2xl">
          {isInvite ? 'Welcome to Areia Bela' : 'Set a new password'}
        </CardTitle>
        <CardDescription>
          {isInvite
            ? 'Choose a password to finish setting up your account.'
            : "Choose something you don't use anywhere else."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-password">{isInvite ? 'Password' : 'New password'}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              autoFocus
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              At least {MIN_PASSWORD_LENGTH} characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">
              {isInvite ? 'Confirm password' : 'Confirm new password'}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>
            {busy ? 'Saving...' : isInvite ? 'Create my account' : 'Set new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
