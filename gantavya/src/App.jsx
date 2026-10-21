
import RideMap from "./RideMap";
import DriverDashboard from "./DriverDashboard";
import CustomerTracking from "./CustomerTracking";
import SupportCenter from "./SupportCenter";
import ProfileSettings from "./ProfileSettings";
import RideReviews from "./RideReviews";
import PaymentCenter from "./PaymentCenter";
import { useEffect, useState } from "react";
import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
} from "@clerk/react";

function App() {
  const { getToken, isSignedIn } = useAuth();
  const [role, setRole] = useState("loading");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [rides, setRides] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [activeSelection, setActiveSelection] = useState("pickup");
  const [routeInfo, setRouteInfo] = useState(null);

  const { isLoaded } = useAuth();

useEffect(() => {
  const verifyPayment = async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (
      params.get("payment") !== "success" ||
      !sessionId ||
      !isLoaded ||
      !isSignedIn
    ) {
      return;
    }

    try {
      const token = await getToken();

      const response = await fetch(
        `https://gantavaya.onrender.com/api/payments/verify/${encodeURIComponent(sessionId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Payment verification failed:", data);
        return;
      }

      if (data.status === "paid") {
        window.history.replaceState({}, "", window.location.pathname);
        window.location.reload();
      } else {
        console.log("Payment is not yet confirmed:", data);
      }
    } catch (error) {
      console.error("Payment verification error:", error);
    }
  };

  verifyPayment();
}, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      if (!isSignedIn) {
        setRole("loading");
        return;
      }

      try {
        const token = await getToken();

        const response = await fetch("https://gantavaya.onrender.com/api/rides/role", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not check account role");
        }

        if (!cancelled) setRole(data.role);
      } catch (error) {
        if (!cancelled) {
          setRole("error");
          setMessage(error.message);
        }
      }
    }

    fetchRole();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);

  async function loadRides() {
    setLoading(true);
    setMessage("Loading your rides...");

    try {
      const token = await getToken();
      const response = await fetch("https://gantavaya.onrender.com/api/rides", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load rides");
      }

      setRides(data);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelRide(rideId) {
    setLoading(true);
    setMessage("Cancelling ride...");

    try {
      const token = await getToken();

      const response = await fetch(
        `https://gantavaya.onrender.com/api/rides/${rideId}/cancel`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not cancel ride");
      }

      setMessage(`Ride #${rideId} cancelled successfully!`);
      await loadRides();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function bookRide(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("Booking your ride...");

    try {
      const token = await getToken();
      const response = await fetch("https://gantavaya.onrender.com/api/rides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pickup_address: pickup,
          pickup_lat: pickupCoords?.lat ?? null,
          pickup_lng: pickupCoords?.lng ?? null,
          destination_address: destination,
          destination_lat: destinationCoords?.lat ?? null,
          destination_lng: destinationCoords?.lng ?? null,
          fare: routeInfo?.fare ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not book ride");
      }

      setMessage(`Ride booked successfully! Ride ID: ${data.id}`);
      setPickup("");
      setDestination("");
      await loadRides();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <header className="flex items-center justify-between border-b bg-white px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold">Gantavaya</h1>
          <p className="text-sm text-gray-500">Your ride booking app</p>
        </div>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        <Show when="signed-out">
          <section className="rounded-xl border bg-white p-8">
            <h2 className="mb-3 text-3xl font-bold">
              Get where you need to go.
            </h2>
            <p className="mb-6 text-gray-600">
              Sign in to book rides and view your ride history.
            </p>
            <div className="flex gap-3">
              <SignInButton mode="modal">
                <button className="rounded-lg bg-gray-800 px-5 py-3 text-white">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-lg border px-5 py-3">
                  Create Account
                </button>
              </SignUpButton>
            </div>
          </section>
        </Show>

        <Show when="signed-in">
          {role === "loading" && <p>Loading your account...</p>}

          {role === "error" && (
            <p className="text-red-600">
              Could not load your account role. Please refresh the page.
            </p>
          )}

          {role === "driver" && <DriverDashboard />}

          {role === "customer" && (
            <>
              <section className="rounded-xl border bg-white p-6">
                <h2 className="mb-2 text-2xl font-bold">Book a Ride</h2>
                <p className="mb-6 text-gray-600">
                  Enter your starting point and destination.
                </p>

                <form onSubmit={bookRide} className="space-y-4">
                  <div>
                    <label className="mb-1 block font-medium">
                      Pickup Address
                    </label>
                    <input
                      className="w-full rounded-lg border p-3"
                      value={pickup}
                      onChange={(event) => setPickup(event.target.value)}
                      placeholder="e.g. ABES Institute, Ghaziabad"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-medium">
                      Destination Address
                    </label>
                    <input
                      className="w-full rounded-lg border p-3"
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      placeholder="e.g. Anand Vihar, Delhi"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-gray-800 px-6 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {loading ? "Please wait..." : "Book Ride"}
                  </button>
                </form>

                {message && (
                  <p className="mt-4 rounded-lg bg-gray-100 p-3 text-sm">
                    {message}
                  </p>
                )}
              </section>

              <section className="rounded-xl border bg-white p-6">
                <h2 className="mb-2 text-2xl font-bold">
                  Select Ride Locations
                </h2>

                <p className="mb-4 text-gray-600">
                  Choose which location to set, then click the map.
                </p>

                <div className="mb-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveSelection("pickup")}
                    className={`rounded-lg px-4 py-2 font-medium ${
                      activeSelection === "pickup"
                        ? "bg-gray-900 text-white"
                        : "border bg-white text-gray-700"
                    }`}
                  >
                    Select Pickup
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSelection("destination")}
                    className={`rounded-lg px-4 py-2 font-medium ${
                      activeSelection === "destination"
                        ? "bg-gray-900 text-white"
                        : "border bg-white text-gray-700"
                    }`}
                  >
                    Select Destination
                  </button>
                </div>

                <RideMap
                  activeSelection={activeSelection}
                  pickupCoords={pickupCoords}
                  destinationCoords={destinationCoords}
                  onSelectPickup={setPickupCoords}
                  onSelectDestination={setDestinationCoords}
                  onRouteInfo={setRouteInfo}
                />
              </section>

              <section className="rounded-xl border bg-white p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold">My Rides</h2>
                  <button
                    onClick={loadRides}
                    disabled={loading}
                    className="rounded-lg border px-4 py-2 disabled:opacity-50"
                  >
                    Refresh Rides
                  </button>
                </div>

                {rides.length === 0 ? (
                  <p className="text-gray-600">
                    No rides loaded yet. Select Refresh Rides to view your
                    rides.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rides.map((ride) => (
                      <div key={ride.id} className="rounded-lg border p-4">
                        <p className="font-semibold">
                          Ride #{ride.id} — {ride.status}
                        </p>
                        <p className="mt-2 text-sm">
                          <strong>Pickup:</strong> {ride.pickup_address}
                        </p>
                        <p className="text-sm">
                          <strong>Destination:</strong> {ride.destination_address}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                          Fare: {ride.fare ?? "Not calculated yet"}
                          {ride.status === "requested" && (
                            <button
                              type="button"
                              onClick={() => cancelRide(ride.id)}
                              disabled={loading}
                              className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                            >
                              Cancel Ride
                            </button>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <CustomerTracking rides={rides} />
            </>
          )}
          <SupportCenter role={role} />
          <ProfileSettings />
          <RideReviews />
          <PaymentCenter /> 
        </Show>
      </main>
    </div>
  );
}

export default App;
