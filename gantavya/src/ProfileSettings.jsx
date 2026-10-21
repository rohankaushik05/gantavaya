
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react";

const API_URL = "https://gantavaya.onrender.com/api/rides";

const emptyProfile = {
  full_name: "",
  phone: "",
  role: "customer",
};

export default function ProfileSettings() {
  const { getToken } = useAuth();

  const [profile, setProfile] = useState(emptyProfile);
  const [form, setForm] = useState(emptyProfile);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load profile");
        }

        setProfile(data);
        setForm(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [getToken]);

  function startEditing() {
    setForm({ ...profile });
    setMessage("");
    setError("");
    setEditing(true);
  }

  function cancelEditing() {
    setForm({ ...profile });
    setEditing(false);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save profile");
      }

      setProfile(data);
      setForm(data);
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="my-6 text-gray-500">Loading profile...</p>;
  }

  return (
    <section className="my-6 max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            My Profile
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your Gantavaya account details.
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Edit Profile
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              value={form.full_name || ""}
              onChange={(e) =>
                setForm({ ...form, full_name: e.target.value })
              }
              maxLength={100}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <input
              type="tel"
              value={form.phone || ""}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              maxLength={20}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Account Role
            </label>
            <p className="rounded-lg bg-gray-50 px-3 py-2 capitalize text-gray-600">
              {profile.role}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="rounded-lg border border-gray-300 px-5 py-2 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Full Name</p>
            <p className="mt-1 font-medium text-gray-900">
              {profile.full_name || "Not provided"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Phone Number</p>
            <p className="mt-1 font-medium text-gray-900">
              {profile.phone || "Not provided"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Account Role</p>
            <p className="mt-1 font-medium capitalize text-gray-900">
              {profile.role}
            </p>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-green-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
