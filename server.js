require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');


// Initialize express app
const app = express();

// Body parsing middleware - must come first
// Increase limits for profile picture uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static('public/uploads'));

const allowedOrigins = ['http://localhost:5173', 'http://localhost:9000','http://localhost:4173', 'https://chasenorth.com', 'https://www.chasenorth.com'];

// CORS configuration - using the working config from minimal.js
// app.use(cors({
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl requests)
//     if (!origin) return callback(null, true);
//
//     if (allowedOrigins.indexOf(origin) === -1) {
//       const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
//       return callback(new Error(msg), false);
//     }
//     return callback(null, true);
//   },
//   credentials: true,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));
// Configure CORS with allowed headers including x-auth-token
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['x-auth-token']
}));

// Mock authentication middleware (from minimal.js)
app.use((req, res, next) => {
  // For testing, you can set a mock user
  // In production, use your actual authentication middleware
  req.user = { id: 'test-user-id' }; // Mock user ID for testing
  next();
});

// Import routes (combining both files)
const reviewRoutes = require('./routes/productReviews');
const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const subscribeRoute = require('./routes/subscribeRoute');
const adminRoutes = require('./routes/adminRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const productAdminRoutes = require('./routes/productAdminRoutes');
const adminOrderRoutes = require('./routes/adminOrderRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const reportRoutes = require('./routes/reportRoutes');
const bugReportRoutes = require('./routes/bugReportRoutes');
const initializeCounters = require('./initializeCounter');
const adminReportRoutes = require('./routes/adminReportRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const contactRoutes = require('./routes/contactRoutes');

// Test route from minimal.js
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Server is running with combined configuration',
    mongoConnected: mongoose.connection.readyState === 1
  });
});

// Root route
app.get("/", (req, res) => {
  res.send('Hello from the combined backend server!');
});

// Use routes (only enable what's working from minimal.js)
app.use('/api/product-reviews', reviewRoutes);
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bug-report', bugReportRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/contact', contactRoutes);

// Additional routes (commented out for now - enable one by one as needed)
app.use('/api/upload', uploadRoutes);
// app.use('/api/subscribe', subscribeRoute);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/products', productAdminRoutes);
app.use('/api/admin/orders', adminOrderRoutes);
app.use('/api/admin/reports', adminReportRoutes);

// Error handling middleware (from minimal.js)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Connect to MongoDB and start server (from minimal.js with better error handling)
const PORT = process.env.PORT || 9000;

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('MongoDB connected successfully');
  // app.listen(PORT, () => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    initializeCounters().then(initialized => {
      if (initialized) {
        console.log('Counters initialized successfully');
      }
    });
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Export app for testing
module.exports = app;

// open package.json file in backend folder
//  since we have created a server.js file, our main entry file will be server.js
// main: server.js

// run the server using node for the production
// start: "node backend/server.js"

// in development we will be making use of nodemon library
// "dev": "nodemon backend/server.js"

// npm run dev
// you should see the log below
// Server running on http://localhost:9000
// in Link you will be able to see the 'Hello from the backend server!' message
// If you see this, then you have successfully set up the express app


// User Schema
// ----------------------------------------------------------------------------
// | Field Name | Type     | Constraints                                      |
// |------------|----------|--------------------------------------------------|
// | _id        | ObjectId | Primary key, auto-generated by MongoDB           |
// | name       | String   | Required, trimmed of whitespace                  |
// | email      | String   | Required, unique, trimmed, email validated       |
// | password   | String   | Required, minimum length: 6                      |
// | role       | String   | Enum: ["customer", "admin"], Default: "customer" |
// | createdAt  | Date     | Auto-generated timestamp                         |
// | updatedAt  | Date     | Auto-updated timestamp                           |