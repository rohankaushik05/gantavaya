import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";

const API_URL = "http://localhost:5000/api/rides";

function DriverDashboard() {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const watchIds = useRef({});
  const [sharingRideIds, setSharingRideIds] = useState([]);
  const [earnings, setEarnings] = useState({
    completed_rides: 0,
    total_earnings: 0,
  });

  const apiRequest = useCallback(
    async (url, options = {}) => {
      const token = await getToken();

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    },
    [getToken],
  );

  const loadDashboard = useCallback(async () => {
    try {
      setMessage("");

      const [available, assigned, earningsData] = await Promise.all([
        apiRequest(`${API_URL}/driver/requests`),
        apiRequest(`${API_URL}/driver/mine`),
        apiRequest(`${API_URL}/driver/earnings`),
      ]);

      setRequests(available);
      setMyRides(assigned);
      setEarnings(earningsData);
    } catch (error) {
      setMessage(error.message);
    }
  }, [apiRequest]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadDashboard]);

  async function performAction(rideId, action, body) {
    setLoading(true);
    setMessage("");

    try {
      await apiRequest(`${API_URL}/${rideId}/${action}`, {
        method: "PATCH",
        body: body ? JSON.stringify(body) : undefined,
      });

      setMessage("Ride updated successfully.");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function stopSharing(rideId) {
    const watchId = watchIds.current[rideId];

    if (watchId !== undefined) {
      navigator.geolocation.clearWatch(watchId);
      delete watchIds.current[rideId];
    }

    setSharingRideIds((ids) => ids.filter((id) => id !== rideId));
  }

  function startSharing(rideId) {
    if (!navigator.geolocation) {
      setMessage("Your browser does not support GPS location.");
      return;
    }

    if (watchIds.current[rideId] !== undefined) return;

    setMessage("Requesting GPS permission...");

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          const token = await getToken();

          const response = await fetch(`${API_URL}/${rideId}/location`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Location update failed");
          }

          setMessage(`Sharing GPS for ride #${rideId}.`);
        } catch (error) {
          setMessage(error.message);
        }
      },
      (error) => {
        setMessage(`GPS error: ${error.message}`);
        stopSharing(rideId);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    watchIds.current[rideId] = watchId;

    setSharingRideIds((ids) => [...ids, rideId]);
  }

  useEffect(() => {
    return () => {
      Object.values(watchIds.current).forEach((id) => {
        navigator.geolocation.clearWatch(id);
      });
      watchIds.current = {};
    };
  }, []);

  return (
    <section className="space-y-6 rounded-xl border bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Driver Dashboard</h2>
        <button
          type="button"
          onClick={loadDashboard}
          className="rounded-lg border px-4 py-2"
        >
          Refresh
        </button>
      </div>

      {message && (
        <p role="status" className="rounded-lg bg-gray-100 p-3 text-sm">
          {message}
        </p>
      )}

      {/* Driver Earnings Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Completed Rides</p>
          <p className="mt-2 text-3xl font-bold">
            {earnings.completed_rides}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">Total Earnings</p>
          <p className="mt-2 text-3xl font-bold">
            ₹{Number(earnings.total_earnings).toLocaleString("en-IN")}
          </p>
        </div>
      </section>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Available Requests</h3>

        {requests.length === 0 ? (
          <p className="text-gray-600">No pending ride requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((ride) => (
              <div key={ride.id} className="rounded-lg border p-4">
                <p className="font-semibold">
                  Ride #{ride.id} · Fare: {ride.fare ?? "Not calculated"}
                </p>
                <p className="mt-2 text-sm">
                  <strong>Pickup:</strong> {ride.pickup_address}
                </p>
                <p className="text-sm">
                  <strong>Destination:</strong> {ride.destination_address}
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => performAction(ride.id, "accept")}
                  className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
                >
                  Accept Ride
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">My Assigned Rides</h3>

        {myRides.length === 0 ? (
          <p className="text-gray-600">You have no assigned rides yet.</p>
        ) : (
          <div className="space-y-3">
            {myRides.map((ride) => (
              <div key={ride.id} className="rounded-lg border p-4">
                <p className="font-semibold">
                  Ride #{ride.id} — {ride.status}
                </p>
                <p className="mt-2 text-sm">
                  {ride.pickup_address} → {ride.destination_address}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Status: {ride.status}
                </p>
                <p className="text-sm text-gray-600">
                  Fare: ₹{Number(ride.fare || 0).toLocaleString("en-IN")}
                </p>

                {ride.status === "accepted" && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      performAction(ride.id, "status", { status: "ongoing" })
                    }
                    className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-white"
                  >
                    Start Ride
                  </button>
                )}

                {ride.status === "ongoing" && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      performAction(ride.id, "status", { status: "completed" })
                    }
                    className="mt-3 rounded-lg bg-green-700 px-4 py-2 text-white"
                  >
                    Complete Ride
                  </button>
                )}

                {ride.status === "ongoing" &&
                  (sharingRideIds.includes(ride.id) ? (
                    <button
                      type="button"
                      onClick={() => stopSharing(ride.id)}
                      className="mt-3 ml-2 rounded-lg border px-4 py-2"
                    >
                      Stop Sharing Location
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startSharing(ride.id)}
                      className="mt-3 ml-2 rounded-lg bg-green-700 px-4 py-2 text-white"
                    >
                      Start Sharing Location
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default DriverDashboard;