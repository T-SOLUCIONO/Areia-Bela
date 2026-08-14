'use client'

import { Bell, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import { TeamManagement } from '@/components/admin/team-management'
import { TwoFactorSettings } from '@/components/admin/two-factor-settings'
import { ChangePassword } from '@/components/admin/change-password'
import { SiteSettings } from '@/components/admin/site-settings'
import { useHasRole } from '@/components/admin/admin-session-provider'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Your account, and how the house reaches you.
 *
 * What used to sit here — the house's own facts, the contact details, the
 * search description, the logo — is the website, and it moved into the website
 * screen's rail where the person editing the hero can find it. What is left is
 * the part that is genuinely not the website: where booking alerts land, your
 * password, and who else can sign in.
 */
export default function SettingsPage() {
  const isSuperadmin = useHasRole('superadmin')
  // Editing what guests are charged is the same bar as the pricing screen.
  const canEditHouse = useHasRole('superadmin', 'manager')
  const t = useAdminCopy()

  return (
    <Tabs defaultValue={canEditHouse ? 'alerts' : 'security'} className="space-y-6">
      <TabsList>
        {canEditHouse && <TabsTrigger value="alerts">{t.site.notifyTitle}</TabsTrigger>}
        <TabsTrigger value="security">{t.settings.security}</TabsTrigger>
        {/* Managing other people is superadmin-only, so the tab isn't offered
            to roles that would only find a permission notice behind it. */}
        {isSuperadmin && <TabsTrigger value="team">{t.settings.team}</TabsTrigger>}
      </TabsList>

      {canEditHouse && (
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Bell className="h-5 w-5 text-primary" />
                {t.site.notifyTitle}
              </CardTitle>
              <CardDescription>{t.site.notifySubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <SiteSettings section="notifications" />
            </CardContent>
          </Card>
        </TabsContent>
      )}

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
