import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Search, Loader2, Globe } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { geocodeAddress } from '@/lib/geocode';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

const MARKER_COLOR = '#44f80c';
const createMarkerIcon = (isSelected: boolean) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="position:relative;width:${isSelected ? 36 : 30}px;height:${isSelected ? 36 : 30}px;background:${MARKER_COLOR};border-radius:50%;border:${isSelected ? 4 : 3}px solid white;box-shadow:0 2px 8px rgba(68,248,12,0.5)${isSelected ? ',0 0 0 8px rgba(68,248,12,0.2)' : ''};display:flex;align-items:center;justify-content:center;transition:all 0.3s ease;"><svg width="${isSelected ? 18 : 16}" height="${isSelected ? 18 : 16}" viewBox="0 0 24 24" fill="none" stroke="#0a0514" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  iconSize: [isSelected ? 36 : 30, isSelected ? 36 : 30], iconAnchor: [isSelected ? 18 : 15, isSelected ? 36 : 30],
});

function MapBounds({ stores }: { stores: Store[] }) {
  const map = useMap();
  useEffect(() => { if (stores.length > 0) { const bounds = L.latLngBounds(stores.map(s => [s.lat, s.lng])); map.fitBounds(bounds, { padding: [50, 50] }); } }, [stores, map]);
  return null;
}

function MapInteraction({ selectedStore, markerRefs }: { selectedStore: Store | null; markerRefs: React.MutableRefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (selectedStore) {
      map.flyTo([selectedStore.lat, selectedStore.lng], 15, { duration: 0.8 });
      const marker = markerRefs.current.get(selectedStore.id);
      if (marker) setTimeout(() => marker.openPopup(), 900);
    }
  }, [selectedStore, map, markerRefs]);
  return null;
}

interface Store {
  id: string; name: string; address: string; city: string; state: string; zip: string;
  lat: number; lng: number; phone: string; website: string | null; store_number: string;
}

export function StoreLocator() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  const parseStoreNumber = (name: string): string => {
    const m = name.match(/^(\d+[a-z])\s*-\s*(.+)$/);
    return m ? m[1] : '';
  };

  useEffect(() => {
    async function fetchStores() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('wholesaler_store_locations')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) { console.error('StoreLocator fetch error:', error); setStores([]); setLoading(false); return; }
        if (data && data.length > 0) {
          const storesWithCoords = await Promise.all(data.map(async (s: any) => {
            let lat = s.lat ? parseFloat(s.lat) : null; let lng = s.lng ? parseFloat(s.lng) : null;
            if (!lat || !lng) { const result = await geocodeAddress([s.address, s.city, s.state, s.zip].filter(Boolean).join(', ')); if (result) { lat = result.lat; lng = result.lng; } }
            return { id: s.id, name: s.name ? s.name.replace(/^\d+[a-z]\s*-\s*/, '') : 'Unnamed Store', address: s.address || '', city: s.city || '', state: s.state || '', zip: s.zip || '', lat: lat || 39.7392, lng: lng || -104.9903, phone: s.phone || '', website: s.website || null, store_number: parseStoreNumber(s.name || '') };
          }));
          setStores(storesWithCoords);
        }
      } catch (err) { console.error(err); setStores([]); }
      setLoading(false);
    }
    fetchStores();
  }, []);

  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return stores;
    const q = searchQuery.toLowerCase();
    return stores.filter(s => s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  }, [stores, searchQuery]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0a0514]"><Loader2 className="w-8 h-8 text-[#9a02d0] animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-[#0a0514] pt-16">
      <div className="bg-[#150f24] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Find a <span className="text-[#9a02d0]">Retailer</span></h1>
          <p className="text-gray-400">Locate authorized dispensaries and wellness centers carrying microDOS(2) products.</p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" /><Input placeholder="Search by city or name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 bg-[#150f24] border-white/10 text-white placeholder:text-gray-600" /></div>
            <div className="text-xs text-gray-500">{filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''} found</div>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredStores.map(store => (
                <Card key={store.id} className={`bg-[#150f24] border-white/10 cursor-pointer transition-all hover:border-[#9a02d0]/50 ${selectedStore?.id === store.id ? 'border-[#9a02d0] ring-1 ring-[#9a02d0]' : ''}`} onClick={() => setSelectedStore(store)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-white">{store.name}</h3>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">In Stock</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-[#9a02d0] shrink-0" /><span>{store.address}, {store.city}, {store.state}</span></div>
                      {store.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#9a02d0] shrink-0" /><span>{store.phone}</span></div>}
                      {store.website && <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-[#44f80c] shrink-0" /><a href={store.website.startsWith('http') ? store.website : `https://${store.website}`} target="_blank" rel="noopener noreferrer" className="text-[#44f80c] hover:underline truncate" onClick={e => e.stopPropagation()}>{store.website}</a></div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredStores.length === 0 && <div className="text-center py-8 text-gray-500">No stores found matching your search.</div>}
            </div>
          </div>
          <div className="lg:col-span-2">
            <Card className="bg-[#150f24] border-white/10 h-[600px] overflow-hidden">
              <MapContainer center={[39.7392, -104.9903]} zoom={10} style={{ height: '100%', width: '100%' }}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapBounds stores={filteredStores} />
                <MapInteraction selectedStore={selectedStore} markerRefs={markerRefs} />
                {filteredStores.map(store => (
                  <Marker key={store.id} position={[store.lat, store.lng]} icon={createMarkerIcon(selectedStore?.id === store.id)} ref={ref => { if (ref) markerRefs.current.set(store.id, ref); }} eventHandlers={{ click: () => setSelectedStore(store) }}>
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{store.name}</h3>
                          {store.store_number && <span className="text-xs font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{store.store_number}</span>}
                        </div>
                        <p className="text-sm text-gray-600">{store.address}</p>
                        <p className="text-sm text-gray-600">{store.city}, {store.state} {store.zip}</p>
                        {store.phone && <p className="text-sm text-gray-600">{store.phone}</p>}
                        {store.website && <p className="text-sm mt-1"><a href={store.website.startsWith('http') ? store.website : `https://${store.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{store.website}</a></p>}
                        <div className="mt-2"><Badge className="bg-green-500/20 text-green-600 border-green-500/30">In Stock</Badge></div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Card>
          </div>
        </div>
      </div>
      <footer className="py-6 bg-[#150f24] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-500">&copy; 2026 microDOS(2) Inc. All rights reserved.</p>
          <p className="text-xs text-gray-600 mt-1">This product is intended for adults. Use responsibly.</p>
        </div>
      </footer>
    </div>
  );
}
