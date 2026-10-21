const express = require('express')
const cors = require('cors')
const pool = require('./db')
const ridesRouter = require('./routes/rides')
const paymentsRouter = require("./routes/payments");
const { clerkMiddleware, getAuth } = require('@clerk/express')
require('dotenv').config()

const app = express()

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(clerkMiddleware());

app.use("/api/payments", paymentsRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Gantavaya backend is running!' })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' })
})


app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS time')
    res.json({
      status: 'Database connected',
      time: result.rows[0].time,
    })
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({
      status: 'Database connection failed',
      error: error.message,
      code: error.code,
    })
  }
})
const PORT = process.env.PORT || 5000

app.use('/api/rides', ridesRouter)
app.get('/api/auth-check', (req, res) => {
  const { isAuthenticated, userId } = getAuth(req)

  if (!isAuthenticated) {
    return res.status(401).json({
      authenticated: false,
      message: 'Please sign in',
    })
  }

  res.json({
    authenticated: true,
    userId,
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})