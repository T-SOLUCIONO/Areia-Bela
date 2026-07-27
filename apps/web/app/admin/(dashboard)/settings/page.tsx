'use client'

import { KeyRound, ShieldCheck, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import { TeamManagement } from '@/components/admin/team-management'
import { TwoFactorSettings } from '@/components/admin/two-factor-settings'
import { ChangePassword } from '@/components/admin/change-password'
import { useHasRole } from '@/components/admin/admin-session-provider'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Only what actually persists. The General / Booking / Notifications / Billing
 * tabs were removed: 26 fields that saved nothing, behind a "Save changes"
 * button that was a one-second timeout and no request. There is no property
 * settings endpoint to wire them to — that arrives with the CMS in Fase 5, and
 * they come back then. A control that looks like it saves but doesn't is worse
 * than no control.
 */
export default function SettingsPage() {
  const isSuperadmin = useHasRole('superadmin')
  const t = useAdminCopy()

  return (
    <Tabs defaultValue="security" className="space-y-6">
      <TabsList>
        <TabsTrigger value="security">{t.settings.security}</TabsTrigger>
        {/* Managing other people is superadmin-only, so the tab isn't offered
            to roles that would only find a permission notice behind it. */}
        {isSuperadmin && <TabsTrigger value="team">{t.settings.team}</TabsTrigger>}
      </TabsList>

      <TabsContent value="security" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <KeyRound className="h-5 w-5 text-primary" />
              {t.settings.passwordTitle}
            </CardTitle>
            <CardDescription>{t.settings.passwordSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePassword />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {t.settings.twoFactorTitle}
            </CardTitle>
            <CardDescription>{t.settings.twoFactorSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <TwoFactorSettings />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="team">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif">
              <Users className="h-5 w-5 text-primary" />
              {t.settings.teamTitle}
            </CardTitle>
            <CardDescription>{t.settings.teamSubtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {isSuperadmin ? (
              <TeamManagement />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.settings.teamRestricted}
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
