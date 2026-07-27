'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, MailCheck, Send, ShieldOff, UserPlus } from 'lucide-react'
import type { UserRole } from '@areia-bela/types'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Badge } from '@areia-bela/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { apiFetch, ApiError } from '@/lib/api-client'
import { useAdminSession } from '@/components/admin/admin-session-provider'

type ApiRole = 'SUPERADMIN' | 'MANAGER' | 'VIEWER'

interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  role: ApiRole
  active: boolean
  lastLoginAt: string | null
  totpEnabledAt: string | null
}

const ROLES: ApiRole[] = ['SUPERADMIN', 'MANAGER', 'VIEWER']
const toDomainRole = (role: ApiRole) => role.toLowerCase() as UserRole

const emptyDraft = {
  email: '',
  firstName: '',
  lastName: '',
  password: '',
  role: 'VIEWER' as ApiRole,
}

export function TeamManagement() {
  const session = useAdminSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [isCreating, setIsCreating] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [resetSentTo, setResetSentTo] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setMembers(await apiFetch<TeamMember[]>('/users'))
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the team.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // The setState calls inside `load` run after an await, so they are not the
    // synchronous cascading render the rule is guarding against. Fetching on
    // mount is unavoidable here: this panel lives inside a 'use client' tabs
    // page, so the data can't come from a server component as props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const createMember = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsCreating(true)
    setError('')
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(draft) })
      setDraft(emptyDraft)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the user.')
    } finally {
      setIsCreating(false)
    }
  }

  // The API rejects removing the last superadmin and self-demotion; surfacing
  // its message is better than duplicating those rules here.
  const patchMember = async (id: string, body: Record<string, unknown>) => {
    setPendingId(id)
    setError('')
    try {
      await apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the user.')
    } finally {
      setPendingId(null)
    }
  }

  /**
   * Emails the member a reset link rather than letting an admin type a new
   * password: this way nobody but the account owner ever knows it.
   */
  const sendPasswordReset = async (member: TeamMember) => {
    setPendingId(member.id)
    setError('')
    setResetSentTo(null)
    try {
      await apiFetch(`/users/${member.id}/send-password-reset`, { method: 'POST' })
      setResetSentTo(member.email)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the reset link.')
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {resetSentTo && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Reset link sent to {resetSentTo}.</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="pb-3 pr-4 font-medium">Name</th>
              <th className="pb-3 pr-4 font-medium">Role</th>
              <th className="pb-3 pr-4 font-medium">2FA</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.id === session.id
              const busy = pendingId === member.id

              return (
                <tr key={member.id} className="border-b border-border/60">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-foreground">
                      {member.firstName} {member.lastName}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    <Select
                      value={member.role}
                      disabled={busy || isSelf}
                      onValueChange={(role) => patchMember(member.id, { role })}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role} className="capitalize">
                            {toDomainRole(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-3 pr-4">
                    {member.totpEnabledAt ? (
                      <Badge variant="secondary">Enabled</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set up</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {member.active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Deactivated</Badge>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || !member.active}
                      onClick={() => sendPasswordReset(member)}
                      title="Email this person a password reset link"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Reset password
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy || isSelf}
                      onClick={() => patchMember(member.id, { active: !member.active })}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : member.active ? (
                        <>
                          <ShieldOff className="mr-2 h-4 w-4" />
                          Deactivate
                        </>
                      ) : (
                        'Reactivate'
                      )}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={createMember} className="space-y-4 rounded-xl border border-border p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h3 className="font-medium text-foreground">Add a team member</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="member-firstName">First name</Label>
            <Input
              id="member-firstName"
              required
              value={draft.firstName}
              onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-lastName">Last name</Label>
            <Input
              id="member-lastName"
              required
              value={draft.lastName}
              onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              required
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-password">Temporary password</Label>
            <Input
              id="member-password"
              type="password"
              required
              minLength={12}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">At least 12 characters.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-role">Role</Label>
            <Select
              value={draft.role}
              onValueChange={(role) => setDraft({ ...draft, role: role as ApiRole })}
            >
              <SelectTrigger id="member-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {toDomainRole(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" variant="brand" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create user'}
        </Button>
      </form>
    </div>
  )
}
