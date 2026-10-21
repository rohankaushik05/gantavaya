const express = require("express");
const { getAuth } = require("@clerk/express");
const pool = require("../db");

const router = express.Router();

// Get rides belonging to the signed-in customer
router.get("/", async (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "Please sign in" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM rides WHERE customer_id = $1 ORDER BY created_at DESC",
      [userId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Fetch rides error:", error.message);
    res.status(500).json({ error: "Failed to fetch rides" });
  }
});

// Create a ride
router.post("/", async (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "Please sign in" });
  }

  const {
    pickup_address,
    pickup_lat,
    pickup_lng,
    destination_address,
    destination_lat,
    destination_lng,
    fare,
  } = req.body;

  if (
    typeof pickup_address !== "string" ||
    !pickup_address.trim() ||
    typeof destination_address !== "string" ||
    !destination_address.trim()
  ) {
    return res.status(400).json({
      error: "Pickup and destination addresses are required",
    });
  }

  const coordinates = [
    pickup_lat,
    pickup_lng,
    destination_lat,
    destination_lng,
  ];

  if (
    coordinates.some(
      (value) =>
        value != null && (typeof value !== "number" || !Number.isFinite(value)),
    )
  ) {
    return res.status(400).json({
      error: "Coordinates must be valid numbers",
    });
  }

  if (
    fare != null &&
    (typeof fare !== "number" || !Number.isFinite(fare) || fare < 0)
  ) {
    return res
      .status(400)
      .json({ error: "Fare must be a valid non-negative number" });
  }

  try {
    // Ensure this Clerk user has a profile for the rides foreign key
    await pool.query(
      `INSERT INTO profiles (id, role)
       VALUES ($1, 'customer')
       ON CONFLICT (id) DO NOTHING`,
      [userId],
    );

    const result = await pool.query(
      `INSERT INTO rides (
    customer_id,
    pickup_address,
    pickup_lat,
    pickup_lng,
    destination_address,
    destination_lat,
    destination_lng,
    fare
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *`,
      [
        userId,
        pickup_address.trim(),
        pickup_lat ?? null,
        pickup_lng ?? null,
        destination_address.trim(),
        destination_lat ?? null,
        destination_lng ?? null,
        fare ?? null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({ error: "Failed to create ride" });
  }
});

router.patch("/:id/cancel", async (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "Please sign in" });
  }

  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE rides
       SET status = 'cancelled'
       WHERE id = $1
         AND customer_id = $2
         AND status = 'requested'
       RETURNING *`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: "Ride not found or cannot be cancelled",
      });
    }

    res.json({
      message: "Ride cancelled successfully",
      ride: result.rows[0],
    });
  } catch (error) {
    console.error("Cancel ride error:", error.message);
    res.status(500).json({ error: "Failed to cancel ride" });
  }
});

async function requireDriver(req, res) {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    res.status(401).json({ error: "Please sign in" });
    return null;
  }

  const result = await pool.query("SELECT role FROM profiles WHERE id = $1", [
    userId,
  ]);

  if (result.rows[0]?.role !== "driver") {
    res.status(403).json({ error: "Driver access required" });
    return null;
  }

  return userId;
}

// View available ride requests
router.get("/driver/requests", async (req, res) => {
  try {
    const driverId = await requireDriver(req, res);
    if (!driverId) return;

    const result = await pool.query(
      `SELECT * FROM rides
       WHERE status = 'requested'
       ORDER BY created_at ASC`,
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Driver requests error:", error.message);
    res.status(500).json({ error: "Failed to load ride requests" });
  }
});

// Accept a ride
router.patch("/:id/accept", async (req, res) => {
  try {
    const driverId = await requireDriver(req, res);
    if (!driverId) return;

    const result = await pool.query(
      `UPDATE rides
       SET driver_id = $1, status = 'accepted'
       WHERE id = $2 AND status = 'requested'
       RETURNING *`,
      [driverId, req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        error: "Ride is unavailable or already accepted",
      });
    }

    res.json({ message: "Ride accepted successfully", ride: result.rows[0] });
  } catch (error) {
    console.error("Accept ride error:", error.message);
    res.status(500).json({ error: "Failed to accept ride" });
  }
});

// Update an assigned ride's status
router.patch("/:id/status", async (req, res) => {
  try {
    const driverId = await requireDriver(req, res);
    if (!driverId) return;

    const { status } = req.body;

    if (!["ongoing", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid ride status" });
    }

    const result = await pool.query(
      `UPDATE rides
       SET status = $1
       WHERE id = $2
         AND driver_id = $3
         AND (
           (status = 'accepted' AND $1 = 'ongoing')
           OR (status = 'ongoing' AND $1 = 'completed')
         )
       RETURNING *`,
      [status, req.params.id, driverId],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        error: "Ride not found or status transition not allowed",
      });
    }

    res.json({ message: "Ride status updated", ride: result.rows[0] });
  } catch (error) {
    console.error("Update ride status error:", error.message);
    res.status(500).json({ error: "Failed to update ride status" });
  }
});

// Get rides assigned to the signed-in driver
router.get("/driver/mine", async (req, res) => {
  try {
    const driverId = await requireDriver(req, res);
    if (!driverId) return;

    const result = await pool.query(
      `SELECT * FROM rides
       WHERE driver_id = $1
       ORDER BY created_at DESC`,
      [driverId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Fetch driver rides error:", error.message);
    res.status(500).json({ error: "Failed to load driver rides" });
  }
});


router.get("/role", async (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "Please sign in" });
  }

  try {
    const result = await pool.query(
      "SELECT role FROM profiles WHERE id = $1",
      [userId]
    );

    res.json({
      role: result.rows[0]?.role || "customer"
    });
  } catch (error) {
    console.error("Role lookup error:", error.message);
    res.status(500).json({ error: "Failed to check account role" });
  }
});

// Driver sends GPS coordinates during an ongoing ride
router.post("/:id/location", async (req, res) => {
  try {
    const driverId = await requireDriver(req, res);
    if (!driverId) return;

    const { latitude, longitude } = req.body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      return res.status(400).json({ error: "Invalid GPS coordinates" });
    }

    const ride = await pool.query(
      `SELECT id FROM rides
       WHERE id = $1 AND driver_id = $2 AND status = 'ongoing'`,
      [req.params.id, driverId]
    );

    if (ride.rows.length === 0) {
      return res.status(403).json({
        error: "Only the assigned driver can share location during an ongoing ride"
      });
    }

    await pool.query(
      `INSERT INTO ride_locations
       (ride_id, driver_id, latitude, longitude)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, driverId, latitude, longitude]
    );

    res.json({ message: "Location updated successfully" });
  } catch (error) {
    console.error("Save driver location error:", error.message);
    res.status(500).json({ error: "Failed to save driver location" });
  }
});

// Customer retrieves the latest location of their assigned driver
router.get("/:id/location", async (req, res) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated) {
    return res.status(401).json({ error: "Please sign in" });
  }

  try {
    const ride = await pool.query(
      `SELECT id FROM rides
       WHERE id = $1 AND customer_id = $2
         AND driver_id IS NOT NULL
         AND status IN ('accepted', 'ongoing')`,
      [req.params.id, userId]
    );

    if (ride.rows.length === 0) {
      return res.status(404).json({
        error: "No trackable ride found for this customer"
      });
    }

    const result = await pool.query(
      `SELECT latitude, longitude, recorded_at
       FROM ride_locations
       WHERE ride_id = $1
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Driver location has not been shared yet"
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get driver location error:", error.message);
    res.status(500).json({ error: "Failed to get driver location" });
  }
});

// Driver earnings summary
router.get("/driver/earnings", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roleCheck = await pool.query(
      "SELECT role FROM profiles WHERE id = $1",
      [userId]
    );

    if (roleCheck.rows[0]?.role !== "driver") {
      return res.status(403).json({ error: "Driver access required" });
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_rides,
         COALESCE(SUM(fare) FILTER (WHERE status = 'completed'), 0) AS total_earnings
       FROM rides
       WHERE driver_id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Driver earnings error:", error);
    res.status(500).json({ error: "Could not load earnings" });
  }
});


/* Create a support ticket */
router.post("/support", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { subject, message, rideId } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({
        error: "Subject and message are required",
      });
    }

    await pool.query(
      `INSERT INTO profiles (id, role)
       VALUES ($1, 'customer')
       ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    if (rideId) {
      const ride = await pool.query(
        `SELECT id FROM rides
         WHERE id = $1
         AND (customer_id = $2 OR driver_id = $2)`,
        [rideId, userId]
      );

      if (!ride.rows.length) {
        return res.status(403).json({
          error: "You cannot submit a ticket for this ride",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO support_tickets
       (user_id, ride_id, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, rideId || null, subject.trim(), message.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create support ticket:", error);
    res.status(500).json({ error: "Could not create support ticket" });
  }
});

/* View your own support tickets */
router.get("/support/mine", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT * FROM support_tickets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Load support tickets:", error);
    res.status(500).json({ error: "Could not load support tickets" });
  }
});


/* Admin: View all support tickets */
router.get("/support/admin/all", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roleResult = await pool.query(
      "SELECT role FROM profiles WHERE id = $1",
      [userId]
    );

    if (roleResult.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const result = await pool.query(
      `SELECT * FROM support_tickets
       ORDER BY
         CASE WHEN status = 'open' THEN 0
              WHEN status = 'in_progress' THEN 1
              ELSE 2 END,
         created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Load admin tickets:", error);
    res.status(500).json({ error: "Could not load support tickets" });
  }
});

/* Admin: Reply to a ticket and update its status */
router.patch("/support/admin/:id", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const roleResult = await pool.query(
      "SELECT role FROM profiles WHERE id = $1",
      [userId]
    );

    if (roleResult.rows[0]?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { adminReply, status } = req.body;
    const allowedStatuses = ["open", "in_progress", "resolved"];

    if (
      status !== undefined &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({ error: "Invalid ticket status" });
    }

    if (
      adminReply !== undefined &&
      (typeof adminReply !== "string" || !adminReply.trim())
    ) {
      return res.status(400).json({ error: "Reply cannot be empty" });
    }

    if (status === undefined && adminReply === undefined) {
      return res.status(400).json({
        error: "Provide a reply or a status",
      });
    }

    const result = await pool.query(
      `UPDATE support_tickets
       SET admin_reply = COALESCE($1, admin_reply),
           status = COALESCE($2, status),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        adminReply === undefined ? null : adminReply.trim(),
        status ?? null,
        req.params.id,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update admin ticket:", error);
    res.status(500).json({ error: "Could not update support ticket" });
  }
});


/* Get the signed-in user's profile */
router.get("/profile", async (req, res) => {
  try {
    const userId = getAuth(req).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await pool.query(
      `INSERT INTO profiles (id, role)
       VALUES ($1, 'customer')
       ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    const result = await pool.query(
      `SELECT id, full_name, phone, role, created_at
       FROM profiles
       WHERE id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get profile:", error);
    res.status(500).json({ error: "Could not load profile" });
  }
});

/* Update the signed-in user's profile */
router.patch("/profile", async (req, res) => {
  try {
    const userId = getAuth(req).userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { full_name, phone } = req.body;

    if (full_name === undefined && phone === undefined) {
      return res.status(400).json({
        error: "Provide a name or phone number to update",
      });
    }

    if (
      (full_name !== undefined &&
        (typeof full_name !== "string" ||
          !full_name.trim() ||
          full_name.trim().length > 100)) ||
      (phone !== undefined &&
        (typeof phone !== "string" ||
          phone.trim().length > 20))
    ) {
      return res.status(400).json({
        error: "Invalid name or phone number",
      });
    }

    await pool.query(
      `INSERT INTO profiles (id, role)
       VALUES ($1, 'customer')
       ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    const result = await pool.query(
      `UPDATE profiles
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone)
       WHERE id = $3
       RETURNING id, full_name, phone, role, created_at`,
      [
        full_name === undefined ? null : full_name.trim(),
        phone === undefined ? null : phone.trim(),
        userId,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update profile:", error);
    res.status(500).json({ error: "Could not update profile" });
  }
});


/* Submit a review for a completed ride */
router.post("/reviews", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { ride_id, rating, comment = "" } = req.body;

    if (
      !Number.isInteger(Number(ride_id)) ||
      Number(ride_id) <= 0 ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      typeof comment !== "string" ||
      comment.trim().length > 500
    ) {
      return res.status(400).json({
        error: "Provide a valid ride ID, rating from 1 to 5, and comment up to 500 characters.",
      });
    }

    const rideResult = await pool.query(
      `SELECT id, customer_id, driver_id, status
       FROM rides
       WHERE id = $1`,
      [ride_id]
    );

    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const ride = rideResult.rows[0];

    if (ride.customer_id !== userId) {
      return res.status(403).json({
        error: "You can only review your own rides",
      });
    }

    if (ride.status !== "completed" || !ride.driver_id) {
      return res.status(400).json({
        error: "Only completed rides with an assigned driver can be reviewed",
      });
    }

    const result = await pool.query(
      `INSERT INTO ride_reviews
         (ride_id, customer_id, driver_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ride_id) DO NOTHING
       RETURNING id, ride_id, rating, comment, created_at`,
      [ride_id, userId, ride.driver_id, rating, comment.trim() || null]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        error: "This ride has already been reviewed",
      });
    }

    res.status(201).json({
      message: "Review submitted successfully",
      review: result.rows[0],
    });
  } catch (error) {
    console.error("Submit review:", error);
    res.status(500).json({ error: "Could not submit review" });
  }
});

/* Get reviews and average rating for a driver */
router.get("/driver/:driverId/reviews", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { driverId } = req.params;

    const driverResult = await pool.query(
      `SELECT id FROM profiles
       WHERE id = $1 AND role = 'driver'`,
      [driverId]
    );

    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const result = await pool.query(
      `SELECT
         rr.id,
         rr.ride_id,
         rr.rating,
         rr.comment,
         rr.created_at,
         COALESCE(p.full_name, 'Customer') AS customer_name
       FROM ride_reviews rr
       LEFT JOIN profiles p ON p.id = rr.customer_id
       WHERE rr.driver_id = $1
       ORDER BY rr.created_at DESC`,
      [driverId]
    );

    const summary = await pool.query(
      `SELECT
         COUNT(*)::INTEGER AS total_reviews,
         ROUND(AVG(rating)::NUMERIC, 1) AS average_rating
       FROM ride_reviews
       WHERE driver_id = $1`,
      [driverId]
    );

    res.json({
      summary: summary.rows[0],
      reviews: result.rows,
    });
  } catch (error) {
    console.error("Get driver reviews:", error);
    res.status(500).json({ error: "Could not load driver reviews" });
  }
});

module.exports = router;