'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  Tag,
  Percent,
  Calendar,
  Users,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Badge } from '@areia-bela/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Switch } from '@areia-bela/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@areia-bela/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@areia-bela/ui/dialog'
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
import { mockCoupons } from '@/lib/mock-data'
import type { AdminCoupon } from '@/types'
import { cn } from '@/lib/utils'
import { DemoDataNotice } from '@/components/admin/demo-data-notice'

export default function CouponsPage() {
  const [coupons] = useState<AdminCoupon[]>(mockCoupons)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredCoupons = coupons.filter(
    (coupon) =>
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const stats = {
    active: coupons.filter((c) => c.status === 'active').length,
    totalUsed: coupons.reduce((sum, c) => sum + c.usedCount, 0),
    totalSavings: coupons.reduce(
      (sum, c) => sum + c.usedCount * (c.type === 'percentage' ? 50 : c.value),
      0,
    ),
  }

  const getTypeBadge = (type: AdminCoupon['type']) => {
    if (type === 'percentage') {
      return (
        <Badge variant="secondary">
          <Percent className="mr-1 h-3 w-3" />
          Percentage
        </Badge>
      )
    }
    return (
      <Badge variant="outline">
        <Tag className="mr-1 h-3 w-3" />
        Fixed
      </Badge>
    )
  }

  const getStatusBadge = (status: AdminCoupon['status']) => {
    const variants: Record<AdminCoupon['status'], { className: string; label: string }> = {
      active: { className: 'bg-emerald-100 text-emerald-800', label: 'Active' },
      expired: { className: 'bg-gray-100 text-gray-800', label: 'Expired' },
      disabled: { className: 'bg-red-100 text-red-800', label: 'Disabled' },
    }
    const { className, label } = variants[status]
    return <Badge className={className}>{label}</Badge>
  }

  return (
    <div className="space-y-6">
      <DemoDataNotice />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Coupon</DialogTitle>
              <DialogDescription>Set up a new promotional discount code</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Coupon Code</Label>
                  <Input placeholder="e.g., SUMMER20" className="uppercase" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="e.g., Summer sale discount" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Discount Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input type="number" placeholder="e.g., 20" />
                </div>
                <div className="space-y-2">
                  <Label>Min. Booking ($)</Label>
                  <Input type="number" placeholder="e.g., 200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valid From</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usage Limit (Total)</Label>
                  <Input type="number" placeholder="Unlimited if empty" />
                </div>
                <div className="space-y-2">
                  <Label>Limit Per Guest</Label>
                  <Input type="number" placeholder="1" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsAddDialogOpen(false)}>Create Coupon</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Coupons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Redemptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Savings Given
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalSavings.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search coupons..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                      {coupon.code}
                    </code>
                  </TableCell>
                  <TableCell>{coupon.description}</TableCell>
                  <TableCell>{getTypeBadge(coupon.type)}</TableCell>
                  <TableCell className="font-medium">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : `$${coupon.value}`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(coupon.validFrom), 'MMM d')} -{' '}
                      {format(new Date(coupon.validUntil), 'MMM d, yyyy')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {coupon.usedCount}/{coupon.maxUses || '∞'}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(coupon.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Coupon
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
