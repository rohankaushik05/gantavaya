import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function RideMap({
  activeSelection,
  pickupCoords,
  destinationCoords,
  onSelectPickup,
  onSelectDestination,
  onRouteInfo,
}) {
  const [route, setRoute] = useState(null);
  const [routeError, setRouteError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);

  function handleMapClick(coords) {
    if (activeSelection === "pickup") {
      onSelectPickup(coords);
    } else {
      onSelectDestination(coords);
    }
  }

  useEffect(() => {
    if (!pickupCoords || !destinationCoords) {
      onRouteInfo(null);
      return;
    }

    const controller = new AbortController();

    async function getRoute() {
      setRouteLoading(true);
      setRouteError("");

      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${pickupCoords.lng},${pickupCoords.lat};` +
          `${destinationCoords.lng},${destinationCoords.lat}` +
          "?overview=full&geometries=geojson";

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) throw new Error("Routing service unavailable");

        const data = await response.json();

        if (data.code !== "Ok" || !data.routes?.length) {
          throw new Error("No driving route found for these locations");
        }

        const result = data.routes[0];
        const distanceKm = Number((result.distance / 1000).toFixed(2));
        const durationMinutes = Math.ceil(result.duration / 60);
        const fare = Math.ceil(40 + distanceKm * 12 + durationMinutes * 2);

        const routeInfo = {
          coordinates: result.geometry.coordinates.map(([lng, lat]) => [
            lat,
            lng,
          ]),
          distanceKm,
          durationMinutes,
          fare,
        };

        setRoute(routeInfo);
        onRouteInfo({ distanceKm, durationMinutes, fare });
      } catch (error) {
        if (error.name !== "AbortError") {
          setRoute(null);
          setRouteError(error.message || "Could not calculate route");
          onRouteInfo(null);
        }
      } finally {
        if (!controller.signal.aborted) setRouteLoading(false);
      }
    }

    getRoute();

    return () => controller.abort();
  }, [pickupCoords, destinationCoords, onRouteInfo]);

  return (
    <div>
      <p className="mb-3 text-gray-600">
        Click the map to select your {activeSelection}.
      </p>

      <MapContainer
        center={[28.6304, 77.3721]}
        zoom={12}
        scrollWheelZoom
        style={{ height: "380px", width: "100%", borderRadius: "10px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={handleMapClick} />

        {pickupCoords && (
          <Marker position={[pickupCoords.lat, pickupCoords.lng]}>
            <Popup>Pickup location</Popup>
          </Marker>
        )}

        {destinationCoords && (
          <Marker position={[destinationCoords.lat, destinationCoords.lng]}>
            <Popup>Destination location</Popup>
          </Marker>
        )}

        {pickupCoords && destinationCoords && route && (
          <Polyline
            positions={route.coordinates}
            pathOptions={{ color: "#16a34a", weight: 5 }}
          />
        )}
      </MapContainer>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <h3 className="font-semibold">Pickup coordinates</h3>
          {pickupCoords ? (
            <p className="mt-1 text-sm text-gray-600">
              Lat: {pickupCoords.lat}
              <br />
              Lng: {pickupCoords.lng}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Not selected yet</p>
          )}
        </div>

        <div className="rounded-lg border p-3">
          <h3 className="font-semibold">Destination coordinates</h3>
          {destinationCoords ? (
            <p className="mt-1 text-sm text-gray-600">
              Lat: {destinationCoords.lat}
              <br />
              Lng: {destinationCoords.lng}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Not selected yet</p>
          )}
        </div>
      </div>

      {routeLoading && (
        <p className="mt-4 text-gray-600">Calculating route and fare...</p>
      )}

      {routeError && <p className="mt-4 text-red-600">{routeError}</p>}

      {route && (
        <div className="mt-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">Driving distance</p>
            <p className="text-xl font-bold">{route.distanceKm} km</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estimated duration</p>
            <p className="text-xl font-bold">{route.durationMinutes} min</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Estimated fare</p>
            <p className="text-xl font-bold">₹{route.fare}</p>
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-gray-500">
        Fare is a development estimate, not a final quote.
      </p>
    </div>
  );
}

export default RideMap;
