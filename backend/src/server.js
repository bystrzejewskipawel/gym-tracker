require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const requireAuth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const exerciseRoutes = require('./routes/exercises');
const sessionRoutes = require('./routes/sessions');
const routineRoutes = require('./routes/routines');

const app = express();

// If FRONTEND_URL is set (e.g. in production), only allow that origin.
// Otherwise allow anything, which is fine for local prototyping.
app.use(cors(process.env.FRONTEND_URL ? { origin: process.env.FRONTEND_URL } : {}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Public auth routes (register/login issue the token used everywhere else)
app.use('/api/auth', authRoutes);

// Everything below this line requires a valid Bearer token
app.use('/api/exercises', requireAuth, exerciseRoutes);
app.use('/api/sessions', requireAuth, sessionRoutes);
app.use('/api/routines', requireAuth, routineRoutes);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Gym Tracker API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  });
