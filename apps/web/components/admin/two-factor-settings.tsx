'use client'

import { useState } from 'react'
import { Check, Copy, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Badge } from '@areia-bela/ui/badge'
import { apiFetch, ApiError } from '@/lib/api-client'
import { useAdminSession } from '@/components/admin/admin-session-provider'

interface SetupResponse {
  secret: string
  keyUri: string
  qrCodeDataUrl: string
}

export function TwoFactorSettings() {
  const session = useAdminSession()
  const [enabled, setEnabled] = useState(session.totpEnabled)
  const [remaining, setRemaining] = useState(session.recoveryCodesRemaining)
  const [setup, setSetup] = useState<SetupResponse | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const begin = async () => {
    setBusy(true)
    setError('')
    try {
      setSetup(await apiFetch<SetupResponse>('/auth/totp/setup', { method: 'POST' }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start setup.')
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await apiFetch<{ recoveryCodes: string[] }>('/auth/totp/enable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      setRecoveryCodes(result.recoveryCodes)
      setRemaining(result.recoveryCodes.length)
      setEnabled(true)
      setSetup(null)
      setCode('')
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'That code is not valid. Check your authenticator and try again.'
          : 'Could not enable two-factor authentication.',
      )
    } finally {
      setBusy(false)
    }
  }

  const disable = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiFetch('/auth/totp/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      setEnabled(false)
      setRemaining(0)
      setRecoveryCodes(null)
      setPassword('')
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Incorrect password.'
          : 'Could not disable two-factor authentication.',
      )
    } finally {
      setBusy(false)
    }
  }

  const copyCodes = async () => {
    if (!recoveryCodes) return
    await navigator.clipboard.writeText(recoveryCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {enabled ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
          )}
          <div>
            <p className="font-medium text-foreground">
              {enabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
            </p>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? `You'll be asked for a code from your authenticator app when signing in. ${remaining} recovery codes left.`
                : 'Add a second step at sign-in using an authenticator app.'}
            </p>
          </div>
        </div>
        {enabled && <Badge variant="secondary">Enabled</Badge>}
      </div>

      {/* Shown once, right after enabling — these can't be retrieved later. */}
      {recoveryCodes && (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Save these recovery codes now — they are shown only once.
          </p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm text-amber-900">
            {recoveryCodes.map((recoveryCode) => (
              <li key={recoveryCode}>{recoveryCode}</li>
            ))}
          </ul>
          <Button variant="outline" size="sm" onClick={copyCodes}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? 'Copied' : 'Copy all'}
          </Button>
        </div>
      )}

      {!enabled && !setup && (
        <Button variant="brand" onClick={begin} disabled={busy}>
          {busy ? 'Starting...' : 'Set up two-factor authentication'}
        </Button>
      )}

      {!enabled && setup && (
        <form onSubmit={confirm} className="space-y-4 rounded-xl border border-border p-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">1. Add this to your app</p>
            <p className="text-xs text-muted-foreground">
              Scan this with Google Authenticator, Authy or 1Password.
            </p>
            {/* Plain img: the QR is a server-generated data URL, so next/image
                would add nothing but an optimization round trip. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrCodeDataUrl}
              alt="QR code to add Areia Bela Admin to your authenticator app"
              width={240}
              height={240}
              className="rounded-lg border border-border bg-white p-2"
            />
            <div className="space-y-1">
              <Label className="text-xs">Can&apos;t scan? Enter this key manually</Label>
              <code className="block rounded bg-muted px-2 py-1 font-mono text-sm">
                {setup.secret}
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totp-code">2. Enter the 6-digit code it shows</Label>
            <Input
              id="totp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456"
              className="max-w-[160px]"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="brand" disabled={busy}>
              {busy ? 'Verifying...' : 'Turn on'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {enabled && (
        <form onSubmit={disable} className="space-y-3 rounded-xl border border-border p-5">
          <Label htmlFor="disable-password">Turn off two-factor authentication</Label>
          <p className="text-xs text-muted-foreground">
            Confirm your password. This also invalidates your recovery codes.
          </p>
          <Input
            id="disable-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" variant="outline" disabled={busy}>
            {busy ? 'Turning off...' : 'Turn off'}
          </Button>
        </form>
      )}
    </div>
  )
}
