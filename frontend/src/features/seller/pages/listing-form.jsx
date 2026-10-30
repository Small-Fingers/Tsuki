import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../app/api.js';

function LocationMapPicker({ latitude, longitude, center, onChange }) {
  const mapRef = useRef(null);
  const dragging = useRef(false);
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) {
    return (
      <p className="location-map-hint">
        Find a map pin or enter both coordinates to preview and adjust the location.
      </p>
    );
  }
  const mapLat = center?.latitude ?? lat;
  const mapLon = center?.longitude ?? lon;
  const latDelta = 0.009;
  const lonDelta = Math.min(0.025 / Math.max(Math.cos((mapLat * Math.PI) / 180), 0.25), 0.12);
  const south = Math.max(-85, mapLat - latDelta);
  const north = Math.min(85, mapLat + latDelta);
  const west = Math.max(-180, mapLon - lonDelta);
  const east = Math.min(180, mapLon + lonDelta);
  const mercator = (value) => Math.log(Math.tan(Math.PI / 4 + (value * Math.PI) / 360));
  const mercatorSouth = mercator(south);
  const mercatorNorth = mercator(north);
  const markerX = ((lon - west) / (east - west)) * 100;
  const markerY = ((mercatorNorth - mercator(lat)) / (mercatorNorth - mercatorSouth)) * 100;
  const placePin = (clientX, clientY) => {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const nextLon = west + x * (east - west);
    const mercatorY = mercatorNorth - y * (mercatorNorth - mercatorSouth);
    const nextLat = ((2 * Math.atan(Math.exp(mercatorY)) - Math.PI / 2) * 180) / Math.PI;
    onChange(Number(nextLat.toFixed(6)), Number(nextLon.toFixed(6)));
  };
  const moveWithKeyboard = (event) => {
    const steps = {
      ArrowUp: [0.0002, 0],
      ArrowDown: [-0.0002, 0],
      ArrowLeft: [0, -0.0002],
      ArrowRight: [0, 0.0002],
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    onChange(
      Number(Math.max(-85, Math.min(85, lat + step[0])).toFixed(6)),
      Number(Math.max(-180, Math.min(180, lon + step[1])).toFixed(6)),
    );
  };
  const bbox = `${west},${south},${east},${north}`;
  // The map surface is keyboard-operable and its focused role is application.
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
  return (
    <div
      ref={mapRef}
      className="location-map-preview"
      role="application"
      tabIndex={0}
      aria-label="Property map location. Click the map or drag the pin to adjust it."
      onClick={(event) => placePin(event.clientX, event.clientY)}
      onKeyDown={moveWithKeyboard}
    >
      <iframe
        title="OpenStreetMap location preview"
        loading="lazy"
        tabIndex="-1"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`}
      />
      <button
        type="button"
        className="location-map-pin"
        style={{ left: `${markerX}%`, top: `${markerY}%` }}
        aria-label={`Map pin at latitude ${lat.toFixed(5)}, longitude ${lon.toFixed(5)}. Drag to move or use arrow keys.`}
        title="Drag to adjust the property location"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging.current) placePin(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          dragging.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <span aria-hidden="true" />
      </button>
      <button
        type="button"
        className="location-map-reposition"
        onClick={(event) => {
          event.stopPropagation();
          const rect = mapRef.current?.getBoundingClientRect();
          if (rect) placePin(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }}
      >
        Place pin at map center
      </button>
      <small className="location-map-attribution">
        © OpenStreetMap contributors · Click the map or drag the pin
      </small>
    </div>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}

export function ListingForm({ edit = false }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    purpose: 'sale',
    city: '',
    area: '',
    pincode: '',
    latitude: '',
    longitude: '',
    locationPrecision: 'approximate',
    propertyType: 'flat',
    bhk: '',
    bathrooms: '',
    areaSize: '',
    furnishing: 'unfurnished',
    status: 'sale',
    images: [],
    imageFiles: [],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newImageFiles, setNewImageFiles] = useState([]);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [mapCenter, setMapCenter] = useState(null);

  useEffect(() => {
    if (edit)
      api
        .get(`/api/property/mine/${id}`)
        .then(({ data }) => {
          const images = data.property.images || [];
          setForm((current) => ({
            ...current,
            ...data.property,
            locationPrecision: data.property.locationPrecision || 'approximate',
            images,
            imageFiles: data.property.imageFiles || [],
          }));
          if (data.property.latitude != null && data.property.longitude != null)
            setMapCenter({
              latitude: Number(data.property.latitude),
              longitude: Number(data.property.longitude),
            });
        })
        .catch(() => setError('Listing could not be found'));
  }, [edit, id]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(['area', 'city', 'pincode'].includes(name) ? { latitude: '', longitude: '' } : {}),
      ...(name === 'purpose' && value === 'rent' ? { status: 'sale' } : {}),
    }));
    if (['area', 'city', 'pincode'].includes(name)) {
      setMapCenter(null);
      setLocationMessage('');
    }
  };
  const locateProperty = async () => {
    const query = [form.area, form.city, form.pincode].filter(Boolean).join(', ');
    if (!query) {
      setLocationMessage('Enter an area, city and PIN code first.');
      return;
    }
    setLocationBusy(true);
    setLocationMessage('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error('Location lookup is unavailable.');
      const results = await response.json();
      if (!results.length) {
        setLocationMessage('Could not find that location. Add a more specific area or PIN code.');
        return;
      }
      const latitude = Number(results[0].lat);
      const longitude = Number(results[0].lon);
      setForm((current) => ({ ...current, latitude, longitude }));
      setMapCenter({ latitude, longitude });
      setLocationMessage(
        'Map location found. Click the preview or drag its pin to refine the placement.',
      );
    } catch (requestError) {
      setLocationMessage(requestError.message || 'Could not find the map location.');
    } finally {
      setLocationBusy(false);
    }
  };
  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (files.length > 8 - form.images.length) {
      setError(
        `Choose up to ${8 - form.images.length} more photo${8 - form.images.length === 1 ? '' : 's'}.`,
      );
      event.target.value = '';
      return;
    }
    const body = new FormData();
    files.forEach((file) => body.append('images', file));
    setUploading(true);
    setError('');
    try {
      const { data } = await api.post('/api/property/images', body);
      setForm((current) => ({
        ...current,
        images: [...current.images, ...data.images.map((image) => image.url)],
        imageFiles: [...current.imageFiles, ...data.images.map((image) => image.filename)],
      }));
      setNewImageFiles((current) => [...current, ...data.images.map((image) => image.filename)]);
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save photos to the backend.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  const removeImage = async (index) => {
    const filename = form.imageFiles[index];
    if (filename && newImageFiles.includes(filename)) {
      try {
        await api.delete('/api/property/images', { data: { filenames: [filename] } });
      } catch (e) {
        setError(e.response?.data?.message || 'Could not remove uploaded photo.');
        return;
      }
      setNewImageFiles((current) => current.filter((file) => file !== filename));
    }
    setForm((current) => ({
      ...current,
      images: current.images.filter((_, imageIndex) => imageIndex !== index),
      imageFiles: current.imageFiles.filter((_, imageIndex) => imageIndex !== index),
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    const hasLatitude =
      form.latitude !== '' && form.latitude !== null && form.latitude !== undefined;
    const hasLongitude =
      form.longitude !== '' && form.longitude !== null && form.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      setError('Enter both latitude and longitude, or clear both coordinates.');
      return;
    }
    if (form.locationPrecision === 'exact' && !hasLatitude) {
      setError('Find a map pin before sharing an exact location.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload = { ...form };
      if (hasLatitude) {
        payload.latitude = Number(payload.latitude);
        payload.longitude = Number(payload.longitude);
      } else {
        payload.latitude = null;
        payload.longitude = null;
      }
      await api[edit ? 'patch' : 'post'](edit ? `/api/property/${id}` : '/api/property', payload);
      nav('/dashboard');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not save listing');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page-wrap form-wrap">
      <span className="eyebrow">Seller tools</span>
      <h1>{edit ? 'Edit your listing' : 'Tell us about your place'}</h1>
      <p className="muted">A few useful details help the right people find this home.</p>
      <form className="listing-form" onSubmit={submit}>
        <label>
          Listing title
          <input
            required
            name="title"
            value={form.title}
            onChange={update}
            placeholder="A bright apartment near the park"
          />
        </label>
        <label>
          Description
          <textarea
            required
            rows="5"
            name="description"
            value={form.description}
            onChange={update}
          />
        </label>
        <div className="photo-upload-field">
          <label htmlFor="property-photos">Property photos</label>
          <p id="photo-help">JPG, PNG, WebP, or AVIF. Up to 8 photos, 8 MB each.</p>
          <input
            id="property-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={uploadImages}
            disabled={uploading || form.images.length >= 8}
          />
          {uploading && (
            <p role="status" className="upload-status">
              Uploading photos…
            </p>
          )}
          {form.images.length > 0 && (
            <div className="photo-grid">
              {form.images.map((url, index) => (
                <figure key={url}>
                  <img src={url} alt={`Listing ${index + 1}`} />
                  <button
                    type="button"
                    className="remove-photo"
                    aria-label={`Remove property photo ${index + 1}`}
                    onClick={() => removeImage(index)}
                  >
                    Remove
                  </button>
                </figure>
              ))}
            </div>
          )}
        </div>
        <div className="form-grid">
          <label>
            {form.purpose === 'rent' ? 'Monthly rent (INR)' : 'Price (INR)'}
            <input
              required
              min="1"
              type="number"
              name="price"
              value={form.price}
              onChange={update}
            />
          </label>
          <label>
            Listing purpose
            <select name="purpose" value={form.purpose} onChange={update}>
              <option value="sale">For sale</option>
              <option value="rent">For rent</option>
            </select>
          </label>
          <label>
            Property type
            <select name="propertyType" value={form.propertyType} onChange={update}>
              {[
                'flat',
                'apartment',
                'villa',
                'house',
                'studio',
                'penthouse',
                'office',
                'townhouse',
                'plot',
                'commercial',
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            City
            <input required name="city" value={form.city} onChange={update} />
          </label>
          <label>
            Area / neighborhood
            <input required name="area" value={form.area} onChange={update} />
          </label>
          <label>
            PIN code
            <input required name="pincode" value={form.pincode} onChange={update} />
          </label>
          <div className="coordinate-field">
            <span>Public map location</span>
            <label className="location-precision-choice">
              Pin precision
              <select
                name="locationPrecision"
                value={form.locationPrecision || 'approximate'}
                onChange={update}
              >
                <option value="approximate">Approximate neighborhood</option>
                <option value="exact">Exact location</option>
              </select>
            </label>
            <small className="location-precision-help">
              Approximate is recommended for homes. It rounds the public map pin to neighborhood
              level; exact shares the coordinates you choose.
            </small>
            <button
              type="button"
              className="button button-quiet button-small"
              onClick={locateProperty}
              disabled={locationBusy}
            >
              {locationBusy
                ? 'Finding location…'
                : form.latitude !== '' && form.longitude !== ''
                  ? 'Refresh map pin'
                  : 'Find map pin'}
            </button>
            <div className="coordinate-inputs">
              <label>
                Latitude
                <input
                  type="number"
                  name="latitude"
                  min="-90"
                  max="90"
                  step="any"
                  value={form.latitude ?? ''}
                  onChange={update}
                  onBlur={() => {
                    const latitude = Number(form.latitude);
                    const longitude = Number(form.longitude);
                    if (Number.isFinite(latitude) && Number.isFinite(longitude))
                      setMapCenter({ latitude, longitude });
                  }}
                  placeholder="Optional"
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  name="longitude"
                  min="-180"
                  max="180"
                  step="any"
                  value={form.longitude ?? ''}
                  onChange={update}
                  onBlur={() => {
                    const latitude = Number(form.latitude);
                    const longitude = Number(form.longitude);
                    if (Number.isFinite(latitude) && Number.isFinite(longitude))
                      setMapCenter({ latitude, longitude });
                  }}
                  placeholder="Optional"
                />
              </label>
            </div>
            {form.latitude !== '' && form.longitude !== '' && (
              <LocationMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                center={mapCenter}
                onChange={(latitude, longitude) =>
                  setForm((current) => ({ ...current, latitude, longitude }))
                }
              />
            )}
            {locationMessage && (
              <p className="muted" role="status">
                {locationMessage}
              </p>
            )}
            <small>Used to place this listing on the search map. Lookup uses OpenStreetMap.</small>
          </div>
          <label>
            Bedrooms
            <input name="bhk" value={form.bhk} onChange={update} />
          </label>
          <label>
            Bathrooms
            <input
              min="0"
              type="number"
              name="bathrooms"
              value={form.bathrooms}
              onChange={update}
            />
          </label>
          <label>
            Area (sq ft)
            <input min="0" type="number" name="areaSize" value={form.areaSize} onChange={update} />
          </label>
          <label>
            Furnishing
            <select name="furnishing" value={form.furnishing} onChange={update}>
              <option value="unfurnished">Unfurnished</option>
              <option value="semi-furnished">Semi-furnished</option>
              <option value="furnished">Furnished</option>
            </select>
          </label>
          {form.purpose === 'sale' && (
            <label>
              Availability
              <select name="status" value={form.status} onChange={update}>
                <option value="sale">Available</option>
                <option value="sold">Sold</option>
              </select>
            </label>
          )}
        </div>
        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={busy || uploading}>
          {busy ? 'Saving…' : 'Save listing'}
        </button>{' '}
        <Link className="text-link" to="/dashboard">
          Cancel
        </Link>
      </form>
    </section>
  );
}
