import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '@/hooks/useStore';
import type { Trip } from '@/types';
import {
  ArrowLeft, MapPin, Navigation, Clock, DollarSign, Star,
  ChevronLeft, ChevronRight, Filter, Bike,
} from 'lucide-react';

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  completed:   { label: 'Completado', color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelado',  color: 'bg-red-100 text-red-700' },
  in_progress: { label: 'En curso',   color: 'bg-blue-100 text-blue-700' },
  pending:     { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700' },
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: '💵', card: '💳', nequi: '📱', daviplata: '📱',
};

// Demo data
const generateMockTrips = (n: number): Trip[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `trip-${i}`,
    pickup_address: ['Carrera 5 #10-20', 'Calle 8 Parque', 'Terminal Carepa'][i % 3] + ', Carepa',
    dropoff_address: ['Hospital Municipal', 'Centro Comercial', 'Aeropuerto Los Cedros'][i % 3] + ', Carepa',
    status: i % 7 === 0 ? 'cancelled' : 'completed',
    fare: 5_000 + (i * 1_300) % 15_000,
    payment_method: ['cash', 'nequi', 'card'][i % 3] as Trip['payment_method'],
    rating: i % 5 === 0 ? undefined : 4 + (i % 2),
    distance_km: 1.2 + (i * 0.8) % 8,
    duration_min: 5 + (i * 3) % 25,
    created_at: new Date(Date.now() - i * 86_400_000 / 2).toISOString(),
  }));

export default function TripHistory() {
  const navigate = useNavigate();
  const { token } = useStore();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: PAGE_SIZE.toString(),
      ...(filter !== 'all' ? { status: filter } : {}),
    });

    fetch(`/api/trips/me?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setTrips(d.trips ?? d); setTotal(d.total ?? (d.length ?? 0)); }
        else throw new Error();
      })
      .catch(() => {
        const mock = generateMockTrips(47);
        const filtered = filter === 'all' ? mock : mock.filter(t => t.status === filter);
        setTotal(filtered.length);
        setTrips(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      })
      .finally(() => setLoading(false));
  }, [page, filter, token]);

  // Totals
  const completedTrips = trips.filter(t => t.status === 'completed');
  const totalSpent = completedTrips.reduce((s, t) => s + (t.fare ?? 0), 0);
  const avgRating = completedTrips.filter(t => t.rating).reduce((s, t, _, arr) => s + (t.rating ?? 0) / arr.length, 0);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate('/client')} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="font-bold text-slate-800">Mis viajes</h1>
          <p className="text-xs text-slate-400">{total} viajes en total</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
          <Bike className="w-5 h-5 text-[#f97316] mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-800">{total}</p>
          <p className="text-xs text-slate-400">Viajes</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
          <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-800">${(totalSpent / 1000).toFixed(0)}k</p>
          <p className="text-xs text-slate-400">Gastado</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
          <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-slate-800">{avgRating ? avgRating.toFixed(1) : '—'}</p>
          <p className="text-xs text-slate-400">Calificación</p>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 pt-4 flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {(['all', 'completed', 'cancelled'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              filter === f ? 'bg-[#0f172a] text-white' : 'bg-white text-slate-500 border border-slate-200'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'completed' ? 'Completados' : 'Cancelados'}
          </button>
        ))}
      </div>

      {/* Trip list */}
      <div className="px-4 pt-3 pb-6 space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <Bike className="w-8 h-8 text-[#f97316] animate-bounce" />
          </div>
        )}
        {!loading && trips.map(trip => {
          const badge = STATUS_BADGE[trip.status] ?? { label: trip.status, color: 'bg-gray-100 text-gray-600' };
          return (
            <div key={trip.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
              {/* Status + Date */}
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>
                <span className="text-xs text-slate-400">
                  {new Date(trip.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Route */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="truncate">{trip.pickup_address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Navigation className="w-3.5 h-3.5 text-[#f97316] flex-shrink-0" />
                  <span className="truncate">{trip.dropoff_address}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 pt-1 border-t border-slate-50">
                {trip.distance_km && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Navigation className="w-3 h-3" />{trip.distance_km.toFixed(1)} km
                  </span>
                )}
                {trip.duration_min && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{trip.duration_min} min
                  </span>
                )}
                <span className="text-xs text-slate-400">{PAYMENT_LABEL[trip.payment_method] ?? ''}</span>
                {trip.rating && (
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{trip.rating}
                  </span>
                )}
                <span className="ml-auto font-bold text-slate-800 text-sm">
                  {trip.fare ? `$${trip.fare.toLocaleString('es-CO')}` : '—'}
                </span>
              </div>
            </div>
          );
        })}

        {!loading && trips.length === 0 && (
          <div className="text-center py-16">
            <Bike className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sin viajes aún</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-sm text-slate-500 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />Anterior
          </button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-sm text-slate-500 disabled:opacity-40"
          >
            Siguiente<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
