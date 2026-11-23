import express from 'express';
import { iotSimulator } from '../services/iotSimulator.js';
import { store } from '../services/store.js';

const router = express.Router();

// GET /api/iot/devices - List all IoT equipment nodes
router.get('/devices', (req, res) => {
  try {
    const devices = iotSimulator.getDevices();
    res.json({
      success: true,
      isSimulated: true,
      simulationPaused: iotSimulator.isPaused,
      disclaimer: 'SIMULATED DATA: Telemetry values are synthetically generated for demonstration. No physical IoT hardware connected.',
      count: devices.length,
      data: devices
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/iot/devices/:id - Single device telemetry & history
router.get('/devices/:id', (req, res) => {
  try {
    const device = iotSimulator.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: `Device or equipment '${req.params.id}' not found in IoT registry.` });
    }
    res.json({
      success: true,
      isSimulated: true,
      data: device
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/iot/simulate-tick - Generate a telemetry update tick
router.post('/simulate-tick', (req, res) => {
  try {
    const result = iotSimulator.tickSimulation();
    res.json({
      success: true,
      isSimulated: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/iot/pause - Pause simulation updates
router.post('/pause', (req, res) => {
  const result = iotSimulator.pauseSimulation();
  res.json({ success: true, message: 'Simulation updates paused.', ...result });
});

// POST /api/iot/resume - Resume simulation updates
router.post('/resume', (req, res) => {
  const result = iotSimulator.resumeSimulation();
  res.json({ success: true, message: 'Simulation updates resumed.', ...result });
});

// POST /api/iot/demo/overheat - DEMO SCENARIO: Trigger electronics workstation thermal alert
router.post('/demo/overheat', (req, res) => {
  try {
    const targetEq = req.body.equipmentId || 'eq_1';
    const result = iotSimulator.triggerOverheatDemo(targetEq);
    if (!result) {
      return res.status(404).json({ success: false, error: `Target equipment ${targetEq} not found.` });
    }

    res.json({
      success: true,
      isSimulated: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/iot/demo/resolve - DEMO SCENARIO: Resolve electronics workstation thermal alert
router.post('/demo/resolve', (req, res) => {
  try {
    const targetEq = req.body.equipmentId || 'eq_1';
    const result = iotSimulator.resolveOverheatDemo(targetEq);
    if (!result) {
      return res.status(404).json({ success: false, error: `Target equipment ${targetEq} not found.` });
    }

    res.json({
      success: true,
      isSimulated: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/iot/devices/:id/maintenance - Toggle equipment maintenance & synchronize with booking system
router.post('/devices/:id/maintenance', (req, res) => {
  try {
    const { isMaintenance, reason } = req.body;
    if (typeof isMaintenance !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Field isMaintenance (boolean) is required.'
      });
    }

    const device = iotSimulator.getDeviceById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: `Device '${req.params.id}' not found.` });
    }

    const result = iotSimulator.setEquipmentMaintenance(device.equipmentId, isMaintenance, reason);

    res.json({
      success: true,
      message: `Equipment operational status updated to ${isMaintenance ? 'MAINTENANCE (Bookings blocked)' : 'OPERATIONAL (Bookings restored)'}.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/iot/analytics - Macro IoT telemetry analytics
router.get('/analytics', (req, res) => {
  try {
    const devices = iotSimulator.getDevices();

    // 1. Total Power in kW
    const totalPowerWatts = devices.reduce((sum, d) => sum + (d.telemetry.powerWatts || 0), 0);
    const totalPowerKw = Number((totalPowerWatts / 1000).toFixed(2));

    // 2. Health Distribution
    let normalCount = 0;
    let warningCount = 0;
    let maintenanceCount = 0;

    for (const d of devices) {
      if (d.operationalState === 'maintenance') {
        maintenanceCount++;
      } else if (d.activeWarnings.length > 0) {
        warningCount++;
      } else {
        normalCount++;
      }
    }

    // 3. Total Warnings
    const totalWarnings = devices.reduce((sum, d) => sum + d.activeWarnings.length, 0);

    // 4. Department Utilization Comparison
    const deptUtil = {
      electronics: { total: 0, count: 0 },
      computer_science: { total: 0, count: 0 },
      mechanical: { total: 0, count: 0 },
      robotics: { total: 0, count: 0 }
    };

    for (const d of devices) {
      if (deptUtil[d.deptCategory]) {
        deptUtil[d.deptCategory].total += d.telemetry.utilizationPercent;
        deptUtil[d.deptCategory].count++;
      }
    }

    const departmentUtilizationComparison = Object.entries(deptUtil).map(([cat, val]) => ({
      departmentCategory: cat,
      displayName: cat.replace('_', ' ').toUpperCase(),
      averageUtilizationPercent: val.count > 0 ? Math.round(val.total / val.count) : 0,
      monitoredNodes: val.count
    }));

    res.json({
      success: true,
      isSimulated: true,
      data: {
        summary: {
          totalMonitoredNodes: devices.length,
          totalPowerConsumptionKw: totalPowerKw,
          totalActiveWarnings: totalWarnings,
          healthDistribution: {
            normal: normalCount,
            warning: warningCount,
            maintenance: maintenanceCount
          }
        },
        departmentUtilizationComparison
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
