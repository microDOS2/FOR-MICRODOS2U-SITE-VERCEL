// Geocoding utility using OpenStreetMap Nominatim API (free, no API key required)
// Rate limit: 1 request per second

export interface GeocodeResult {
  lat: number;
  lng: number;
  city: string;
  state: string;
  zip: string;
  displayName: string;
}

/**
 * Geocode a street address to get lat/lng + city/state/zip
 * Uses OpenStreetMap Nominatim (free, no API key)
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!address || address.trim().length < 3) return null;

  try {
    const encoded = encodeURIComponent(address.trim());
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'microDOS2-StoreLocator/1.0',
        'Accept-Language': 'en-US',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    const result = data[0];
    const addr = result.address || {};

    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      city: addr.city || addr.town || addr.village || addr.hamlet || '',
      state: addr.state || addr.province || '',
      zip: addr.postcode || '',
      displayName: result.display_name || '',
    };
  } catch {
    return null;
  }
}

/**
 * Debounced geocode for form inputs
 * Waits for user to stop typing before calling API
 */
export function createDebouncedGeocode(delay = 800) {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (address: string): Promise<GeocodeResult | null> => {
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        const result = await geocodeAddress(address);
        resolve(result);
      }, delay);
    });
  };
}
