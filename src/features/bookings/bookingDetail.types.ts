/** Shapes returned by GET /admin/bookings/:id, shared by the booking page and its dialogs. */
type Finance = {
  currency: string; quotedTotalPence: number; confirmedChargesPence: number; finalTotalPence: number; depositRequiredPence: number; depositMode: boolean; depositPaid: boolean;
  paidPence: number; refundedPence: number; netPaidPence: number; balanceDuePence: number; dueNowPence: number; creditPence: number; paymentStatus: string;
  delivery: null | { status: 'pending' | 'confirmed'; amountPence: number; distanceMiles: number | null; ratePerMilePence: number | null };
};
export type Charge = {
  id: string; kind: 'delivery' | 'adjustment'; status: 'pending' | 'confirmed' | 'void'; amountPence: number; description: string; address: string | null; distanceMiles: number | null;
  ratePerMilePence: number | null; calculatedPence: number | null; createdAt: string; approvedBy: string | null; voidedAt: string | null; voidedBy: string | null; voidReason: string | null;
};
type Doc = { id: string; number: string; kind: string; amountPence: number; bookingTotalPence: number; paidToDatePence: number; balancePence: number; issuedAt: string };
export type Payment = {
  id: string; amountPence: number; method: string; source: string; purpose: string; status: string; providerRef: string | null; manualReference: string | null; note: string | null;
  paidAt: string | null; verified: boolean; createdAt: string; recordedBy: string | null; statusChangedBy: string | null; receiptId: string | null; receiptNumber: string | null;
};
export type Detail = {
  id: string; ref: string; status: string; paymentStatus: string; startAt: string; endAt: string; hours: number; experience: string; address: string | null; chauffeur: boolean;
  driverOption: 'with_driver' | 'self_drive'; source: 'customer_app' | 'admin'; createdByName: string | null;
  dispatchStatus: string; totalPence: number; paidPence: number; refundedPence: number; depositDuePence: number; occasion: string | null; children: number | null;
  customerNotes: string | null; pickupAddress: string | null; dropoffAddress: string | null; points: { address: Pt | null; pickup: Pt | null; dropoff: Pt | null }; routeMiles: number | null; deliveryMiles: number | null; consents: { guardian?: boolean; terms?: boolean; marketingPhotos?: boolean; at?: string } | null; cancelReason: string | null; holdExpiresAt: string | null; createdAt: string;
  customer: { id: string; name: string; email: string; phone: string | null }; vehicle: { id: string; name: string };
  eventType: { id: string; title: string } | null; driver: { id: string; name: string } | null;
  pricing: { lines: { key: string; label: string; amountPence: number }[]; discountPence: number; serviceFeePence: number; vatPence: number; totalPence: number; depositDuePence: number; offer: { title: string; code: string | null } | null; deliveryEstimate?: { amountPence: number | null; label: string } | null };
  emails: { kind: string; recipient?: 'customer' | 'owner'; status: string; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string }[];
  events: { id: number; actorType: string; actorName: string | null; action: string; from: string | null; to: string | null; reason: string | null; createdAt: string; meta: any; bookingRef?: string }[];
  payments: Payment[];
  refunds: { id: string; paymentId: string; amountPence: number; reason: string | null; status: string; createdAt: string }[];
  driverAssignments: { id: string; driverName: string; active: boolean; createdAt: string; endedAt: string | null; endedReason: string | null }[];
  cancellationPolicy: { percent: number; refundPence: number; hoursAhead: number };
  finance: Finance; charges: Charge[]; invoices: Doc[]; defaultDeliveryRatePence: number;
  order: OrderInfo; extensions: Extension[];
  addons: { id: string; name: string; pricingType: string; unitPricePence: number; quantity: number; hours: number | null; totalPence: number }[];
};
export type Pt = { lat: number; lng: number };
type OrderInfo = {
  id: string; ref: string; status: string; subtotalPence: number; discountPence: number; taxablePence: number; taxPence: number; serviceFeePence: number; quotedTotalPence: number; totalPence: number;
  tax: { enabled: boolean; rateBp: number; policy: string; label: string };
  offers: { offerId: string | null; title: string; code: string | null; discountType: string; discountValue: number; appliesTo: string; discountPence: number; conditions: string | null }[];
  items: { id: string; ref: string; status: string; startAt: string; endAt: string; hours: number; vehicle: string; category: string; pricePerHourPence: number; subtotalPence: number; discountPence: number;
    taxPence: number; totalPence: number; extensions: number; lines: { key: string; label: string; amountPence: number }[] | null }[];
};
export type Extension = {
  id: string; status: string; previousEndAt: string; requestedEndAt: string; additionalHours: number; priceDifferencePence: number | null; taxDifferencePence: number | null;
  requestedBy: string; createdAt: string; decidedAt: string | null; decisionReason: string | null; customerMessage: string | null; conflictReason?: string | null; decidedBy?: string | null;
};
export type ExtQuote = {
  available: boolean; reason: string | null; maxAvailableHours: number | null; newEndAt: string; additionalPence: number; previousTotalPence: number; newTotalPence: number;
  priceDifferencePence: number; taxDifferencePence: number; taxLabel: string; paidPence: number; balanceAfterPence: number; lines: { key: string; label: string; amountPence: number }[];
};
export type Dialog =
  | { t: 'status'; to: string; label: string; reason?: boolean; danger?: boolean; unpaidOption?: boolean }
  | { t: 'reschedule' } | { t: 'vehicle' } | { t: 'driver' } | { t: 'removeDriver' } | { t: 'manualPay' } | { t: 'refund'; paymentId: string; max: number }
  | { t: 'delivery' } | { t: 'adjust' } | { t: 'voidCharge'; charge: Charge } | { t: 'payStatus'; payment: Payment }
  | { t: 'extend' } | { t: 'addVehicle' } | { t: 'decideExt'; ext: Extension; approve: boolean };
