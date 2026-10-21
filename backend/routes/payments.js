const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
const express = require("express");
const Stripe = require("stripe");
const { getAuth } = require("@clerk/express");
const pool = require("../db");

const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

// Create a Checkout session for a completed ride
router.post("/checkout-session", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rideId = Number(req.body.ride_id);
    if (!Number.isSafeInteger(rideId) || rideId <= 0) {
      return res.status(400).json({ error: "Invalid ride ID" });
    }

    const rideResult = await pool.query(
      `SELECT id, customer_id, fare, status
       FROM rides
       WHERE id = $1`,
      [rideId]
    );

    if (!rideResult.rows.length) {
      return res.status(404).json({ error: "Ride not found" });
    }

    const ride = rideResult.rows[0];

    if (ride.customer_id !== userId) {
      return res.status(403).json({ error: "This ride does not belong to you" });
    }
    if (ride.status !== "completed") {
      return res.status(400).json({
        error: "Payment is available only for completed rides",
      });
    }

    const amount = Math.round(Number(ride.fare) * 100);

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid ride fare" });
    }

    const existingResult = await pool.query(
      "SELECT * FROM payments WHERE ride_id = $1",
      [rideId]
    );

    let payment = existingResult.rows[0];

    if (payment?.status === "paid") {
      return res.status(409).json({ error: "This ride is already paid" });
    }

    // Reuse an existing open Checkout session if possible.
    if (payment?.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          payment.stripe_session_id
        );

        if (
          existingSession.status === "open" &&
          existingSession.metadata?.customer_id === userId
        ) {
          return res.json({ url: existingSession.url });
        }
      } catch (error) {
        console.error("Could not retrieve previous Checkout session:", error.message);
      }
    }

    if (!payment) {
      const inserted = await pool.query(
        `INSERT INTO payments (ride_id, customer_id, amount, currency)
         VALUES ($1, $2, $3, 'inr')
         ON CONFLICT (ride_id) DO NOTHING
         RETURNING *`,
        [rideId, userId, (amount / 100).toFixed(2)]
      );

      payment = inserted.rows[0];

      // Handle a concurrent request for the same ride.
      if (!payment) {
        const retry = await pool.query(
          "SELECT * FROM payments WHERE ride_id = $1",
          [rideId]
        );
        payment = retry.rows[0];

        if (payment?.status === "paid") {
          return res.status(409).json({ error: "This ride is already paid" });
        }
      }
    }

    if (!payment || payment.customer_id !== userId) {
      return res.status(409).json({ error: "Could not prepare payment" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: String(rideId),
      metadata: {
        ride_id: String(rideId),
        customer_id: userId,
      },
      payment_intent_data: {
        metadata: {
          ride_id: String(rideId),
          customer_id: userId,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `Gantavaya ride #${rideId}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/?payment=cancelled`,
    });

    await pool.query(
      `UPDATE payments
       SET amount = $1,
           stripe_session_id = $2,
           status = 'pending',
           updated_at = NOW()
       WHERE ride_id = $3 AND customer_id = $4`,
      [(amount / 100).toFixed(2), session.id, rideId, userId]
    );

    res.json({ url: session.url });
  } catch (error) {
    console.error("Create Checkout session:", error);
    res.status(500).json({ error: "Could not start payment" });
  }
});

// Verify payment directly with Stripe before updating our database.
router.get("/verify/:sessionId", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await stripe.checkout.sessions.retrieve(
      req.params.sessionId
    );

    if (
      session.metadata?.customer_id !== userId ||
      !session.metadata?.ride_id
    ) {
      return res.status(403).json({ error: "Invalid payment session" });
    }

    const rideId = Number(session.metadata.ride_id);

    const result = await pool.query(
      `SELECT p.*, r.customer_id AS ride_customer_id, r.fare
       FROM payments p
       JOIN rides r ON r.id = p.ride_id
       WHERE p.ride_id = $1
         AND p.customer_id = $2
         AND p.stripe_session_id = $3`,
      [rideId, userId, session.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    const payment = result.rows[0];
    const expectedAmount = Math.round(Number(payment.fare) * 100);

    if (
      payment.ride_customer_id !== userId ||
      Number(session.amount_total) !== expectedAmount ||
      session.currency !== "inr"
    ) {
      return res.status(400).json({ error: "Payment details do not match" });
    }

    if (session.payment_status === "paid") {
      await pool.query(
        `UPDATE payments
         SET status = 'paid',
             stripe_payment_intent_id = $1,
             updated_at = NOW()
         WHERE ride_id = $2
           AND customer_id = $3
           AND stripe_session_id = $4`,
        [
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
          rideId,
          userId,
          session.id,
        ]
      );

      // Send email receipt using Resend
      const receiptEmail = session.customer_details?.email;
      if (receiptEmail) {
        const { data, error } = await resend.emails.send(
          {
            from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
            to: [receiptEmail],
            subject: `Gantavaya Payment Receipt — Ride #${rideId}`,
            html: `
              <h2>Payment Successful!</h2>
              <p>Thank you for riding with Gantavaya.</p>
              <p><strong>Ride ID:</strong> ${rideId}</p>
              <p><strong>Amount Paid:</strong> ₹${(expectedAmount / 100).toFixed(2)}</p>
              <p><strong>Payment Status:</strong> Paid</p>
              <p>This receipt confirms your successful test-mode Stripe payment.</p>
            `,
          },
          { idempotencyKey: `receipt-${session.id}` }
        );

        if (error) {
          console.error("Receipt email failed:", error);
        } else {
          console.log("Receipt email sent:", data?.id);
        }
      }

      return res.json({
        status: "paid",
        ride_id: rideId,
        amount: payment.amount,
        currency: "inr",
      });
    }

    res.json({
      status: session.status === "expired" ? "failed" : "pending",
      ride_id: rideId,
    });
  } catch (error) {
    console.error("Verify payment:", error);
    res.status(500).json({ error: "Could not verify payment" });
  }
});

// Get the signed-in customer's payment history/receipts
router.get("/mine", async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await pool.query(
      `SELECT p.id, p.ride_id, p.amount, p.currency, p.status,
              p.created_at, r.pickup_address, r.destination_address
       FROM payments p
       JOIN rides r ON r.id = p.ride_id
       WHERE p.customer_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get payments:", error);
    res.status(500).json({
      error: "Could not load payment history",
      details: error.message,
      code: error.code,
    });
  }
});



// router.get("/test-email", async (req, res) => {
//   try {
//     const { data, error } = await resend.emails.send({
//       from: process.env.RESEND_FROM_EMAIL,
//       to: ["delivered@resend.dev"],
//       subject: "Gantavaya Email Test",
//       html: "<p>Gantavaya email integration is working.</p>",
//     });

//     if (error) {
//       console.error("Resend test failed:", error);
//       return res.status(500).json({ error: error.message });
//     }

//     console.log("Resend test accepted:", data?.id);
//     res.json({ success: true, id: data?.id });
//   } catch (error) {
//     console.error("Resend test exception:", error);
//     res.status(500).json({ error: error.message });
//   }
// });


module.exports = router;