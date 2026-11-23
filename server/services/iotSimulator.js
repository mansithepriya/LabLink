/**
 * LABLINK IoT INTELLIGENCE — Telemetry Simulator & Rule-Based Health Engine
 *
 * IMPORTANT TRANSPARENCY NOTICE:
 * All sensor measurements are SYNTHETIC SIMULATED DATA.
 * No physical IoT hardware is connected.
 * Failure detection uses transparent, explainable deterministic rules (NO fake predictive ML).
 */

import { store } from './store.js';

class IotSimulatorService {
  constructor() {
    this.isPaused = false;
    this.devices = this.initializeDevices();
    this.historyBuffer = new Map(); // deviceId -> Array of past 10 telemetry points
    this.initHistory();
  }

  initializeDevices() {
    return [
      {
        deviceId: 'IOT-ECE-DSOX3014T-01',
        equipmentId: 'eq_1',
        name: 'Keysight Infiniium DSOX3014T Oscilloscope',
        department: 'Electronics & Computer Engineering',
        deptCategory: 'electronics',
        labRoom: 'ECE-RF-204',
        connectionStatus: 'online',
        operationalState: 'active',
        telemetry: {
          temperature: 41.2,
          powerWatts: 135,
          utilizationPercent: 68,
          vibrationMmS: 0.2,
          lastUpdated: new Date().toISOString(),
          isSimulated: true
        },
        thresholds: {
          maxTemperature: 65.0, // °C
          maxPowerWatts: 220,   // W
          maxVibrationMmS: 1.5  // mm/s
        },
        activeWarnings: []
      },
      {
        deviceId: 'IOT-CS-DGXH100-01',
        equipmentId: 'eq_3',
        name: 'NVIDIA DGX H100 Deep Learning Workstation',
        department: 'Computer Science & AI',
        deptCategory: 'computer_science',
        labRoom: 'AI-HPC-402',
        connectionStatus: 'online',
        operationalState: 'active',
        telemetry: {
          temperature: 58.4,
          powerWatts: 3850,
          utilizationPercent: 88,
          vibrationMmS: 0.4,
          lastUpdated: new Date().toISOString(),
          isSimulated: true
        },
        thresholds: {
          maxTemperature: 78.0,
          maxPowerWatts: 6500,
          maxVibrationMmS: 2.0
        },
        activeWarnings: []
      },
      {
        deviceId: 'IOT-ME-FORM4L-01',
        equipmentId: 'eq_4',
        name: 'Formlabs Form 4L Large SLA 3D Printer',
        department: 'Mechanical Engineering',
        deptCategory: 'mechanical',
        labRoom: 'MakerSpace-108',
        connectionStatus: 'online',
        operationalState: 'idle',
        telemetry: {
          temperature: 33.1,
          powerWatts: 195,
          utilizationPercent: 45,
          vibrationMmS: 0.6,
          lastUpdated: new Date().toISOString(),
          isSimulated: true
        },
        thresholds: {
          maxTemperature: 50.0,
          maxPowerWatts: 420,
          maxVibrationMmS: 2.5
        },
        activeWarnings: []
      },
      {
        deviceId: 'IOT-ROBO-KR6-01',
        equipmentId: 'eq_8',
        name: 'KUKA KR 6 Agilus 6-Axis Industrial Robotic Arm',
        department: 'Robotics & Autonomous Systems',
        deptCategory: 'robotics',
        labRoom: 'Robo-Automation-112',
        connectionStatus: 'online',
        operationalState: 'active',
        telemetry: {
          temperature: 44.6,
          powerWatts: 680,
          utilizationPercent: 74,
          vibrationMmS: 1.1,
          lastUpdated: new Date().toISOString(),
          isSimulated: true
        },
        thresholds: {
          maxTemperature: 68.0,
          maxPowerWatts: 1400,
          maxVibrationMmS: 3.0
        },
        activeWarnings: []
      },
      {
        deviceId: 'IOT-ECE-ZNB40-01',
        equipmentId: 'eq_5',
        name: 'Rohde & Schwarz ZNB40 Vector Network Analyzer',
        department: 'Electronics & Computer Engineering',
        deptCategory: 'electronics',
        labRoom: 'ECE-RF-204',
        connectionStatus: 'online',
        operationalState: 'idle',
        telemetry: {
          temperature: 37.0,
          powerWatts: 175,
          utilizationPercent: 32,
          vibrationMmS: 0.1,
          lastUpdated: new Date().toISOString(),
          isSimulated: true
        },
        thresholds: {
          maxTemperature: 60.0,
          maxPowerWatts: 300,
          maxVibrationMmS: 1.2
        },
        activeWarnings: []
      },
      {
        deviceId: 'IOT-ME-INSTRON-01',
        equipmentId: 'eq_7',
        name: 'Instron 5969 Universal Mechanical Tester',
        department: 'Mechanical Engineering',
        deptCategory: 'mechanical',
        labRoom: 'Materials-Test-102',
        connectionStatus: 'degraded',
        operationalState: 'maintenance',
        telemetry: {
          temperature: 24.2,
          powerWatts: 18,
          utilizationPercent: 0,
          vibrationMmS: 0.0,
          lastUpdated: new Date().toISOString(),
          isSimulated: true
        },
        thresholds: {
          maxTemperature: 55.0,
          maxPowerWatts: 800,
          maxVibrationMmS: 4.0
        },
        activeWarnings: [
          {
            id: 'warn_instron_loadcell',
            metric: 'operational_status',
            level: 'maintenance_active',
            message: 'Equipment decommissioned for 50kN sensor recalibration and load cell alignment.',
            timestamp: new Date().toISOString()
          }
        ]
      }
    ];
  }

  initHistory() {
    for (const dev of this.devices) {
      const history = [];
      const now = Date.now();
      for (let i = 9; i >= 0; i--) {
        history.push({
          timestamp: new Date(now - i * 30000).toISOString(),
          temperature: Number((dev.telemetry.temperature + (Math.random() * 1.2 - 0.6)).toFixed(1)),
          powerWatts: Math.round(dev.telemetry.powerWatts + (Math.random() * 20 - 10)),
          utilizationPercent: Math.max(0, Math.min(100, Math.round(dev.telemetry.utilizationPercent + (Math.random() * 6 - 3))))
        });
      }
      this.historyBuffer.set(dev.deviceId, history);
    }
  }

  // Get all devices synced with equipment operational status
  getDevices() {
    return this.devices.map(dev => {
      const eq = store.getEquipmentById(dev.equipmentId);
      const isUnderMaint = eq && eq.status === 'maintenance';

      return {
        ...dev,
        operationalState: isUnderMaint ? 'maintenance' : dev.operationalState,
        equipmentStatus: eq?.status || 'operational',
        history: this.historyBuffer.get(dev.deviceId) || []
      };
    });
  }

  getDeviceById(deviceId) {
    const dev = this.devices.find(d => d.deviceId === deviceId || d.equipmentId === deviceId);
    if (!dev) return null;
    const eq = store.getEquipmentById(dev.equipmentId);
    return {
      ...dev,
      operationalState: eq?.status === 'maintenance' ? 'maintenance' : dev.operationalState,
      equipmentStatus: eq?.status || 'operational',
      history: this.historyBuffer.get(dev.deviceId) || []
    };
  }

  // Advance simulation tick
  tickSimulation() {
    if (this.isPaused) {
      return { paused: true, message: 'Simulation is currently paused.' };
    }

    const timestamp = new Date().toISOString();

    for (const dev of this.devices) {
      // If equipment is in maintenance or demo overheat mode, preserve demo status
      if (dev.isOverheatDemoActive) {
        // Keep temperature high to preserve demo state
        dev.telemetry.temperature = Number((74.5 + Math.random() * 2.0).toFixed(1));
        dev.telemetry.powerWatts = Math.round(180 + Math.random() * 15);
      } else if (dev.operationalState !== 'maintenance') {
        // Natural plausible Gaussian/Brownian fluctuation
        const tempDelta = (Math.random() - 0.5) * 0.6;
        const powerDelta = (Math.random() - 0.5) * 12;
        const utilDelta = (Math.random() - 0.5) * 4;

        dev.telemetry.temperature = Number(Math.max(20, dev.telemetry.temperature + tempDelta).toFixed(1));
        dev.telemetry.powerWatts = Math.max(10, Math.round(dev.telemetry.powerWatts + powerDelta));
        dev.telemetry.utilizationPercent = Math.max(0, Math.min(100, Math.round(dev.telemetry.utilizationPercent + utilDelta)));
      }

      dev.telemetry.lastUpdated = timestamp;
      dev.telemetry.isSimulated = true;

      // Update 10-point rolling history
      const history = this.historyBuffer.get(dev.deviceId) || [];
      history.push({
        timestamp,
        temperature: dev.telemetry.temperature,
        powerWatts: dev.telemetry.powerWatts,
        utilizationPercent: dev.telemetry.utilizationPercent
      });
      if (history.length > 10) history.shift();
      this.historyBuffer.set(dev.deviceId, history);

      // Evaluate Rule-Based Health Thresholds
      this.evaluateHealthRules(dev);
    }

    return {
      paused: false,
      timestamp,
      devicesUpdated: this.devices.length
    };
  }

  // Rule-Based Transparent Threshold Evaluation
  evaluateHealthRules(device) {
    const warnings = [];
    const t = device.telemetry;
    const th = device.thresholds;

    // Rule 1: Thermal Safety Check
    if (t.temperature > th.maxTemperature) {
      warnings.push({
        id: `warn_temp_${Date.now()}`,
        metric: 'temperature',
        level: 'warning',
        value: `${t.temperature}°C`,
        threshold: `${th.maxTemperature}°C`,
        message: `Over-temperature warning: Simulated core temperature ${t.temperature}°C exceeds configured threshold of ${th.maxTemperature}°C.`,
        timestamp: t.lastUpdated
      });
    }

    // Rule 2: Power Load Check
    if (t.powerWatts > th.maxPowerWatts) {
      warnings.push({
        id: `warn_power_${Date.now()}`,
        metric: 'power',
        level: 'warning',
        value: `${t.powerWatts}W`,
        threshold: `${th.maxPowerWatts}W`,
        message: `Power overload warning: Current consumption ${t.powerWatts}W exceeds rated capacity of ${th.maxPowerWatts}W.`,
        timestamp: t.lastUpdated
      });
    }

    // Rule 3: Mechanical Vibration / Jitter Check
    if (t.vibrationMmS > th.maxVibrationMmS) {
      warnings.push({
        id: `warn_vib_${Date.now()}`,
        metric: 'vibration',
        level: 'warning',
        value: `${t.vibrationMmS} mm/s`,
        threshold: `${th.maxVibrationMmS} mm/s`,
        message: `Vibration anomaly: Mechanical resonance ${t.vibrationMmS} mm/s exceeds stable limit of ${th.maxVibrationMmS} mm/s.`,
        timestamp: t.lastUpdated
      });
    }

    // Retain persistent maintenance status notices
    if (device.operationalState === 'maintenance' && device.deviceId === 'IOT-ME-INSTRON-01') {
      warnings.push({
        id: 'warn_instron_loadcell',
        metric: 'operational_status',
        level: 'maintenance_active',
        message: 'Equipment decommissioned for 50kN sensor recalibration and load cell alignment.',
        timestamp: t.lastUpdated
      });
    }

    device.activeWarnings = warnings;
  }

  // DEMO SCENARIO: Electronics Workstation Overheat
  triggerOverheatDemo(equipmentId = 'eq_1') {
    const dev = this.devices.find(d => d.equipmentId === equipmentId);
    if (!dev) return null;

    dev.isOverheatDemoActive = true;
    dev.telemetry.temperature = 74.8; // Spikes well above 65°C threshold
    dev.telemetry.powerWatts = 195;
    dev.telemetry.lastUpdated = new Date().toISOString();

    // Trigger rule evaluation
    this.evaluateHealthRules(dev);

    return {
      success: true,
      device: dev,
      scenario: 'Electronics Workstation Simulated Thermal Overload',
      explanation: `Simulated temperature spiked to ${dev.telemetry.temperature}°C (Threshold: ${dev.thresholds.maxTemperature}°C). Rule-based warning generated.`
    };
  }

  // Resolve Overheat Demo
  resolveOverheatDemo(equipmentId = 'eq_1') {
    const dev = this.devices.find(d => d.equipmentId === equipmentId);
    if (!dev) return null;

    dev.isOverheatDemoActive = false;
    dev.telemetry.temperature = 41.2; // Return to normal
    dev.telemetry.powerWatts = 135;
    dev.telemetry.lastUpdated = new Date().toISOString();

    // Re-evaluate rules (clears warning)
    this.evaluateHealthRules(dev);

    // If equipment was in maintenance, restore to operational in store
    store.updateEquipmentStatus(equipmentId, 'operational', 'Overheat resolved; thermal telemetry restored to safe operating margin.');

    return {
      success: true,
      device: dev,
      message: `Electronics workstation thermal telemetry returned to nominal 41.2°C. Warnings cleared and equipment restored to operational status.`
    };
  }

  // Toggle Maintenance State & Synchronize with Booking Store
  setEquipmentMaintenance(equipmentId, isMaintenance, reason = '') {
    const dev = this.devices.find(d => d.equipmentId === equipmentId);
    const newStatus = isMaintenance ? 'maintenance' : 'operational';

    // Synchronize with persistent store and booking flags!
    const syncResult = store.updateEquipmentStatus(
      equipmentId,
      newStatus,
      reason || (isMaintenance ? `Triggered from IoT Intelligence monitor: Inspection required.` : 'Restored from IoT monitor: Passed verification.')
    );

    if (dev) {
      dev.operationalState = isMaintenance ? 'maintenance' : 'idle';
      if (!isMaintenance && dev.isOverheatDemoActive) {
        dev.isOverheatDemoActive = false;
        dev.telemetry.temperature = 41.2;
        this.evaluateHealthRules(dev);
      }
    }

    return {
      success: true,
      equipmentId,
      operationalState: newStatus,
      affectedBookingsUpdated: syncResult !== null
    };
  }

  // Simulation Controls
  pauseSimulation() {
    this.isPaused = true;
    return { isPaused: true };
  }

  resumeSimulation() {
    this.isPaused = false;
    return { isPaused: false };
  }
}

export const iotSimulator = new IotSimulatorService();
