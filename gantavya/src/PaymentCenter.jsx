
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_URL = "https://gantavaya.onrender.com/api";

export default function PaymentCenter() {
  const { getToken } = useAuth();

  const [rides, setRides] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [ridesResponse, paymentsResponse] = await Promise.all([
        fetch(`${API_URL}/rides`, { headers }),
        fetch(`${API_URL}/payments/mine`, { headers }),
      ]);

      const ridesData = await ridesResponse.json();
      const paymentsData = await paymentsResponse.json();

      if (!ridesResponse.ok) {
        throw new Error(ridesData.error || "Could not load rides");
      }
      if (!paymentsResponse.ok) {
        throw new Error(paymentsData.error || "Could not load payments");
      }

      setRides(
        ridesData.filter(
          (ride) => ride.status === "completed" && ride.driver_id
        )
      );
      setPayments(paymentsData);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    const timer = setTimeout(()=>{
        void loadData();
    }, 0);
    return ()=> clearTimeout(timer);
  }, [loadData]);

async function payForRide(ride) {
    setSelectedRide(ride);
    setMessage("");
    setError("");
    setProcessing(true);

    try {
      const token = await getToken();

      // Calls your backend Stripe checkout-session endpoint
      const response = await fetch(`${API_URL}/payments/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ride_id: ride.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start payment");
      }

      // Securely redirect to Stripe Checkout
      if (data.url) {
        window.location.assign(data.url);
      } else {
        throw new Error("No checkout URL returned from server");
      }
    } catch (err) {
      setError(err.message);
      setProcessing(false);
    }
  }

  if (loading) {
    return <p className="my-6 text-gray-500">Loading payment center...</p>;
  }

  return (
    <section className="my-6 max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900">Payments & Receipts</h2>
      <p className="mt-1 text-sm text-gray-500">
        Demo transactions only. No real money or card details are used.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
          <p role="status" className="font-medium text-green-800">{message}</p>
          <p className="mt-1 text-sm text-green-700">
            This is a simulated transaction for project demonstration.
          </p>
        </div>
      )}

      <h3 className="mb-3 mt-6 font-semibold">Completed Rides</h3>

      {rides.length === 0 ? (
        <p className="text-sm text-gray-500">
          Completed rides with an assigned driver will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => {
            const payment = payments.find(
              (item) => String(item.ride_id) === String(ride.id)
            );
            const paid = payment?.status === "paid";

            return (
              <div key={ride.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Ride #{ride.id}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {ride.pickup_address} → {ride.destination_address}
                    </p>
                    <p className="mt-2 font-semibold">₹{ride.fare}</p>
                  </div>

                  {paid ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
                      Paid
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => payForRide(ride)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {processing && selectedRide?.id === ride.id
                        ? "Processing..."
                        : "Pay Now"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="mb-3 mt-8 font-semibold">Payment History / Receipts</h3>

      {payments.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions yet.</p>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-xl bg-gray-50 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">Ride #{payment.ride_id}</p>
                <p className="font-semibold">₹{payment.amount}</p>
              </div>
              <p className="mt-1 text-sm capitalize text-gray-600">
                Status: {payment.status}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Date: {new Date(payment.created_at).toLocaleString()}
              </p>
              {payment.status === "paid" && (
                <button
                  type="button"
                  onClick={() =>
                    window.print()
                  }
                  className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-white"
                >
                  Print Receipt
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
