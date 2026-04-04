import type {
  Room,
  Reservation,
  Guest,
  GuestStay,
  HousekeepingTask,
  HousekeepingStaff,
  Channel,
  ChannelReservation,
  SeasonalPricing,
  Coupon,
  MaintenanceTask,
  DailyStats,
  RoomStats,
  ChannelStats,
  Review,
  PropertyInfo,
  RoomAvailability,
  AdminRoom,
  AdminReservation,
  AdminGuest,
  Staff,
  AdminHousekeepingTask,
  AdminChannel,
  AdminCoupon,
  PricingRule,
  AdminMaintenanceTask,
  Property,
} from '@/types'

// Property Info
export const propertyInfo: PropertyInfo = {
  name: 'Heated Pool & Coffee Bar • 5 minutes to Madeira Beach',
  description: 'Welcome to Areia Bela, just 5 minutes from Madeira Beach! Enjoy a private heated pool, Smart Toilet, BBQ, full coffee bar, selfie station, and game corner with Bubble Surprise for kids. Pet-friendly with treats, fully stocked kitchen, unlimited Wi-Fi, and in-room QR codes for dining & local adventures. Comfort, fun, and unforgettable memories in one family- and group-friendly beach getaway.',
  address: 'San Petersburgo, Florida, Estados Unidos',
  city: 'St. Petersburg',
  country: 'United States',
  phone: '+1 (555) 987-6543',
  email: 'host@areiabela.com',
  website: 'www.areiabela.com',
  checkInTime: '16:00',
  checkOutTime: '10:00',
  amenities: [
    'Cocina',
    'Aparcamiento gratuito en las instalaciones',
    'Wifi',
    'Piscina',
    'Zona para trabajar',
    'Perchas',
    'TV',
    'Secadora',
    'Champú',
    'Lavadora',
    'Secador de pelo',
    'Servicios básicos',
    'Aire acondicionado',
    'Calefacción',
    'Aparcamiento gratuito en la calle',
    'Detector de humo',
    'Detector de monóxido de carbono',
    'Botiquín',
    'Extintor de incendios',
    'Cerradura con teclado',
    'Entrada privada',
    'Bañera',
    'Agua caliente',
    'Gel de ducha',
    'Ropa de cama',
    'Microondas',
    'Cafetera',
    'Nevera',
    'Lavavajillas',
    'Platos y cubiertos',
    'Utensilios básicos de cocina',
    'Horno',
    'Fogones',
    'Barbacoa',
    'Patio trasero',
    'Básicos de playa',
    'Bicicletas',
    'Juegos de mesa',
    'Cafetera Keurig',
    'Productos de limpieza'
  ],
  policies: [
    'Check-in: 4:00 PM - Check-out: 10:00 AM',
    'No se permiten fiestas ni eventos',
    'Admite mascotas',
    'Prohibido fumar',
    'Exterior security cameras present',
  ],
  images: [
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/40a17db2-7992-4580-a222-d8fe07087e28.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/c3e81b9b-8fd0-4334-b82d-ad919bea2bbe.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/58ef08d8-d3f4-4722-a5cf-d57284cc2beb.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/942777bf-4cd4-48cd-9730-5f71dd72b2c8.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/018ab8d8-2e04-4320-a60c-a7dd61c8a9e2.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/fc8b39e6-bddc-4ebf-b041-23bfa8fce12a.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/5fc2ddfb-7bc8-4e78-8ac4-cd287e41955e.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/60040006-8fd7-4dfc-ae4c-ef3d29a2cce8.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/98aecab8-e3cb-4551-9aa1-cefd97509e25.jpeg?aki_policy=large',
    'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/36ac1e34-a959-494b-a691-a278367aa1a9.jpeg?aki_policy=large'
  ],
}

// Rooms (Keeping structure but adapting to full-property rental or multiple distinct rooms inside the property for UI purposes)
export const rooms: Room[] = [
  {
    id: '1489399156507737323',
    type: 'luxury-suite',
    name: 'Heated Pool & Coffee Bar• 5-min to Madeira Beach',
    description: 'Welcome to Areia Bela, just 5 minutes from Madeira Beach! Enjoy a private heated pool, Smart Toilet, BBQ, full coffee bar, selfie station, and game corner with Bubble Surprise for kids. Pet-friendly with treats, fully stocked kitchen, unlimited Wi-Fi, and in-room QR codes for dining & local adventures.',
    capacity: 8,
    beds: '3 Bedrooms',
    size: 150,
    amenities: ['Wifi', 'Piscina', 'Aire acondicionado', 'Cocina', 'Lavadora', 'Secadora', 'TV', 'Bicicletas', 'Barbacoa', 'Pet Friendly'],
    images: [
      'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/40a17db2-7992-4580-a222-d8fe07087e28.jpeg?aki_policy=large',
      'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/c3e81b9b-8fd0-4334-b82d-ad919bea2bbe.jpeg?aki_policy=large',
      'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/58ef08d8-d3f4-4722-a5cf-d57284cc2beb.jpeg?aki_policy=large',
      'https://a0.muscache.com/im/pictures/hosting/Hosting-1489399156507737323/original/942777bf-4cd4-48cd-9730-5f71dd72b2c8.jpeg?aki_policy=large',
    ],
    basePrice: 250,
    inventory: 1,
  }
]

// Guests
export const guests: Guest[] = [
  {
    id: 'guest-1',
    name: 'Emily Johnson',
    email: 'emily.johnson@email.com',
    phone: '+1 (555) 234-5678',
    country: 'United States',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    totalStays: 5,
    totalSpending: 4500,
    notes: 'VIP guest. Prefers ocean view rooms.',
    createdAt: '2024-01-15',
    lastStay: '2025-12-20',
  },
  {
    id: 'guest-2',
    name: 'Michael Chen',
    email: 'michael.chen@email.com',
    phone: '+1 (555) 345-6789',
    country: 'Canada',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    totalStays: 3,
    totalSpending: 2800,
    notes: 'Business traveler. Late check-out requested.',
    createdAt: '2024-03-20',
    lastStay: '2025-11-15',
  },
  {
    id: 'guest-3',
    name: 'Sofia Rodriguez',
    email: 'sofia.rodriguez@email.com',
    phone: '+34 612 345 678',
    country: 'Spain',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
    totalStays: 2,
    totalSpending: 3200,
    createdAt: '2024-06-10',
    lastStay: '2025-10-05',
  },
  {
    id: 'guest-4',
    name: 'James Wilson',
    email: 'james.wilson@email.com',
    phone: '+44 7911 123456',
    country: 'United Kingdom',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
    totalStays: 8,
    totalSpending: 12500,
    notes: 'Platinum member. Anniversary every June.',
    createdAt: '2023-08-22',
    lastStay: '2026-01-10',
  },
  {
    id: 'guest-5',
    name: 'Yuki Tanaka',
    email: 'yuki.tanaka@email.com',
    phone: '+81 90-1234-5678',
    country: 'Japan',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    totalStays: 1,
    totalSpending: 850,
    createdAt: '2025-02-14',
    lastStay: '2025-02-18',
  },
  {
    id: 'guest-6',
    name: 'Alexander Müller',
    email: 'alexander.muller@email.com',
    phone: '+49 170 1234567',
    country: 'Germany',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
    totalStays: 4,
    totalSpending: 5600,
    notes: 'Prefers quiet rooms. Dietary restrictions: vegetarian.',
    createdAt: '2024-02-28',
    lastStay: '2025-12-01',
  },
]

// Guest Stays
export const guestStays: GuestStay[] = [
  { id: 'stay-1', guestId: 'guest-1', reservationId: 'res-1', roomName: 'Luxury Suite', checkIn: '2025-12-15', checkOut: '2025-12-20', totalSpent: 3250 },
  { id: 'stay-2', guestId: 'guest-1', reservationId: 'res-2', roomName: 'Deluxe Room', checkIn: '2025-08-10', checkOut: '2025-08-14', totalSpent: 1000 },
  { id: 'stay-3', guestId: 'guest-2', reservationId: 'res-3', roomName: 'Standard Room', checkIn: '2025-11-10', checkOut: '2025-11-15', totalSpent: 750 },
  { id: 'stay-4', guestId: 'guest-4', reservationId: 'res-4', roomName: 'Penthouse Suite', checkIn: '2026-01-05', checkOut: '2026-01-10', totalSpent: 6000 },
  { id: 'stay-5', guestId: 'guest-3', reservationId: 'res-5', roomName: 'Family Suite', checkIn: '2025-10-01', checkOut: '2025-10-05', totalSpent: 1600 },
]

// Reservations
export const reservations: Reservation[] = [
  {
    id: 'res-1',
    guestId: 'guest-1',
    guestName: 'Emily Johnson',
    guestEmail: 'emily.johnson@email.com',
    guestPhone: '+1 (555) 234-5678',
    roomId: 'room-4',
    roomType: 'luxury-suite',
    roomName: 'Luxury Suite',
    checkIn: '2026-03-15',
    checkOut: '2026-03-20',
    guests: 2,
    adults: 2,
    children: 0,
    status: 'confirmed',
    totalPrice: 3575,
    nightPrice: 650,
    cleaningFee: 75,
    serviceFee: 125,
    taxes: 325,
    specialRequests: 'Late check-in around 10 PM. Champagne on arrival.',
    paymentMethod: 'stripe',
    channel: 'direct',
    createdAt: '2026-02-20',
    updatedAt: '2026-02-20',
  },
  {
    id: 'res-2',
    guestId: 'guest-2',
    guestName: 'Michael Chen',
    guestEmail: 'michael.chen@email.com',
    guestPhone: '+1 (555) 345-6789',
    roomId: 'room-2',
    roomType: 'deluxe',
    roomName: 'Deluxe Room',
    checkIn: '2026-03-10',
    checkOut: '2026-03-12',
    guests: 1,
    adults: 1,
    children: 0,
    status: 'checked-in',
    totalPrice: 575,
    nightPrice: 250,
    cleaningFee: 35,
    serviceFee: 40,
    taxes: 50,
    paymentMethod: 'stripe',
    channel: 'booking',
    createdAt: '2026-02-15',
    updatedAt: '2026-03-10',
  },
  {
    id: 'res-3',
    guestId: 'guest-3',
    guestName: 'Sofia Rodriguez',
    guestEmail: 'sofia.rodriguez@email.com',
    guestPhone: '+34 612 345 678',
    roomId: 'room-3',
    roomType: 'family-suite',
    roomName: 'Family Suite',
    checkIn: '2026-03-18',
    checkOut: '2026-03-25',
    guests: 4,
    adults: 2,
    children: 2,
    status: 'pending',
    totalPrice: 3220,
    nightPrice: 400,
    cleaningFee: 60,
    serviceFee: 100,
    taxes: 260,
    specialRequests: 'Baby crib needed. Allergies to nuts.',
    channel: 'airbnb',
    createdAt: '2026-03-01',
    updatedAt: '2026-03-01',
  },
  {
    id: 'res-4',
    guestId: 'guest-4',
    guestName: 'James Wilson',
    guestEmail: 'james.wilson@email.com',
    guestPhone: '+44 7911 123456',
    roomId: 'room-5',
    roomType: 'penthouse',
    roomName: 'Penthouse Suite',
    checkIn: '2026-03-05',
    checkOut: '2026-03-08',
    guests: 2,
    adults: 2,
    children: 0,
    status: 'checked-out',
    totalPrice: 3960,
    nightPrice: 1200,
    cleaningFee: 100,
    serviceFee: 180,
    taxes: 360,
    paymentMethod: 'apple-pay',
    channel: 'direct',
    createdAt: '2026-02-10',
    updatedAt: '2026-03-08',
  },
  {
    id: 'res-5',
    guestId: 'guest-5',
    guestName: 'Yuki Tanaka',
    guestEmail: 'yuki.tanaka@email.com',
    guestPhone: '+81 90-1234-5678',
    roomId: 'room-1',
    roomType: 'standard',
    roomName: 'Standard Room',
    checkIn: '2026-03-12',
    checkOut: '2026-03-14',
    guests: 1,
    adults: 1,
    children: 0,
    status: 'confirmed',
    totalPrice: 365,
    nightPrice: 150,
    cleaningFee: 25,
    serviceFee: 30,
    taxes: 35,
    channel: 'expedia',
    createdAt: '2026-03-05',
    updatedAt: '2026-03-05',
  },
  {
    id: 'res-6',
    guestId: 'guest-6',
    guestName: 'Alexander Müller',
    guestEmail: 'alexander.muller@email.com',
    guestPhone: '+49 170 1234567',
    roomId: 'room-2',
    roomType: 'deluxe',
    roomName: 'Deluxe Room',
    checkIn: '2026-03-20',
    checkOut: '2026-03-27',
    guests: 2,
    adults: 2,
    children: 0,
    status: 'confirmed',
    totalPrice: 2025,
    nightPrice: 250,
    cleaningFee: 35,
    serviceFee: 90,
    taxes: 175,
    specialRequests: 'Vegetarian breakfast. Quiet room away from elevator.',
    paymentMethod: 'stripe',
    channel: 'booking',
    createdAt: '2026-02-25',
    updatedAt: '2026-02-25',
  },
  {
    id: 'res-7',
    guestId: 'guest-1',
    guestName: 'Emily Johnson',
    guestEmail: 'emily.johnson@email.com',
    guestPhone: '+1 (555) 234-5678',
    roomId: 'room-1',
    roomType: 'standard',
    roomName: 'Standard Room',
    checkIn: '2026-02-01',
    checkOut: '2026-02-03',
    guests: 1,
    adults: 1,
    children: 0,
    status: 'cancelled',
    totalPrice: 365,
    nightPrice: 150,
    cleaningFee: 25,
    serviceFee: 30,
    taxes: 35,
    channel: 'direct',
    createdAt: '2026-01-20',
    updatedAt: '2026-01-25',
  },
]

// Housekeeping Tasks
export const housekeepingTasks: HousekeepingTask[] = [
  { id: 'hk-1', roomId: 'room-1', roomNumber: '101', roomType: 'standard', status: 'clean', scheduledDate: '2026-03-10', completedAt: '2026-03-10T09:30:00', assignedTo: 'Maria Santos', priority: 'medium' },
  { id: 'hk-2', roomId: 'room-1', roomNumber: '102', roomType: 'standard', status: 'dirty', scheduledDate: '2026-03-10', assignedTo: 'Maria Santos', priority: 'high' },
  { id: 'hk-3', roomId: 'room-2', roomNumber: '201', roomType: 'deluxe', status: 'in-progress', scheduledDate: '2026-03-10', assignedTo: 'Carlos Rivera', priority: 'medium' },
  { id: 'hk-4', roomId: 'room-2', roomNumber: '202', roomType: 'deluxe', status: 'inspection', scheduledDate: '2026-03-10', assignedTo: 'Carlos Rivera', priority: 'low' },
  { id: 'hk-5', roomId: 'room-3', roomNumber: '301', roomType: 'family-suite', status: 'clean', scheduledDate: '2026-03-10', completedAt: '2026-03-10T10:15:00', assignedTo: 'Ana Garcia', priority: 'medium' },
  { id: 'hk-6', roomId: 'room-4', roomNumber: '401', roomType: 'luxury-suite', status: 'dirty', scheduledDate: '2026-03-10', assignedTo: 'Ana Garcia', priority: 'high', notes: 'VIP checkout - deep clean required' },
  { id: 'hk-7', roomId: 'room-5', roomNumber: '501', roomType: 'penthouse', status: 'clean', scheduledDate: '2026-03-10', completedAt: '2026-03-10T08:00:00', assignedTo: 'Ana Garcia', priority: 'high' },
]

// Housekeeping Staff
export const housekeepingStaff: HousekeepingStaff[] = [
  { id: 'staff-1', name: 'Maria Santos', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100', tasksCompleted: 245, tasksAssigned: 3 },
  { id: 'staff-2', name: 'Carlos Rivera', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100', tasksCompleted: 312, tasksAssigned: 2 },
  { id: 'staff-3', name: 'Ana Garcia', avatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=100', tasksCompleted: 198, tasksAssigned: 2 },
]

// Channels
export const channels: Channel[] = [
  { id: 'channel-1', name: 'Airbnb', logo: '/channels/airbnb.svg', status: 'connected', lastSync: '2026-03-10T14:30:00', reservations: 45, revenue: 42500 },
  { id: 'channel-2', name: 'Booking.com', logo: '/channels/booking.svg', status: 'syncing', lastSync: '2026-03-10T14:25:00', reservations: 78, revenue: 65200 },
  { id: 'channel-3', name: 'Expedia', logo: '/channels/expedia.svg', status: 'connected', lastSync: '2026-03-10T14:20:00', reservations: 32, revenue: 28400 },
]

// Channel Reservations
export const channelReservations: ChannelReservation[] = [
  { id: 'ch-res-1', channelId: 'channel-1', channelName: 'Airbnb', guestName: 'Lisa Anderson', roomType: 'deluxe', checkIn: '2026-03-22', checkOut: '2026-03-25', totalPrice: 825, importedAt: '2026-03-10T10:00:00', status: 'imported' },
  { id: 'ch-res-2', channelId: 'channel-2', channelName: 'Booking.com', guestName: 'Robert Brown', roomType: 'standard', checkIn: '2026-03-24', checkOut: '2026-03-26', totalPrice: 340, importedAt: '2026-03-10T11:30:00', status: 'pending' },
  { id: 'ch-res-3', channelId: 'channel-3', channelName: 'Expedia', guestName: 'Jennifer Lee', roomType: 'family-suite', checkIn: '2026-03-28', checkOut: '2026-04-02', totalPrice: 2200, importedAt: '2026-03-10T12:15:00', status: 'imported' },
  { id: 'ch-res-4', channelId: 'channel-1', channelName: 'Airbnb', guestName: 'David Kim', roomType: 'luxury-suite', checkIn: '2026-04-01', checkOut: '2026-04-05', totalPrice: 2860, importedAt: '2026-03-10T09:45:00', status: 'imported' },
]

// Seasonal Pricing
export const seasonalPricing: SeasonalPricing[] = [
  { id: 'season-1', name: 'Winter Low Season', type: 'low', startDate: '2026-01-05', endDate: '2026-02-28', multiplier: 0.85 },
  { id: 'season-2', name: 'Spring Break', type: 'high', startDate: '2026-03-15', endDate: '2026-04-15', multiplier: 1.25 },
  { id: 'season-3', name: 'Summer Peak', type: 'high', startDate: '2026-06-15', endDate: '2026-08-31', multiplier: 1.4 },
  { id: 'season-4', name: 'Thanksgiving', type: 'holiday', startDate: '2026-11-20', endDate: '2026-11-30', multiplier: 1.5 },
  { id: 'season-5', name: 'Christmas & New Year', type: 'holiday', startDate: '2026-12-20', endDate: '2027-01-05', multiplier: 1.75 },
]

// Coupons
export const coupons: Coupon[] = [
  { id: 'coupon-1', code: 'WELCOME10', discountType: 'percentage', discountValue: 10, expirationDate: '2026-12-31', usageLimit: 100, usedCount: 42, active: true, createdAt: '2026-01-01' },
  { id: 'coupon-2', code: 'SUMMER15', discountType: 'percentage', discountValue: 15, expirationDate: '2026-08-31', usageLimit: 50, usedCount: 18, active: true, minStay: 3, createdAt: '2026-05-01' },
  { id: 'coupon-3', code: 'VIP20', discountType: 'percentage', discountValue: 20, expirationDate: '2026-06-30', usageLimit: 25, usedCount: 8, active: true, minStay: 5, createdAt: '2026-01-15' },
  { id: 'coupon-4', code: 'FLAT50', discountType: 'fixed', discountValue: 50, expirationDate: '2026-04-30', usageLimit: 200, usedCount: 156, active: true, createdAt: '2026-02-01' },
  { id: 'coupon-5', code: 'SPRING25', discountType: 'percentage', discountValue: 25, expirationDate: '2026-03-01', usageLimit: 30, usedCount: 30, active: false, createdAt: '2026-02-15' },
]

// Maintenance Tasks
export const maintenanceTasks: MaintenanceTask[] = [
  { id: 'maint-1', roomId: 'room-1', roomNumber: '103', status: 'completed', description: 'Fix leaking faucet', scheduledDate: '2026-03-08', completedAt: '2026-03-08T14:00:00', assignedTo: 'John Smith' },
  { id: 'maint-2', roomId: 'room-2', roomNumber: '203', status: 'in-progress', description: 'Replace air conditioning unit', scheduledDate: '2026-03-10', assignedTo: 'Mike Johnson', notes: 'Waiting for parts' },
  { id: 'maint-3', roomId: 'room-3', roomNumber: '302', status: 'out-of-service', description: 'Water damage repair', scheduledDate: '2026-03-05', assignedTo: 'John Smith', notes: 'Estimated completion: 3 days' },
  { id: 'maint-4', roomId: 'room-1', roomNumber: '104', status: 'scheduled', description: 'Annual HVAC inspection', scheduledDate: '2026-03-15', assignedTo: 'Mike Johnson' },
]

// Daily Stats (last 30 days)
export const dailyStats: DailyStats[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (29 - i))
  const dateStr = date.toISOString().split('T')[0]
  const isWeekend = date.getDay() === 0 || date.getDay() === 6
  
  return {
    date: dateStr,
    reservations: Math.floor(Math.random() * 8) + (isWeekend ? 5 : 2),
    revenue: Math.floor(Math.random() * 8000) + (isWeekend ? 6000 : 3000),
    occupancyRate: Math.floor(Math.random() * 30) + (isWeekend ? 65 : 45),
    avgNightlyRate: Math.floor(Math.random() * 150) + 250,
    checkIns: Math.floor(Math.random() * 5) + 1,
    checkOuts: Math.floor(Math.random() * 5) + 1,
  }
})

// Room Stats
export const roomStats: RoomStats[] = [
  { roomId: 'room-1', roomName: 'Standard Room', roomType: 'standard', totalBookings: 156, totalRevenue: 23400, avgStayLength: 2.3, occupancyRate: 72 },
  { roomId: 'room-2', roomName: 'Deluxe Room', roomType: 'deluxe', totalBookings: 124, totalRevenue: 31000, avgStayLength: 2.8, occupancyRate: 68 },
  { roomId: 'room-3', roomName: 'Family Suite', roomType: 'family-suite', totalBookings: 78, totalRevenue: 31200, avgStayLength: 4.2, occupancyRate: 58 },
  { roomId: 'room-4', roomName: 'Luxury Suite', roomType: 'luxury-suite', totalBookings: 52, totalRevenue: 33800, avgStayLength: 3.5, occupancyRate: 45 },
  { roomId: 'room-5', roomName: 'Penthouse Suite', roomType: 'penthouse', totalBookings: 24, totalRevenue: 28800, avgStayLength: 4.8, occupancyRate: 32 },
]

// Channel Stats
export const channelStats: ChannelStats[] = [
  { channelId: 'direct', channelName: 'Direct Booking', reservations: 89, revenue: 58500, percentage: 35 },
  { channelId: 'channel-2', channelName: 'Booking.com', reservations: 78, revenue: 65200, percentage: 28 },
  { channelId: 'channel-1', channelName: 'Airbnb', reservations: 45, revenue: 42500, percentage: 22 },
  { channelId: 'channel-3', channelName: 'Expedia', reservations: 32, revenue: 28400, percentage: 15 },
]

// Reviews
export const reviews: Review[] = [
  {
    id: '1631349364838882271',
    guestName: 'Jane',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/User/original/86b21a30-7428-4a8e-a348-f5905502c9d1.jpeg',
    reservationId: 'res-1',
    roomType: 'casa',
    rating: 5,
    comment: 'Nuestra estancia de un mes fue más de lo que esperábamos. Esta casa es adorable. Me sentí como en casa desde el primer día. Hermosamente decorado y actualizado. Barrio tranquilo y a 5 minutos en coche de Madeira Beach. Los anfitriones respondieron de inmediato a cualquier duda menor que tuviéramos.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2026-02-28',
  },
  {
    id: '1579932103126731326',
    guestName: 'Brendan',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/User/original/50cc5d04-b56a-4ddd-a7ae-9795c0a89de4.jpeg',
    reservationId: 'res-2',
    roomType: 'casa',
    rating: 5,
    comment: 'Mi familia tuvo una estancia increíble. A los niños les encantó la piscina climatizada y a nosotros nos encantó el jacuzzi privado. Utilizamos las bicicletas que nos proporcionaron para desplazarnos, porque todo estaba muy cerca. La casa estaba extremadamente limpia y acogedora.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-12-19',
  },
  {
    id: '1565347923697077173',
    guestName: 'Kim',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/cb793f97-04f5-49cc-ab97-265140b09685.jpg',
    reservationId: 'res-3',
    roomType: 'casa',
    rating: 4,
    comment: 'Supercomunicativo, los anfitriones eran encantadores. Justo lo que necesitábamos para nuestras vacaciones.',
    cleanliness: 4,
    location: 4,
    service: 4,
    value: 4,
    createdAt: '2025-11-29',
  },
  {
    id: '1557462157452668388',
    guestName: 'Shelley',
    guestAvatar: 'https://a0.muscache.com/im/Portrait/Avatars/messaging/b3e03835-ade9-4eb7-a0bb-2466ab9a534d.jpg?im_t=S&im_w=240&im_f=airbnb-cereal-medium.ttf&im_c=ffffff',
    reservationId: 'res-4',
    roomType: 'casa',
    rating: 5,
    comment: 'La casa de Angelica está bellamente decorada con un ambiente playero. Pudimos ir en bicicleta a bares, restaurantes y tiendas. Angelica fue muy receptiva y respondió rápidamente a todas mis preguntas.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-11-18',
  },
  {
    id: '1539256083714683989',
    guestName: 'Angela',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/User/original/b322b4da-8e76-4a48-86cb-4ea76d262583.jpeg',
    reservationId: 'res-5',
    roomType: 'casa',
    rating: 5,
    comment: 'El anfitrión respondió rápidamente. La casa era bonita.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-10-24',
  },
  {
    id: '1536416297532015016',
    guestName: 'Kennette',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/17717ccc-a7b0-434f-a41d-780667bf17e0.jpg',
    reservationId: 'res-1',
    roomType: 'casa',
    rating: 5,
    comment: '¡Disfrutamos mucho de nuestra estancia de fin de semana! Aunque no pasamos mucho tiempo en la casa, estaba limpia, cómoda y tenía todo lo que necesitábamos. La zona de la piscina era absolutamente hermosa y tranquila.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-10-20',
  },
  {
    id: '1526934009560979894',
    guestName: 'Michelle',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/User/original/d711f364-6aea-4087-8fda-adfbd333754a.jpeg',
    reservationId: 'res-2',
    roomType: 'casa',
    rating: 5,
    comment: '¡Nos encantó este alojamiento! Estaba a 5 minutos de la playa y Walmart estaba a la vuelta de la esquina. Los niños disfrutaron de la piscina... ¡Sin duda, volveríamos a repetir! La anfitriona también fue genial.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-10-07',
  },
  {
    id: '1515354565141340879',
    guestName: 'Christopher',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/d28674e6-a1d3-4000-a89e-eb1a71739d57.jpg',
    reservationId: 'res-3',
    roomType: 'casa',
    rating: 5,
    comment: '¡Gran estancia! ¡A mi familia le encantó este Airbnb! Los anfitriones fueron educados y la hospitalidad fue absolutamente impresionante, ¡volveremos!',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-09-21',
  },
  {
    id: '1506691483231641240',
    guestName: 'Eduardo',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/User/original/c20a09e1-99b3-43ba-ae73-810a740cd782.jpeg',
    reservationId: 'res-4',
    roomType: 'casa',
    rating: 5,
    comment: 'Ya me había alojado en San Petersburgo antes, pero el Airbnb de Angelica ha sido la experiencia más especial hasta la fecha. Todas las habitaciones tenían códigos QR con actividades divertidas. La casa era exactamente igual que en las fotos.',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-09-09',
  },
  {
    id: '1505216952857874565',
    guestName: 'Lucy',
    guestAvatar: 'https://a0.muscache.com/im/pictures/user/232918a1-a94a-4fe8-80e6-ab307e7bda0f.jpg',
    reservationId: 'res-5',
    roomType: 'casa',
    rating: 5,
    comment: '¡Tengo una estancia increíble! También estaba celebrando mi aniversario y tuvieron un pequeño detalle. ¡Con una botella de champán y una tarjeta! Eso fue increíble.❤️',
    cleanliness: 5,
    location: 5,
    service: 5,
    value: 5,
    createdAt: '2025-09-07',
  }
]

// Generate availability for next 60 days
export function generateAvailability(): RoomAvailability[] {
  const availability: RoomAvailability[] = []
  const today = new Date()
  
  rooms.forEach(room => {
    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      
      // Random availability
      const availableRooms = Math.floor(Math.random() * (room.inventory + 1))
      let status: RoomAvailability['status'] = 'available'
      
      if (availableRooms === 0) {
        status = 'sold-out'
      } else if (availableRooms === 1) {
        status = 'limited'
      } else if (Math.random() < 0.05) {
        status = 'blocked'
      }
      
      // Calculate seasonal price
      let priceMultiplier = 1
      const isWeekend = date.getDay() === 0 || date.getDay() === 6
      if (isWeekend) priceMultiplier *= 1.15
      
      seasonalPricing.forEach(season => {
        const start = new Date(season.startDate)
        const end = new Date(season.endDate)
        if (date >= start && date <= end) {
          priceMultiplier = season.multiplier
        }
      })
      
      availability.push({
        roomId: room.id,
        date: dateStr,
        available: status === 'blocked' ? 0 : availableRooms,
        status,
        price: Math.round(room.basePrice * priceMultiplier),
      })
    }
  })
  
  return availability
}

export const roomAvailability = generateAvailability()

// Special Offers
export const specialOffers = [
  {
    id: 'offer-1',
    title: 'Early Bird Special',
    description: 'Book 30 days in advance and save 20% on your stay',
    discount: 20,
    validUntil: '2026-12-31',
    code: 'EARLYBIRD20',
  },
  {
    id: 'offer-2',
    title: 'Extended Stay Discount',
    description: 'Stay 7 nights or more and get 15% off your entire booking',
    discount: 15,
    validUntil: '2026-06-30',
    code: 'STAY7SAVE15',
  },
  {
    id: 'offer-3',
    title: 'Honeymoon Package',
    description: 'Includes champagne, spa treatment, and romantic dinner for two',
    discount: 0,
    validUntil: '2026-12-31',
    code: 'HONEYMOON',
    extras: ['Champagne on arrival', 'Couples spa treatment', 'Romantic dinner'],
  },
]

// FAQs
export const faqs = [
  {
    question: 'What time is check-in and check-out?',
    answer: 'Check-in is at 4:00 PM and check-out is at 10:00 AM. Early check-in or late check-out may be available upon request, subject to availability.',
  },
  {
    question: 'Is parking available?',
    answer: 'Yes, we offer free on-site driveway parking for your convenience. There is also free street parking available.',
  },
  {
    question: 'Do you allow pets?',
    answer: 'Yes, we are pet-friendly! Only one pet per booking is permitted. Please note that pets are strictly not allowed in the pool; a $150 filter replacement fee may apply if this policy is not followed.',
  },
  {
    question: 'Is the pool heated?',
    answer: 'Yes, the pool can be heated! Pool heating is available from October 1st to May 1st for an additional fee of $20 per day.',
  },
  {
    question: 'What are the house rules regarding gatherings?',
    answer: 'To respect our neighbors and maintain a peaceful environment, parties and large gatherings are not permitted. A $999 fee may be charged if this policy is violated.',
  },
  {
    question: 'Is there a cleaning fee or other fees?',
    answer: 'A standard cleaning fee is included in your booking. Please ensure trash bins are placed outside at the end of your stay to avoid a $50 fee.',
  },
  {
    question: 'How close is the beach?',
    answer: 'Areia Bela is ideally located just a 5-minute walk from the beautiful Madeira Beach.',
  },
  {
    question: 'Do you provide beach gear?',
    answer: 'Yes! We provide beach towels, chairs, umbrellas, sunscreen, and even a beach stroller to make your outings effortless.',
  },
]

// ============= ADMIN PANEL MOCK DATA =============

// Admin Rooms (for room management page)
export const mockRooms: AdminRoom[] = [
  { id: 'ar-1', roomNumber: '101', name: 'Standard Garden View', type: 'Standard Room', floor: 1, status: 'available', basePrice: 150, maxOccupancy: 2, size: 28, amenities: ['WiFi', 'TV', 'AC'], images: [], description: 'Cozy room with garden views' },
  { id: 'ar-2', roomNumber: '102', name: 'Standard City View', type: 'Standard Room', floor: 1, status: 'occupied', basePrice: 160, maxOccupancy: 2, size: 28, amenities: ['WiFi', 'TV', 'AC'], images: [], description: 'Comfortable room with city views' },
  { id: 'ar-3', roomNumber: '103', name: 'Standard Queen', type: 'Standard Room', floor: 1, status: 'cleaning', basePrice: 150, maxOccupancy: 2, size: 28, amenities: ['WiFi', 'TV', 'AC'], images: [], description: 'Standard room with queen bed' },
  { id: 'ar-4', roomNumber: '201', name: 'Deluxe Ocean View', type: 'Deluxe Room', floor: 2, status: 'available', basePrice: 250, maxOccupancy: 2, size: 38, amenities: ['WiFi', 'TV', 'AC', 'Balcony', 'Ocean View'], images: [], description: 'Spacious room with ocean views' },
  { id: 'ar-5', roomNumber: '202', name: 'Deluxe King', type: 'Deluxe Room', floor: 2, status: 'occupied', basePrice: 260, maxOccupancy: 2, size: 38, amenities: ['WiFi', 'TV', 'AC', 'Balcony'], images: [], description: 'Elegant room with king bed' },
  { id: 'ar-6', roomNumber: '203', name: 'Deluxe Pool View', type: 'Deluxe Room', floor: 2, status: 'maintenance', basePrice: 270, maxOccupancy: 3, size: 42, amenities: ['WiFi', 'TV', 'AC', 'Balcony', 'Pool View'], images: [], description: 'Deluxe room overlooking the pool' },
  { id: 'ar-7', roomNumber: '301', name: 'Family Suite', type: 'Family Suite', floor: 3, status: 'available', basePrice: 400, maxOccupancy: 4, size: 55, amenities: ['WiFi', 'TV', 'AC', 'Kitchen', 'Living Room'], images: [], description: 'Spacious suite perfect for families' },
  { id: 'ar-8', roomNumber: '401', name: 'Luxury Suite', type: 'Luxury Suite', floor: 4, status: 'occupied', basePrice: 650, maxOccupancy: 2, size: 75, amenities: ['WiFi', 'TV', 'AC', 'Jacuzzi', 'Butler Service'], images: [], description: 'Luxurious suite with premium amenities' },
  { id: 'ar-9', roomNumber: '501', name: 'Presidential Suite', type: 'Penthouse', floor: 5, status: 'available', basePrice: 1200, maxOccupancy: 4, size: 150, amenities: ['WiFi', 'TV', 'AC', 'Private Pool', 'Chef Kitchen'], images: [], description: 'The ultimate luxury experience' },
]

// Admin Reservations
export const mockReservations: AdminReservation[] = [
  { id: 'res-1', confirmationNumber: 'GAR-2026-001', guestName: 'Emily Johnson', guestEmail: 'emily@email.com', roomNumber: '401', checkIn: '2026-03-15', checkOut: '2026-03-20', status: 'confirmed', paymentStatus: 'paid', totalAmount: 3575, channel: 'Direct', createdAt: '2026-02-20' },
  { id: 'res-2', confirmationNumber: 'GAR-2026-002', guestName: 'Michael Chen', guestEmail: 'michael@email.com', roomNumber: '201', checkIn: '2026-03-10', checkOut: '2026-03-12', status: 'checked-in', paymentStatus: 'paid', totalAmount: 575, channel: 'Booking.com', createdAt: '2026-02-15' },
  { id: 'res-3', confirmationNumber: 'GAR-2026-003', guestName: 'Sofia Rodriguez', guestEmail: 'sofia@email.com', roomNumber: '301', checkIn: '2026-03-18', checkOut: '2026-03-25', status: 'pending', paymentStatus: 'pending', totalAmount: 3220, channel: 'Airbnb', createdAt: '2026-03-01' },
  { id: 'res-4', confirmationNumber: 'GAR-2026-004', guestName: 'James Wilson', guestEmail: 'james@email.com', roomNumber: '501', checkIn: '2026-03-05', checkOut: '2026-03-08', status: 'checked-out', paymentStatus: 'paid', totalAmount: 3960, channel: 'Direct', createdAt: '2026-02-10' },
  { id: 'res-5', confirmationNumber: 'GAR-2026-005', guestName: 'Yuki Tanaka', guestEmail: 'yuki@email.com', roomNumber: '101', checkIn: '2026-03-12', checkOut: '2026-03-14', status: 'confirmed', paymentStatus: 'partial', totalAmount: 365, channel: 'Expedia', createdAt: '2026-03-05' },
  { id: 'res-6', confirmationNumber: 'GAR-2026-006', guestName: 'Alexander Müller', guestEmail: 'alex@email.com', roomNumber: '202', checkIn: '2026-03-20', checkOut: '2026-03-27', status: 'confirmed', paymentStatus: 'paid', totalAmount: 2025, channel: 'Booking.com', createdAt: '2026-02-25' },
]

// Admin Guests
export const mockGuests: AdminGuest[] = [
  { id: 'g-1', firstName: 'Emily', lastName: 'Johnson', email: 'emily@email.com', phone: '+1 555-234-5678', nationality: 'United States', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', isVIP: true, loyaltyTier: 'platinum', totalStays: 12, totalSpent: 18500, lastStay: '2026-02-20', createdAt: '2024-01-15' },
  { id: 'g-2', firstName: 'Michael', lastName: 'Chen', email: 'michael@email.com', phone: '+1 555-345-6789', nationality: 'Canada', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', isVIP: false, loyaltyTier: 'gold', totalStays: 5, totalSpent: 4800, lastStay: '2026-03-10', createdAt: '2024-03-20' },
  { id: 'g-3', firstName: 'Sofia', lastName: 'Rodriguez', email: 'sofia@email.com', phone: '+34 612-345-678', nationality: 'Spain', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100', isVIP: false, loyaltyTier: 'silver', totalStays: 3, totalSpent: 3200, lastStay: '2026-01-15', createdAt: '2024-06-10' },
  { id: 'g-4', firstName: 'James', lastName: 'Wilson', email: 'james@email.com', phone: '+44 7911-123456', nationality: 'United Kingdom', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', isVIP: true, loyaltyTier: 'platinum', totalStays: 18, totalSpent: 42500, lastStay: '2026-03-08', createdAt: '2023-08-22' },
  { id: 'g-5', firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki@email.com', phone: '+81 90-1234-5678', nationality: 'Japan', isVIP: false, loyaltyTier: 'bronze', totalStays: 1, totalSpent: 365, createdAt: '2026-03-05' },
]

// Staff
export const mockStaff: Staff[] = [
  { id: 's-1', name: 'Maria Santos', email: 'maria@areiabela.com', role: 'housekeeper', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100', phone: '+1 555-111-1111', status: 'active' },
  { id: 's-2', name: 'Carlos Rivera', email: 'carlos@areiabela.com', role: 'housekeeper', avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100', phone: '+1 555-222-2222', status: 'active' },
  { id: 's-3', name: 'Ana Garcia', email: 'ana@areiabela.com', role: 'housekeeper', avatar: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=100', phone: '+1 555-333-3333', status: 'active' },
  { id: 's-4', name: 'John Smith', email: 'john@areiabela.com', role: 'maintenance', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', phone: '+1 555-444-4444', status: 'active' },
  { id: 's-5', name: 'Mike Johnson', email: 'mike@areiabela.com', role: 'maintenance', phone: '+1 555-555-5555', status: 'active' },
  { id: 's-6', name: 'Sarah Lee', email: 'sarah@areiabela.com', role: 'receptionist', phone: '+1 555-666-6666', status: 'active' },
  { id: 's-7', name: 'David Brown', email: 'david@areiabela.com', role: 'manager', phone: '+1 555-777-7777', status: 'active' },
]

// Housekeeping Tasks
export const mockHousekeepingTasks: AdminHousekeepingTask[] = [
  { id: 'hk-1', roomNumber: '101', floor: 1, type: 'stayover', status: 'completed', priority: 'normal', assignedTo: 'Maria Santos', createdAt: '2026-03-10' },
  { id: 'hk-2', roomNumber: '102', floor: 1, type: 'checkout', status: 'pending', priority: 'high', assignedTo: 'Maria Santos', notes: 'VIP guest checkout - extra attention needed', createdAt: '2026-03-10' },
  { id: 'hk-3', roomNumber: '103', floor: 1, type: 'stayover', status: 'in-progress', priority: 'normal', assignedTo: 'Carlos Rivera', createdAt: '2026-03-10' },
  { id: 'hk-4', roomNumber: '201', floor: 2, type: 'checkout', status: 'pending', priority: 'normal', assignedTo: 'Carlos Rivera', createdAt: '2026-03-10' },
  { id: 'hk-5', roomNumber: '202', floor: 2, type: 'deep', status: 'inspected', priority: 'low', assignedTo: 'Ana Garcia', createdAt: '2026-03-10' },
  { id: 'hk-6', roomNumber: '301', floor: 3, type: 'turndown', status: 'pending', priority: 'normal', assignedTo: 'Ana Garcia', createdAt: '2026-03-10' },
  { id: 'hk-7', roomNumber: '401', floor: 4, type: 'checkout', status: 'completed', priority: 'urgent', assignedTo: 'Maria Santos', notes: 'Penthouse checkout - full service clean', createdAt: '2026-03-10' },
]

// Admin Channels
export const mockChannels: AdminChannel[] = [
  { id: 'ch-1', name: 'Booking.com', status: 'active', commission: 15, bookingsThisMonth: 78, revenueThisMonth: 65200, lastSync: '5 min ago' },
  { id: 'ch-2', name: 'Expedia', status: 'active', commission: 15, bookingsThisMonth: 32, revenueThisMonth: 28400, lastSync: '12 min ago' },
  { id: 'ch-3', name: 'Airbnb', status: 'active', commission: 3, bookingsThisMonth: 45, revenueThisMonth: 42500, lastSync: '8 min ago' },
  { id: 'ch-4', name: 'Hotels.com', status: 'paused', commission: 18, bookingsThisMonth: 12, revenueThisMonth: 9800, lastSync: '2 hours ago' },
  { id: 'ch-5', name: 'TripAdvisor', status: 'active', commission: 12, bookingsThisMonth: 8, revenueThisMonth: 7200, lastSync: '20 min ago' },
]

// Admin Coupons
export const mockCoupons: AdminCoupon[] = [
  { id: 'c-1', code: 'WELCOME10', description: '10% off for first-time guests', type: 'percentage', value: 10, minBooking: 200, maxUses: 100, usedCount: 42, validFrom: '2026-01-01', validUntil: '2026-12-31', status: 'active' },
  { id: 'c-2', code: 'SUMMER25', description: '25% off summer stays', type: 'percentage', value: 25, minBooking: 500, maxUses: 50, usedCount: 18, validFrom: '2026-06-01', validUntil: '2026-08-31', status: 'active' },
  { id: 'c-3', code: 'FLAT100', description: '$100 off any booking', type: 'fixed', value: 100, minBooking: 400, maxUses: 200, usedCount: 156, validFrom: '2026-02-01', validUntil: '2026-04-30', status: 'active' },
  { id: 'c-4', code: 'VIP20', description: 'VIP member exclusive 20% off', type: 'percentage', value: 20, usedCount: 8, validFrom: '2026-01-01', validUntil: '2026-12-31', status: 'active' },
  { id: 'c-5', code: 'SPRING15', description: 'Spring sale discount', type: 'percentage', value: 15, maxUses: 30, usedCount: 30, validFrom: '2026-02-15', validUntil: '2026-03-01', status: 'expired' },
]

// Pricing Rules
export const mockPricingRules: PricingRule[] = [
  { id: 'pr-1', name: 'Weekend Premium', type: 'Day of Week', condition: 'Friday, Saturday', adjustment: 20, active: true },
  { id: 'pr-2', name: 'Early Bird Discount', type: 'Advance Purchase', condition: '30+ days in advance', adjustment: -15, active: true },
  { id: 'pr-3', name: 'Last Minute Deal', type: 'Advance Purchase', condition: 'Within 3 days', adjustment: -10, active: true },
  { id: 'pr-4', name: 'High Occupancy Surge', type: 'Occupancy Based', condition: 'Occupancy > 85%', adjustment: 25, active: true },
  { id: 'pr-5', name: 'Extended Stay Discount', type: 'Length of Stay', condition: '7+ nights', adjustment: -20, active: true },
  { id: 'pr-6', name: 'Low Season Rate', type: 'Date Range', condition: 'Jan 5 - Feb 28', adjustment: -15, active: false },
]

// Admin Maintenance Tasks
export const mockMaintenanceTasks: AdminMaintenanceTask[] = [
  { id: 'm-1', title: 'Fix leaking faucet', description: 'Bathroom faucet is dripping continuously', location: 'Room 103', category: 'plumbing', priority: 'normal', status: 'completed', assignedTo: 'John Smith', createdAt: '2026-03-08', completedAt: '2026-03-08' },
  { id: 'm-2', title: 'AC unit not cooling', description: 'Air conditioning unit not reaching set temperature', location: 'Room 203', category: 'hvac', priority: 'high', status: 'in-progress', assignedTo: 'Mike Johnson', createdAt: '2026-03-09' },
  { id: 'm-3', title: 'Replace broken lamp', location: 'Room 102', category: 'electrical', priority: 'low', status: 'pending', createdAt: '2026-03-10' },
  { id: 'm-4', title: 'Water damage repair', description: 'Ceiling has water stains from roof leak', location: 'Room 302', category: 'structural', priority: 'urgent', status: 'in-progress', assignedTo: 'John Smith', createdAt: '2026-03-05' },
  { id: 'm-5', title: 'Annual HVAC inspection', location: 'All Rooms', category: 'hvac', priority: 'normal', status: 'pending', assignedTo: 'Mike Johnson', createdAt: '2026-03-01' },
  { id: 'm-6', title: 'Fix stuck window', location: 'Room 401', category: 'furniture', priority: 'normal', status: 'pending', createdAt: '2026-03-10' },
]

// Properties (for multi-property management)
export const mockProperties: Property[] = [
  { 
    id: 'prop-1', 
    name: 'Areia Bela', 
    location: { address: 'St. Petersburg, Florida', city: 'St. Petersburg', country: 'United States' }, 
    images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800'],
    totalRooms: 45, 
    occupiedRooms: 32, 
    rating: 4.8, 
    status: 'active' 
  },
  { 
    id: 'prop-2', 
    name: 'Azure Mountain Lodge', 
    location: { address: '456 Mountain View Road', city: 'Aspen', country: 'USA' }, 
    images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'],
    totalRooms: 28, 
    occupiedRooms: 18, 
    rating: 4.6, 
    status: 'active' 
  },
  { 
    id: 'prop-3', 
    name: 'Azure City Hotel', 
    location: { address: '789 Downtown Ave', city: 'New York', country: 'USA' }, 
    images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800'],
    totalRooms: 120, 
    occupiedRooms: 95, 
    rating: 4.5, 
    status: 'active' 
  },
]
