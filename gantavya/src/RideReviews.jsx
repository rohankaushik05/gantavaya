
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_URL = "https://gantavaya.onrender.com/api/rides";

export default function RideReviews() {
  const { getToken } = useAuth();

  const [rides, setRides] = useState([]);
  const [reviews, setReviews] = useState({});
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});
  const [messages, setMessages] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const token = await getToken();

      const response = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load rides");
      }

      const completed = data.filter(
        (ride) => ride.status === "completed" && ride.driver_id
      );

      setRides(completed);

      const tokenHeader = { Authorization: `Bearer ${token}` };

      const results = await Promise.all(
        [...new Set(completed.map((ride) => ride.driver_id))].map(
          async (driverId) => {
            const res = await fetch(
              `${API_URL}/driver/${encodeURIComponent(driverId)}/reviews`,
              { headers: tokenHeader }
            );

            if (!res.ok) return [driverId, null];
            return [driverId, await res.json()];
          }
        )
      );

      setReviews(Object.fromEntries(results.filter(([, data]) => data)));
    } catch (error) {
      setMessages({ page: error.message });
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitReview(rideId) {
    try {
      setMessages((prev) => ({ ...prev, [rideId]: "" }));

      const token = await getToken();
      const response = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ride_id: rideId,
          rating: Number(ratings[rideId] || 5),
          comment: comments[rideId] || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not submit review");
      }

      setMessages((prev) => ({
        ...prev,
        [rideId]: "Review submitted successfully.",
      }));

      await loadData();
    } catch (error) {
      setMessages((prev) => ({ ...prev, [rideId]: error.message }));
    }
  }

  if (loading) return <p>Loading reviews...</p>;

  return (
    <section className="my-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">Ratings & Reviews</h2>
      <p className="mb-5 text-sm text-gray-500">
        Rate your completed rides and see driver feedback.
      </p>

      {messages.page && (
        <p className="mb-4 text-sm text-red-600">{messages.page}</p>
      )}

      {rides.length === 0 ? (
        <p className="text-gray-500">
          Your completed rides with assigned drivers will appear here.
        </p>
      ) : (
        <div className="space-y-5">
          {rides.map((ride) => {
            const driverData = reviews[ride.driver_id];
            const rideAlreadyReviewed = driverData?.reviews?.some(
              (review) => String(review.ride_id) === String(ride.id)
            );

            return (
              <article
                key={ride.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <p className="font-medium">
                  {ride.pickup_address} → {ride.destination_address}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Ride #{ride.id} · Fare: ₹{ride.fare}
                </p>

                {driverData && (
                  <div className="mt-3">
                    <p className="font-medium">
                      Driver rating: ⭐{" "}
                      {driverData.summary.average_rating ?? "No ratings"}{" "}
                      <span className="text-sm font-normal text-gray-500">
                        ({driverData.summary.total_reviews} reviews)
                      </span>
                    </p>
                  </div>
                )}

                {rideAlreadyReviewed ? (
                  <p className="mt-3 text-sm text-green-700">
                    You have reviewed this ride.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    <label className="block text-sm font-medium">
                      Your rating
                      <select
                        value={ratings[ride.id] || "5"}
                        onChange={(e) =>
                          setRatings((prev) => ({
                            ...prev,
                            [ride.id]: e.target.value,
                          }))
                        }
                        className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
                      >
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Very good</option>
                        <option value="3">3 - Good</option>
                        <option value="2">2 - Poor</option>
                        <option value="1">1 - Very poor</option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium">
                      Comment (optional)
                      <textarea
                        value={comments[ride.id] || ""}
                        onChange={(e) =>
                          setComments((prev) => ({
                            ...prev,
                            [ride.id]: e.target.value,
                          }))
                        }
                        maxLength={500}
                        rows={3}
                        placeholder="Share your experience..."
                        className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
                      />
                    </label>

                    <button
                      onClick={() => submitReview(ride.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Submit Review
                    </button>
                  </div>
                )}

                {messages[ride.id] && (
                  <p role="status" className="mt-3 text-sm">
                    {messages[ride.id]}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
