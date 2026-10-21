
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_URL = "https://gantavaya.onrender.com/api/rides";

export default function SupportCenter({ role }) {
  const { getToken } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rideId, setRideId] = useState("");
  const [replies, setReplies] = useState({});
  const [statuses, setStatuses] = useState({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiRequest = useCallback(async (url, options = {}) => {
    const token = await getToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    return data;
  }, [getToken]);

  const loadTickets = useCallback(async () => {
    try {
      setError("");

      const endpoint =
        role === "admin"
          ? `${API_URL}/support/admin/all`
          : `${API_URL}/support/mine`;

      const data = await apiRequest(endpoint);
      setTickets(data);

      setStatuses((previous) => {
        const updated = { ...previous };
        data.forEach((ticket) => {
          updated[ticket.id] = ticket.status;
        });
        return updated;
      });
    } catch (err) {
      setError(err.message);
    }
  }, [apiRequest, role]);

  useEffect(() => {
  const timer = setTimeout(() => {
    void loadTickets();
  }, 0);

  return () => clearTimeout(timer);
}, [loadTickets]);

  async function submitTicket(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    try {
      await apiRequest(`${API_URL}/support`, {
        method: "POST",
        body: JSON.stringify({
          subject,
          message,
          ...(rideId.trim() ? { rideId: rideId.trim() } : {}),
        }),
      });

      setSubject("");
      setMessage("");
      setRideId("");
      setNotice("Support ticket submitted successfully.");
      await loadTickets();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(ticketId) {
    setLoading(true);
    setError("");
    setNotice("");

    const payload = {
      status: statuses[ticketId],
      ...(replies[ticketId]?.trim()
        ? { adminReply: replies[ticketId].trim() }
        : {}),
    };

    try {
      await apiRequest(`${API_URL}/support/admin/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setReplies((previous) => ({
        ...previous,
        [ticketId]: "",
      }));

      setNotice(`Ticket #${ticketId} updated.`);
      await loadTickets();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">
            {role === "admin" ? "Support Management" : "Help & Support"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {role === "admin"
              ? "Review customer issues and respond to tickets."
              : "Submit an issue and check the status of your requests."}
          </p>
        </div>

        <button
          type="button"
          onClick={loadTickets}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {notice && (
        <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {role !== "admin" && (
        <form
          onSubmit={submitTicket}
          className="space-y-4 rounded-xl border bg-white p-5"
        >
          <h3 className="text-lg font-semibold">Create a Support Ticket</h3>

          <div className="space-y-1">
            <label htmlFor="ticket-subject" className="text-sm font-medium">
              Issue subject
            </label>
            <input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={150}
              required
              className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
              placeholder="e.g. Payment issue"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ticket-message" className="text-sm font-medium">
              Describe your issue
            </label>
            <textarea
              id="ticket-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={5000}
              required
              rows={4}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Explain how we can help..."
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="ticket-ride" className="text-sm font-medium">
              Ride ID (optional)
            </label>
            <input
              id="ticket-ride"
              type="number"
              min="1"
              value={rideId}
              onChange={(event) => setRideId(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Enter a ride ID if relevant"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Ticket"}
          </button>
        </form>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {role === "admin" ? "All Support Tickets" : "Your Tickets"}
        </h3>

        {tickets.length === 0 ? (
          <p className="rounded-xl border bg-white p-5 text-sm text-gray-600">
            No support tickets found.
          </p>
        ) : (
          tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="space-y-3 rounded-xl border bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold">
                    #{ticket.id} — {ticket.subject}
                  </h4>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(ticket.created_at).toLocaleString()}
                    {ticket.ride_id ? ` · Ride #${ticket.ride_id}` : ""}
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
                  {ticket.status.replace("_", " ")}
                </span>
              </div>

              {role === "admin" && (
                <p className="text-sm text-gray-500">
                  Customer ID: {ticket.user_id}
                </p>
              )}

              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {ticket.message}
              </p>

              {ticket.admin_reply && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-blue-800">
                    Support reply
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-blue-950">
                    {ticket.admin_reply}
                  </p>
                </div>
              )}

              {role === "admin" && (
                <div className="space-y-3 border-t pt-3">
                  <div className="space-y-1">
                    <label
                      htmlFor={`status-${ticket.id}`}
                      className="text-sm font-medium"
                    >
                      Status
                    </label>
                    <select
                      id={`status-${ticket.id}`}
                      value={statuses[ticket.id] || ticket.status}
                      onChange={(event) =>
                        setStatuses((previous) => ({
                          ...previous,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`reply-${ticket.id}`}
                      className="text-sm font-medium"
                    >
                      Reply to customer
                    </label>
                    <textarea
                      id={`reply-${ticket.id}`}
                      value={replies[ticket.id] || ""}
                      onChange={(event) =>
                        setReplies((previous) => ({
                          ...previous,
                          [ticket.id]: event.target.value,
                        }))
                      }
                      rows={3}
                      maxLength={5000}
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="Write a reply, or leave blank to only update status"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => updateTicket(ticket.id)}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
