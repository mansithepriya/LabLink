import app from './app.js';

// Cloud Run supplies port via process.env.PORT (defaults to 8080/3000)
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`[LabLink Server] Running on http://${HOST}:${PORT}`);
  console.log(`[LabLink Server] Health check available at http://${HOST}:${PORT}/health`);
  console.log(`[LabLink Server] Allocation Engine: FAIRALLOC Active`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[LabLink Server] SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('[LabLink Server] HTTP server closed gracefully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[LabLink Server] SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('[LabLink Server] HTTP server closed gracefully');
    process.exit(0);
  });
});

export default server;
