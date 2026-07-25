'use client'

import { useState } from 'react'
import {
  Plus,
  Save,
  Calendar,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  Edit2,
  Trash2,
} from 'lucide-react'
import { Button } from '@areia-bela/ui/button'
import { Input } from '@areia-bela/ui/input'
import { Label } from '@areia-bela/ui/label'
import { Badge } from '@areia-bela/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@areia-bela/ui/card'
import { Switch } from '@areia-bela/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@areia-bela/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@areia-bela/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@areia-bela/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@areia-bela/ui/dialog'
import { mockRooms, mockPricingRules } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function PricingPage() {
  const [selectedRoom, setSelectedRoom] = useState<string>(mockRooms[0]?.id || '')
  const [pricingRules] = useState(mockPricingRules)
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false)

  const room = mockRooms.find((r) => r.id === selectedRoom)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pricing & Rates</h1>
          <p className="text-muted-foreground">
            Manage room rates, seasonal pricing, and dynamic rules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Rate Calendar
          </Button>
          <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Pricing Rule</DialogTitle>
                <DialogDescription>Set up automated pricing adjustments</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input placeholder="e.g., Weekend Premium" />
                </div>
                <div className="space-y-2">
                  <Label>Rule Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day-of-week">Day of Week</SelectItem>
                      <SelectItem value="date-range">Date Range</SelectItem>
                      <SelectItem value="occupancy">Occupancy Based</SelectItem>
                      <SelectItem value="advance">Advance Purchase</SelectItem>
                      <SelectItem value="los">Length of Stay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adjustment Type</Label>
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
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddRuleOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsAddRuleOpen(false)}>Create Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="base-rates">
        <TabsList>
          <TabsTrigger value="base-rates">Base Rates</TabsTrigger>
          <TabsTrigger value="rules">Pricing Rules</TabsTrigger>
          <TabsTrigger value="seasons">Seasonal Rates</TabsTrigger>
        </TabsList>

        {/* Base Rates */}
        <TabsContent value="base-rates" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Room Types</CardTitle>
                <CardDescription>Select a room type to manage rates</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {mockRooms.slice(0, 6).map((room) => (
                    <button
                      key={room.id}
                      className={cn(
                        'w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors',
                        selectedRoom === room.id && 'bg-muted',
                      )}
                      onClick={() => setSelectedRoom(room.id)}
                    >
                      <div className="font-medium">{room.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center justify-between mt-1">
                        <span>Room {room.roomNumber}</span>
                        <span className="font-medium text-foreground">${room.basePrice}/night</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {room && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{room.name}</CardTitle>
                      <CardDescription>Configure base pricing and occupancy rates</CardDescription>
                    </div>
                    <Button>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Base Rate (per night)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" className="pl-9" defaultValue={room.basePrice} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Weekend Rate</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          className="pl-9"
                          defaultValue={Math.round(room.basePrice * 1.2)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Occupancy-Based Pricing</Label>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((guests) => (
                        <div key={guests} className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground w-20">
                            {guests} {guests === 1 ? 'Guest' : 'Guests'}
                          </span>
                          <div className="relative flex-1 max-w-[200px]">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              className="pl-9"
                              defaultValue={room.basePrice + (guests - 1) * 25}
                            />
                          </div>
                          {guests > 1 && (
                            <span className="text-sm text-emerald-600">
                              +${(guests - 1) * 25} extra
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Minimum Stay Requirements</Label>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Weekday Min</Label>
                        <Select defaultValue="1">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n} night{n > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Weekend Min</Label>
                        <Select defaultValue="2">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n} night{n > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-muted-foreground">Holiday Min</Label>
                        <Select defaultValue="3">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                {n} night{n > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Pricing Rules */}
        <TabsContent value="rules" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Pricing Rules</CardTitle>
              <CardDescription>
                Automated rules that adjust rates based on conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Adjustment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{rule.condition}</TableCell>
                      <TableCell>
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            rule.adjustment > 0 ? 'text-emerald-600' : 'text-red-600',
                          )}
                        >
                          {rule.adjustment > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {rule.adjustment > 0 ? '+' : ''}
                          {rule.adjustment}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch defaultChecked={rule.active} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasonal Rates */}
        <TabsContent value="seasons" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                name: 'Peak Season',
                dates: 'Dec 15 - Jan 5',
                adjustment: '+40%',
                color: 'bg-red-100 text-red-800',
              },
              {
                name: 'High Season',
                dates: 'Jun 1 - Aug 31',
                adjustment: '+25%',
                color: 'bg-amber-100 text-amber-800',
              },
              {
                name: 'Shoulder Season',
                dates: 'Mar-May, Sep-Nov',
                adjustment: '+10%',
                color: 'bg-blue-100 text-blue-800',
              },
              {
                name: 'Low Season',
                dates: 'Jan 6 - Feb 28',
                adjustment: '-15%',
                color: 'bg-gray-100 text-gray-800',
              },
            ].map((season) => (
              <Card key={season.name}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{season.name}</CardTitle>
                    <Badge className={season.color}>{season.adjustment}</Badge>
                  </div>
                  <CardDescription>{season.dates}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" size="sm">
                    <Edit2 className="mr-2 h-3 w-3" />
                    Edit Season
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
