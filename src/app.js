import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import alertRoutes from './routes/alertRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  'https://hustleguard-web.vercel.app',
  'https://hustleguard-web.vercel.app/', // Sometimes trailing slash matters
  'http://localhost:3000',
  'http://localhost:5173', // Vite default port
  'http://localhost:5000', // If frontend runs on same port
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Important for cookies/auth headers
  exposedHeaders: ['Authorization'], // Expose auth headers to frontend
}));

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '10mb' })); // Increase limit for larger payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/alerts', alertRoutes);

// Health check - Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: '🚀 HustleGuard API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      sales: '/api/sales',
      alerts: '/api/alerts',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler - Catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method
  });
});

// Global Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Handle CORS errors specifically
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS error: Origin not allowed',
      origin: req.headers.origin
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Connect to database
connectDB();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 HustleGuard Server running on port ${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
});

export default app;