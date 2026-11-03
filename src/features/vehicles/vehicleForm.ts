import { type Row } from './vehicle.types';

/** The vehicle form shared by the add-vehicle wizard and the vehicle page: field state, and conversion to and from the API. */

export const CATEGORIES = ['Supercar', 'Convertible', 'SUV', 'Luxury'];
export const TRANSMISSIONS = ['Automatic', 'Manual', 'Semi-automatic'];
export const FUEL_TYPES = ['Petrol', 'Diesel', 'Hybrid', 'Plug-in hybrid', 'Electric'];

export const blankVehicle = {
  fleetRef: '', make: '', model: '', year: new Date().getFullYear() as number | null, category: 'Supercar', colour: '', transmission: 'Automatic', seats: 2 as number | null,
  power: '', topSpeed: '', fuelType: '', doors: null as number | null, engine: '', mileage: null as number | null,
  city: '', area: '', description: '', amenities: '', pricePerHourPence: null as number | null,
  deliveryAvailable: false, deliveryFeePence: 0 as number | null, deliveryRadiusMiles: 0 as number | null, stationaryAvailable: true,
  baseAddress: '', deliveryPricing: 'flat', deliveryPerMilePence: 0 as number | null, deliveryFreeMiles: 0 as number | null, deliveryMinPence: 0 as number | null, deliveryRoundTrip: false, chauffeurChargeType: 'fixed',
  minHours: 1 as number | null, maxHours: 6 as number | null, bufferMinutes: 0 as number | null, chauffeurAvailable: false, chauffeurFeePence: 0 as number | null, selfDriveAvailable: true,
  depositPence: 0 as number | null, operationalStatus: 'active',
  /** Spec values this form does not edit, kept as they are. */
  specsOther: {} as Record<string, unknown>,
};
export type VehicleForm = typeof blankVehicle;

export const vehicleFromRow = (r: Row): VehicleForm => {
  const { fuelType, doors, engine, mileage, ...specsOther } = (r.specs ?? {}) as Record<string, unknown>;
  return {
    fleetRef: r.fleet_ref ?? '', make: r.make, model: r.model, year: r.year, category: r.category, colour: r.colour ?? '', transmission: r.transmission ?? '', seats: r.seats,
    power: r.power ?? '', topSpeed: r.top_speed ?? '', fuelType: typeof fuelType === 'string' ? fuelType : '', doors: typeof doors === 'number' ? doors : null,
    engine: typeof engine === 'string' ? engine : '', mileage: typeof mileage === 'number' ? mileage : null,
    city: r.city, area: r.area ?? '', description: r.description, amenities: (r.amenities ?? []).join(', '),
    pricePerHourPence: r.price_per_hour_pence, deliveryAvailable: r.delivery_available, deliveryFeePence: r.delivery_fee_pence, deliveryRadiusMiles: r.delivery_radius_miles,
    baseAddress: r.base_address ?? '', deliveryPricing: r.delivery_pricing, deliveryPerMilePence: r.delivery_per_mile_pence, deliveryFreeMiles: r.delivery_free_miles, deliveryMinPence: r.delivery_min_pence, deliveryRoundTrip: r.delivery_round_trip, chauffeurChargeType: r.chauffeur_charge_type,
    stationaryAvailable: r.stationary_available, minHours: r.min_hours, maxHours: r.max_hours, bufferMinutes: r.buffer_minutes, chauffeurAvailable: r.chauffeur_available,
    chauffeurFeePence: r.chauffeur_fee_pence, depositPence: r.deposit_pence, operationalStatus: r.operational_status, selfDriveAvailable: r.self_drive_available,
    specsOther,
  };
};

export const vehicleBody = (f: VehicleForm) => ({
  fleetRef: f.fleetRef.trim() || null, make: f.make.trim(), model: f.model.trim(), year: f.year, category: f.category, colour: f.colour.trim() || null,
  transmission: f.transmission.trim() || null, seats: f.seats, power: f.power.trim() || null, topSpeed: f.topSpeed.trim() || null, city: f.city.trim(), area: f.area.trim() || null,
  specs: {
    ...f.specsOther,
    ...(f.fuelType ? { fuelType: f.fuelType } : {}), ...(f.doors != null ? { doors: f.doors } : {}),
    ...(f.engine.trim() ? { engine: f.engine.trim() } : {}), ...(f.mileage != null ? { mileage: f.mileage } : {}),
  },
  description: f.description, amenities: f.amenities.split(',').map((s) => s.trim()).filter(Boolean), pricePerHourPence: f.pricePerHourPence,
  deliveryAvailable: f.deliveryAvailable, deliveryFeePence: f.deliveryFeePence ?? 0, deliveryRadiusMiles: f.deliveryRadiusMiles ?? 0,
  baseAddress: f.baseAddress.trim() || null, deliveryPricing: f.deliveryPricing, deliveryPerMilePence: f.deliveryPerMilePence ?? 0, deliveryFreeMiles: f.deliveryFreeMiles ?? 0, deliveryMinPence: f.deliveryMinPence ?? 0, deliveryRoundTrip: f.deliveryRoundTrip, chauffeurChargeType: f.chauffeurChargeType, stationaryAvailable: f.stationaryAvailable,
  minHours: f.minHours, maxHours: f.maxHours, bufferMinutes: f.bufferMinutes ?? 0, chauffeurAvailable: f.chauffeurAvailable, chauffeurFeePence: f.chauffeurFeePence ?? 0,
  depositPence: f.depositPence ?? 0, operationalStatus: f.operationalStatus, selfDriveAvailable: f.selfDriveAvailable,
});

const thisYear = new Date().getFullYear();

/** Field errors for each wizard step (the API checks the same rules again). */
export function vehicleErrors(f: VehicleForm) {
  const basics: Record<string, string> = {};
  if (!f.make.trim()) basics.make = 'Enter the brand';
  if (!f.model.trim()) basics.model = 'Enter the model';
  if (f.year == null) basics.year = 'Enter the year';
  else if (f.year < 1990 || f.year > thisYear + 1) basics.year = `Enter a year between 1990 and ${thisYear + 1}`;
  if (f.description.length > 4000) basics.description = 'Keep the description under 4000 characters';
  const specs: Record<string, string> = {};
  if (f.seats == null || f.seats < 1 || f.seats > 20) specs.seats = 'Enter between 1 and 20 seats';
  if (f.doors != null && (f.doors < 1 || f.doors > 8)) specs.doors = 'Enter between 1 and 8 doors';
  if (f.mileage != null && f.mileage < 0) specs.mileage = 'Mileage cannot be negative';
  const pricing: Record<string, string> = {};
  if (f.pricePerHourPence == null) pricing.pricePerHourPence = 'Enter the hourly price';
  if (f.minHours == null || f.minHours < 1) pricing.minHours = 'At least 1 hour';
  if (f.maxHours == null || f.maxHours < 1) pricing.maxHours = 'At least 1 hour';
  else if (f.minHours != null && f.maxHours < f.minHours) pricing.maxHours = 'Must be at least the minimum';
  const availability: Record<string, string> = {};
  if (!f.city.trim()) availability.city = 'Enter the city the car is based in';
  if (!f.selfDriveAvailable && !f.chauffeurAvailable) availability.driving = 'Offer the car self-drive, with a driver, or both';
  if (f.chauffeurAvailable && f.chauffeurFeePence == null) availability.chauffeurFeePence = 'Enter the driver charge (0 if included)';
  return { basics, specs, pricing, availability };
}
