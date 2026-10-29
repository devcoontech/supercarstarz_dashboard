import { FiBarChart2, FiCalendar, FiClipboard, FiCreditCard, FiGrid, FiPackage, FiPercent, FiSettings, FiStar, FiTag, FiTruck, FiUser, FiUsers } from 'react-icons/fi';
import { useApi } from './api';
import { useAuth } from './auth';
import { Loading } from './components/forms';
import { Shell, type NavItem } from './components/Shell';
import Addons from './pages/Addons';
import { go, useRoute } from './nav';
import BookingDetail from './pages/BookingDetail';
import Bookings from './pages/Bookings';
import CalendarPage from './pages/CalendarPage';
import Customers from './pages/Customers';
import Drivers from './pages/Drivers';
import Events from './pages/Events';
import Login from './pages/Login';
import Offers from './pages/Offers';
import Overview from './pages/Overview';
import Payments from './pages/Payments';
import Pricing from './pages/Pricing';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import VehicleEditor from './pages/VehicleEditor';
import Vehicles from './pages/Vehicles';

const titles: Record<string, [string, string]> = {
  overview: ['Overview', 'How the business is doing'],
  bookings: ['Bookings', 'Requests, upcoming experiences and history'],
  vehicles: ['Fleet', 'Cars, photos and availability'],
  calendar: ['Calendar', 'Who has which car, and when'],
  events: ['Events', 'The occasions customers can book for'],
  pricing: ['Pricing', 'Rates, packages and special dates'],
  addons: ['Add-ons', 'Optional services customers can add to a booking'],
  drivers: ['Drivers', 'Chauffeurs and assignments'],
  payments: ['Payments', 'Money in, refunds and reconciliation'],
  offers: ['Offers', 'Discounts and coupon codes'],
  customers: ['Customers', 'People who have booked with you'],
  reports: ['Reports', 'Figures for any period'],
  settings: ['Settings', 'Booking rules, fees and Stripe'],
};

export default function App() {
  const { staff, ready } = useAuth();
  if (!ready) return <div style={{ padding: 60 }}><Loading label="Starting" /></div>;
  if (!staff) return <Login />;
  return <Portal />;
}

function Portal() {
  const { staff, signOut } = useAuth();
  const [page = 'overview', id] = useRoute();
  // `r` only varies the URL so the count refreshes whenever you move between pages.
  const { data: pending } = useApi<{ total: number }>(`/bookings?status=pending&limit=1&r=${page}/${id ?? ''}`);
  // Customers' extension requests need a decision too.
  const { data: extRequests } = useApi<{ items: unknown[] }>(`/extension-requests?r=${page}/${id ?? ''}`);
  const nav: NavItem[] = [
    { key: 'overview', label: 'Overview', icon: FiGrid },
    { key: 'bookings', label: 'Bookings', icon: FiClipboard, count: (pending?.total ?? 0) + (extRequests?.items.length ?? 0) },
    { key: 'vehicles', label: 'Fleet', icon: FiTruck },
    { key: 'calendar', label: 'Calendar', icon: FiCalendar },
    { key: 'events', label: 'Events', icon: FiStar },
    { key: 'pricing', label: 'Pricing', icon: FiTag },
    { key: 'addons', label: 'Add-ons', icon: FiPackage },
    { key: 'drivers', label: 'Drivers', icon: FiUser },
    { key: 'payments', label: 'Payments', icon: FiCreditCard },
    { key: 'offers', label: 'Offers', icon: FiPercent },
    { key: 'customers', label: 'Customers', icon: FiUsers },
    { key: 'reports', label: 'Reports', icon: FiBarChart2 },
    { key: 'settings', label: 'Settings', icon: FiSettings },
  ];
  const [title, sub] = page === 'vehicles' && id ? ['Vehicle', 'Edit details, photos, events, pricing and availability'] : page === 'bookings' && id ? ['Booking', 'Details, payments, driver and history'] : titles[page] ?? titles.overview;

  return (
    <Shell portal="Company admin" nav={nav} active={nav.some((n) => n.key === page) ? page : 'overview'} onNavigate={(k) => go(k)} title={title} sub={sub}
      user={{ name: staff!.name, role: staff!.role === 'owner' ? 'Company owner' : staff!.role.replaceAll('_', ' ') }} onSignOut={signOut}>
      {page === 'overview' ? <Overview /> : null}
      {page === 'bookings' ? (id ? <BookingDetail key={id} id={id} /> : <Bookings />) : null}
      {page === 'vehicles' ? (id ? <VehicleEditor key={id} id={id} /> : <Vehicles />) : null}
      {page === 'calendar' ? <CalendarPage /> : null}
      {page === 'events' ? <Events /> : null}
      {page === 'pricing' ? <Pricing /> : null}
      {page === 'addons' ? <Addons /> : null}
      {page === 'drivers' ? <Drivers /> : null}
      {page === 'payments' ? <Payments /> : null}
      {page === 'offers' ? <Offers /> : null}
      {page === 'customers' ? <Customers openId={id} /> : null}
      {page === 'reports' ? <Reports /> : null}
      {page === 'settings' ? <Settings /> : null}
      {!titles[page] ? <Overview /> : null}
    </Shell>
  );
}
