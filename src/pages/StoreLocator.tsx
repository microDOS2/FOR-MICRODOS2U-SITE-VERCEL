import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Search, Loader2, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom marker icons
const createCustomIcon = (stock: string) => {
  const color = stock === 'In Stock' ? '#00D084' : stock === 'Low Stock' ? '#F59E0B' : '#EF4444';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 30px;
      height: 30px;
      background-color: ${color};
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
};

// Map bounds component
function MapBounds({ stores }: { stores: Store[] }) {
  const map = useMap();

  useEffect(() => {
    if (stores.length > 0) {
      const bounds = L.latLngBounds(stores.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [stores, map]);

  return null;
}

interface Store {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
  stock: 'In Stock' | 'Low Stock' | 'Out of Stock';
  website: string | null;
}

export function StoreLocator() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Fetch stores from Supabase: only wholesaler-owned, active stores
  useEffect(() => {
    async function fetchStores() {
      setLoading(true);
      try {
        // Step 1: Get approved wholesaler IDs
        const { data: wholesalers, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'wholesaler')
          .eq('status', 'approved');

        if (userError || !wholesalers || wholesalers.length === 0) {
          setStores([]);
          setLoading(false);
          return;
        }

        const wholesalerIds = wholesalers.map((w) => w.id);

        // Step 2: Get stores for those wholesalers
        const { data, error } = await supabase
          .from('wholesaler_store_locations')
          .select('*')
          .in('user_id', wholesalerIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Store fetch error:', error);
          setStores([]);
        } else if (data) {
          // Transform to Store interface (lat/lng are non-null for active stores)
          const transformed: Store[] = data
            .filter((s) => s.lat != null && s.lng != null)
            .map((s) => ({
              id: s.id,
              name: s.name || 'Unnamed Store',
              address: s.address || '',
              city: s.city || '',
              state: s.state || '',
              zip: s.zip || '',
              lat: s.lat as number,
              lng: s.lng as number,
              phone: s.phone || '',
              stock: (s.stock as 'In Stock' | 'Low Stock' | 'Out of Stock') || 'In Stock',
              website: s.website || null,
            }));
          setStores(transformed);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setStores([]);
      }
      setLoading(false);
    }

    fetchStores();
  }, []);

  // Filter stores based on search
  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return stores;
    const query = searchQuery.toLowerCase();
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        store.city.toLowerCase().includes(query) ||
        store.address.toLowerCase().includes(query)
    );
  }, [stores, searchQuery]);

  const getStockBadge = (stock: string) => {
    switch (stock) {
      case 'In Stock':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">In Stock</Badge>;
      case 'Low Stock':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Low Stock</Badge>;
      case 'Out of Stock':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Out of Stock</Badge>;
      default:
        return null;
    }
  };

  const center: [number, number] = [39.7392, -104.9903]; // Denver

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0514]">
        <Loader2 className="w-8 h-8 text-[#9a02d0] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0514] pt-16">
      {/* Header */}
      <div className="bg-[#150f24] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Find a <span className="text-[#9a02d0]">Wholesaler</span>
          </h1>
          <p className="text-gray-400">
            Locate authorized dispensaries and wellness centers carrying microDOS(2) products.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Store List */}
          <div className="lg:col-span-1 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by city or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#150f24] border-white/10 text-white placeholder:text-gray-600"
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-400">In Stock</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-gray-400">Low Stock</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-gray-400">Out of Stock</span>
              </div>
            </div>

            {/* Store count */}
            <div className="text-xs text-gray-500">
              {filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''} found
            </div>

            {/* Store Cards */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredStores.map((store) => (
                <Card
                  key={store.id}
                  className={`bg-[#150f24] border-white/10 cursor-pointer transition-all hover:border-[#9a02d0]/50 ${
                    selectedStore?.id === store.id ? 'border-[#9a02d0] ring-1 ring-[#9a02d0]' : ''
                  }`}
                  onClick={() => setSelectedStore(store)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white">{store.name}</h3>
                      {getStockBadge(store.stock)}
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#9a02d0]" />
                        <span>
                          {store.address}, {store.city}, {store.state}
                        </span>
                      </div>
                      {store.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-[#9a02d0]" />
                          <span>{store.phone}</span>
                        </div>
                      )}
                      {store.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-[#44f80c]" />
                          <a
                            href={store.website.startsWith('http') ? store.website : `https://${store.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#44f80c] hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {store.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredStores.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No stores found matching your search.
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-2">
            <Card className="bg-[#150f24] border-white/10 h-[600px] overflow-hidden">
              <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBounds stores={filteredStores} />
                {filteredStores.map((store) => (
                  <Marker
                    key={store.id}
                    position={[store.lat, store.lng]}
                    icon={createCustomIcon(store.stock)}
                    eventHandlers={{
                      click: () => setSelectedStore(store),
                    }}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold text-gray-900">{store.name}</h3>
                        <p className="text-sm text-gray-600">{store.address}</p>
                        <p className="text-sm text-gray-600">
                          {store.city}, {store.state} {store.zip}
                        </p>
                        {store.phone && (
                          <p className="text-sm text-gray-600">{store.phone}</p>
                        )}
                        {store.website && (
                          <p className="text-sm mt-1">
                            <a
                              href={store.website.startsWith('http') ? store.website : `https://${store.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {store.website}
                            </a>
                          </p>
                        )}
                        <div className="mt-2">{getStockBadge(store.stock)}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 bg-[#150f24] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-500">
            &copy; 2026 microDOS(2) Inc. All rights reserved.
          </p>
          <p className="text-xs text-gray-600 mt-1">
            This product is intended for adults. Use responsibly.
          </p>
        </div>
      </footer>
    </div>
  );
}
