import data from "@/datos.json";

type RawReview = {
  id: string;
  rating: number;
  comments: string;
  localizedDate?: string;
  author?: { firstName?: string; pictureUrl?: string };
};

type RawListing = {
  name: string;
  city: string;
  address: string;
  country: string;
  numberOfGuests: number;
  stars: number;
  amenities: string[];
  photos: Array<{ id: number; large: string; caption?: string }>;
  reviews: { reviews: RawReview[]; reviewsCount: number };
  location: { lat: number; lng: number };
  sectionedDescription: { summary: string; description: string };
  primaryHost: {
    name: string;
    firstName: string;
    about: string;
    pictureUrl: string;
    languages: string[];
    isSuperhost: boolean;
    responseRateWithoutNa?: string;
    responseTimeWithoutNa?: string;
    memberSinceFullStr?: string;
  };
  bedroomLabel: string;
  bedLabel: string;
  bathroomLabel: string;
  pricing: {
    price_per_night: number;
    cleaning_fee: number;
    service_fee_percent: number;
    taxes_percent: number;
    extras: Array<{ id: string; label: string; price_per_night: number }>;
  };
};

const listing = (data as RawListing[])[0];
const hostSinceYearMatch = listing.primaryHost.memberSinceFullStr?.match(/(\d{4})/);
const hostSinceYear = hostSinceYearMatch ? Number(hostSinceYearMatch[1]) : 2019;
const originalPricePerNight = Math.round(listing.pricing.price_per_night * 1.15);

export const propertyData = {
  id: "1489399156507737323",
  name: listing.name,
  city: listing.city,
  address: listing.address,
  country: listing.country,
  capacity: listing.numberOfGuests,
  rating: listing.stars,
  summary: listing.sectionedDescription.summary,
  description: listing.sectionedDescription.description,
  amenities: listing.amenities,
  photos: listing.photos,
  location: listing.location,
  host: listing.primaryHost,
  hostSinceYear,
  bedroomLabel: listing.bedroomLabel,
  bedLabel: listing.bedLabel,
  bathroomLabel: listing.bathroomLabel,
  pricing: {
    ...listing.pricing,
    original_price_per_night: originalPricePerNight,
  },
  reviewsCount: listing.reviews.reviewsCount,
  reviews: listing.reviews.reviews,
};

