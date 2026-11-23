import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import healthRouter from './routes/health.js';
import equipmentRouter from './routes/equipment.js';
import bookingsRouter from './routes/bookings.js';
import aiRouter from './routes/ai.js';
import analyticsRouter from './routes/analytics.js';
import iotRouter from './routes/iot.js';
import calendarRouter from './routes/calendar.js';
import { store } from './services/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security & Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Basic CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-student-id, x-user-id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Primary API Endpoints
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);
app.use('/api/equipment', equipmentRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/iot', iotRouter);
app.use('/api/calendar', calendarRouter);

// Auxiliary Endpoints for Role Simulator
app.get('/api/users', (req, res) => {
  res.json({ success: true, data: store.getUsers() });
});

app.get('/api/projects', (req, res) => {
  res.json({ success: true, data: store.getProjects() });
});

// Production Static Client Asset Serving
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// SPA Catch-All fallback using Express 5 compatible handler
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In development or prior to client build, return API information
      res.status(200).json({
        service: 'LabLink API Server',
        status: 'Operational',
        routes: ['/health', '/api/equipment', '/api/bookings', '/api/ai/match', '/api/analytics'],
        message: 'Frontend static assets will be served once build completes.'
      });
    }
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

export default app;
