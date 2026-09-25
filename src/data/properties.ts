import shared from "../../shared/estate-data.json"

export interface Property {
  id: string
  name: string
  location: string
  neighborhood: string
  city: string
  price: string
  priceNum: number
  type: "villa" | "apartment" | "penthouse" | "duplex"
  listingType: "buy" | "rent"
  beds: number
  baths: number
  area: number
  image: string
  images: string[]
  description: string
  amenities: string[]
  status: "available" | "under-contract" | "new"
  year: number
  agentId: string
}

export interface Agent {
  id: string
  name: string
  role: string
  languages: string
  experience: number
  properties: number
  image: string
  phone: string
  email: string
}

export interface Neighborhood {
  id: string
  name: string
  tagline: string
  count: number
  avgPrice: string
  avgPriceNum: number
  coordinates: [number, number]
  description: string
  image: string
}

export interface ViewingRequest {
  id: string
  propertyId: string
  propertyName?: string
  name: string
  email: string
  phone?: string
  date: string
  time?: string | null
  message?: string
  status?: string
  createdAt: string
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  phone?: string
  subject?: string
  message: string
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
  role?: "USER" | "AGENT" | "ADMIN"
  createdAt: string
}

export const properties: Property[] = shared.properties as Property[]
export const agents: Agent[] = shared.agents as Agent[]
export const neighborhoods: Neighborhood[] =
  shared.neighborhoods as Neighborhood[]

export const PROPERTY_STATUS_LABELS: Record<Property["status"], string> = {
  available: "Available",
  "under-contract": "Under Contract",
  new: "New",
}

export const PROPERTY_STATUS_COLORS: Record<Property["status"], string> = {
  available: "#C9A96E",
  "under-contract": "#A09890",
  new: "#4CAF50",
}
