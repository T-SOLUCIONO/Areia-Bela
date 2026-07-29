'use client'

import { Globe2, Home, KeyRound, ShieldCheck, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import { TeamManagement } from '@/components/admin/team-management'
import { TwoFactorSettings } from '@/components/admin/two-factor-settings'
import { ChangePassword } from '@/components/admin/change-password'
import { PropertySettings } from '@/components/admin/property-settings'
import { SiteSettings } from '@/components/admin/site-settings'
import { useHasRole } from '@/components/admin/admin-session-provider'
import { useAdminCopy } from '@/components/admin/admin-language-provider'

/**
 * Only what actually persists. The old General / Booking / Notifications /
 * Billing tabs were 26 fields behind a "Save changes" button that was a
 * one-second timeout and no request, so they were deleted. House and
 * Contact & SEO are their replacement, now that Fase 5 gave them real
 * endpoints — every field below reaches the database.
 */
export default function SettingsPage() {
  const isSuperadmin = useHasRole('superadmin')
  // Editing what guests are charged is the same bar as the pricing screen.
  const canEditHouse = useHasRole('superadmin', 'manager')
  const t = useAdminCopy()

  return (
    <Tabs defaultValue={canEditHouse ? 'house' : 'security'} className="space-y-6">
      <TabsList>
        {canEditHouse && <TabsTrigger value="house">{t.settings.house}</TabsTrigger>}
        {canEditHouse && <TabsTrigger value="site">{t.settings.site}</TabsTrigger>}
        <TabsTrigger value="security">{t.settings.security}</TabsTrigger>
        {/* Managing other people is superadmin-only, so the tab isn't offered
            to roles that would only find a permission notice behind it. */}
        {isSuperadmin && <TabsTrigger value="team">{t.settings.team}</TabsTrigger>}
      </TabsList>

      {canEditHouse && (
        <TabsContent value="house">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Home className="h-5 w-5 text-primary" />
                {t.property.title}
              </CardTitle>
              <CardDescription>{t.property.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <PropertySettings />
            </CardContent>
          </Card>
        </TabsContent>
      )}

      {canEditHouse && (
        <TabsContent value="site">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <Globe2 className="h-5 w-5 text-primary" />
                {t.site.title}
              </CardTitle>
              <CardDescription>{t.site.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <SiteSettings />
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
