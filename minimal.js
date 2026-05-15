require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// Body parsing middleware - must come first
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Mock authentication middleware (replace with your actual auth middleware)
app.use((req, res, next) => {
  // For testing, you can set a mock user
  // In production, use your actual authentication middleware
  req.user = { id: 'test-user-id' }; // Mock user ID for testing
  next();
});

// Import routes
const reviewRoutes = require('./routes/productReviews');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');

// Routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Minimal test route with MongoDB',
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// Use routes
app.use('/api/product-reviews', reviewRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Connect to MongoDB and start server
const PORT = 9000; // Changed to port 9000 as requested

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('MongoDB connected successfully');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});
