'use client'

import { useState } from 'react'
import { Mail, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@areia-bela/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@areia-bela/ui/dialog'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { apiFetch, ApiError } from '@/lib/api-client'
import { useAdminCopy } from '@/components/admin/admin-language-provider'
import { fill } from '@/lib/admin-i18n'

type ApiRole = 'SUPERADMIN' | 'MANAGER' | 'VIEWER'
const ROLES: ApiRole[] = ['SUPERADMIN', 'MANAGER', 'VIEWER']

const emptyDraft = { email: '', firstName: '', lastName: '', role: 'VIEWER' as ApiRole }

/**
 * Invite rather than create-with-password: the form has no password field
 * because the invitee picks their own from an emailed link. That keeps the
 * credential out of the inbox and out of the inviter's hands.
 */
export function InviteMemberDialog({ onInvited }: { onInvited: () => void }) {
  const t = useAdminCopy()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [busy, setBusy] = useState(false)

  const roleLabel: Record<ApiRole, string> = {
    SUPERADMIN: t.roles.superadmin,
    MANAGER: t.roles.manager,
    VIEWER: t.roles.viewer,
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(draft) })
      toast.success(fill(t.team.inviteSent, { email: draft.email }))
      setDraft(emptyDraft)
      setOpen(false)
      onInvited()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t.team.inviteFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <UserPlus className="h-4 w-4" />
          {t.team.invite}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">{t.team.inviteTitle}</DialogTitle>
          <DialogDescription>{t.team.inviteSubtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-firstName">{t.team.firstName}</Label>
              <Input
                id="invite-firstName"
                required
                autoFocus
                value={draft.firstName}
                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-lastName">{t.team.lastName}</Label>
              <Input
                id="invite-lastName"
                required
                value={draft.lastName}
                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">{t.team.email}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="nombre@areiabela.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">{t.team.role}</Label>
            <Select
              value={draft.role}
              onValueChange={(role) => setDraft({ ...draft, role: role as ApiRole })}
            >
              <SelectTrigger id="invite-role">
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
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="brand" disabled={busy}>
              <Mail className="h-4 w-4" />
              {busy ? t.team.sending : t.team.sendInvite}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
