'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, KeyRound, Loader2, MoreHorizontal, Send, ShieldOff, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@areia-bela/ui/badge'
import { Button } from '@areia-bela/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@areia-bela/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Skeleton } from '@areia-bela/ui/skeleton'
import { apiFetch, ApiError } from '@/lib/api-client'
import { useAdminSession } from '@/components/admin/admin-session-provider'
import { useAdminCopy, useAdminCopyRef } from '@/components/admin/admin-language-provider'
import { InviteMemberDialog } from '@/components/admin/invite-member-dialog'
import { fill } from '@/lib/admin-i18n'
import { cn } from '@/lib/utils'

type ApiRole = 'SUPERADMIN' | 'MANAGER' | 'VIEWER'
const ROLES: ApiRole[] = ['SUPERADMIN', 'MANAGER', 'VIEWER']

interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  role: ApiRole
  active: boolean
  lastLoginAt: string | null
  totpEnabledAt: string | null
  invitedAt: string | null
  passwordSetAt: string | null
}

export function TeamManagement() {
  const session = useAdminSession()
  const t = useAdminCopy()
  const copyRef = useAdminCopyRef()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const roleLabel: Record<ApiRole, string> = {
    SUPERADMIN: t.roles.superadmin,
    MANAGER: t.roles.manager,
    VIEWER: t.roles.viewer,
  }

  const load = useCallback(async () => {
    try {
      setMembers(await apiFetch<TeamMember[]>('/users'))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : copyRef.current.team.loadFailed)
    } finally {
      setIsLoading(false)
    }
  }, [copyRef])

  useEffect(() => {
    // setState here runs after an await, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  /** The API owns the rules (last superadmin, self-demotion); surface its message. */
  const act = async (id: string, run: () => Promise<unknown>, success?: string) => {
    setPendingId(id)
    try {
      await run()
      if (success) toast.success(success)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.team.updateFailed)
    } finally {
      setPendingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {members.length === 1
            ? t.team.peopleOne
            : fill(t.team.peopleMany, { count: String(members.length) })}
        </p>
        <InviteMemberDialog onInvited={load} />
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {members.map((member) => {
          const isSelf = member.id === session.id
          const busy = pendingId === member.id
          const isPending = !member.passwordSetAt
          const initials = `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase()

          return (
            <li
              key={member.id}
              className={cn(
                'flex flex-wrap items-center gap-4 p-4 transition-colors',
                !member.active && 'opacity-60',
              )}
            >
              <div
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {member.firstName} {member.lastName}
                  {isSelf && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({t.team.you})
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">{member.email}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isPending && member.active && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-300 text-amber-800 dark:text-amber-200"
                  >
                    <Clock className="h-3 w-3" />
                    {t.team.pending}
                  </Badge>
                )}
                {!member.active && <Badge variant="outline">{t.team.deactivated}</Badge>}
                {member.totpEnabledAt && (
                  <Badge variant="secondary" className="gap-1">
                    <KeyRound className="h-3 w-3" />
                    {t.team.twoFactor}
                  </Badge>
                )}
              </div>

              <Select
                value={member.role}
                disabled={busy || isSelf}
                onValueChange={(role) =>
                  act(member.id, () =>
                    apiFetch(`/users/${member.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ role }),
                    }),
                  )
                }
              >
                <SelectTrigger className="w-[140px]" aria-label={t.team.role}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabel[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={member.email}>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreHorizontal className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isPending ? (
                    <DropdownMenuItem
                      disabled={!member.active}
                      onSelect={() =>
                        act(
                          member.id,
                          () =>
                            apiFetch(`/users/${member.id}/resend-invitation`, { method: 'POST' }),
                          fill(t.team.inviteSent, { email: member.email }),
                        )
                      }
                    >
                      <Send className="h-4 w-4" />
                      {t.team.resendInvite}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      disabled={!member.active}
                      onSelect={() =>
                        act(
                          member.id,
                          () =>
                            apiFetch(`/users/${member.id}/send-password-reset`, { method: 'POST' }),
                          fill(t.team.resetSent, { email: member.email }),
                        )
                      }
                    >
                      <KeyRound className="h-4 w-4" />
                      {t.team.resetPassword}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    disabled={isSelf}
                    onSelect={() =>
                      act(member.id, () =>
                        apiFetch(`/users/${member.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ active: !member.active }),
                        }),
                      )
                    }
                  >
                    {member.active ? (
                      <>
                        <ShieldOff className="h-4 w-4" />
                        {t.team.deactivate}
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" />
                        {t.team.reactivate}
                      </>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
