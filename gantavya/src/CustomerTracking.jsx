import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = "http://localhost:5000/api/rides";

function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 14, { duration: 0.8 });
    }
  }, [map, position]);

  return null;
}

function CustomerTracking({ rides }) {
  const { getToken } = useAuth();
  const [locations, setLocations] = useState({});
  const [message, setMessage] = useState("");

  const trackableRides = rides.filter(
    (ride) => ["accepted", "ongoing"].includes(ride.status)
  );

  const loadLocations = useCallback(async () => {
    if (trackableRides.length === 0) {
      setLocations({});
      return;
    }

    try {
      const token = await getToken();

      const results = await Promise.all(
        trackableRides.map(async (ride) => {
          const response = await fetch(
            `${API_URL}/${ride.id}/location`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.status === 404) {
            return [ride.id, null];
          }

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Could not load driver location");
          }

          return [
            ride.id,
            {
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
              recordedAt: data.recorded_at,
            },
          ];
        })
      );

      setLocations((previous) => {
        const updated = {};

        results.forEach(([id, location]) => {
          if (location) {
            updated[id] = location;
          } else if (previous[id]) {
            updated[id] = previous[id];
          }
        });

        return updated;
      });

      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }, [getToken, trackableRides]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLocations();
    }, 0);

    const intervalId = setInterval(loadLocations, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
    };
  }, [loadLocations]);

  const locatedRides = trackableRides.filter(
    (ride) => locations[ride.id]
  );

  const latestLocation =
    locatedRides.length > 0
      ? locations[locatedRides[locatedRides.length - 1].id]
      : null;

  if (trackableRides.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-6">
      <div>
        <h2 className="text-2xl font-bold">Track Your Driver</h2>
        <p className="mt-1 text-sm text-gray-600">
          Driver locations refresh approximately every 5 seconds.
        </p>
      </div>

      {message && (
        <p role="status" className="text-sm text-red-600">
          {message}
        </p>
      )}

      {locatedRides.length === 0 ? (
        <p className="rounded-lg bg-gray-100 p-4 text-sm text-gray-700">
          Waiting for your driver to share their location. The map will
          update when their first location is received.
        </p>
      ) : (
        <>
          <div className="h-80 overflow-hidden rounded-xl">
            <MapContainer
              center={[
                latestLocation.latitude,
                latestLocation.longitude,
              ]}
              zoom={14}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <RecenterMap
                position={[
                  latestLocation.latitude,
                  latestLocation.longitude,
                ]}
              />

              {locatedRides.map((ride) => {
                const location = locations[ride.id];

                return (
                  <Marker
                    key={ride.id}
                    position={[location.latitude, location.longitude]}
                  >
                    <Popup>
                      Driver for Ride #{ride.id}
                      <br />
                      Status: {ride.status}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          <div className="space-y-2">
            {locatedRides.map((ride) => (
              <div key={ride.id} className="rounded-lg border p-3">
                <p className="font-semibold">
                  Ride #{ride.id} — {ride.status}
                </p>
                <p className="text-sm text-gray-600">
                  Last location received:{" "}
                  {new Date(
                    locations[ride.id].recordedAt
                  ).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default CustomerTracking;