import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'LabLink Intelligent Resource Allocation Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    engine: 'FAIRALLOC v2.1-deterministic'
  });
});

export default router;
