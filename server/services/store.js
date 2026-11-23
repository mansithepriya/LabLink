import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'lablink_db.json');

// Default initial database state with realistic academic inventory
const INITIAL_DATA = {
  users: [
    {
      id: 'std_1',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@campus.edu',
      role: 'student',
      department: 'Electrical & Computer Engineering',
      certifications: ['ESD-101', 'RF-SAFETY-LVL1'],
      priorUsageHoursMonth: 4
    },
    {
      id: 'std_2',
      name: 'Priya Venkatesh',
      email: 'priya.v@campus.edu',
      role: 'student',
      department: 'Bioengineering',
      certifications: ['BIO-SAFETY-2', 'MICROSCOPY-LVL2'],
      priorUsageHoursMonth: 28 // High past usage for fairness test
    },
    {
      id: 'std_3',
      name: 'Rohan Patel',
      email: 'rohan.patel@campus.edu',
      role: 'student',
      department: 'Mechanical Engineering',
      certifications: ['RAPID-PROTO-1'],
      priorUsageHoursMonth: 2
    },
    {
      id: 'std_4',
      name: 'Sneha Rao',
      email: 'sneha.rao@campus.edu',
      role: 'student',
      department: 'Computer Science & AI',
      certifications: ['GPU-CLUSTER-ADMIN'],
      priorUsageHoursMonth: 42
    },
    {
      id: 'std_ineligible',
      name: 'Karan Verma',
      email: 'karan.verma@campus.edu',
      role: 'student',
      department: 'Electrical & Computer Engineering',
      certifications: [], // Missing required certifications
      priorUsageHoursMonth: 0
    },
    {
      id: 'fac_1',
      name: 'Dr. Ananya Sen',
      email: 'ananya.sen@campus.edu',
      role: 'faculty',
      department: 'Electrical & Computer Engineering',
      certifications: ['ESD-101', 'RF-SAFETY-LVL1', 'CLEANROOM-LVL1'],
      priorUsageHoursMonth: 0
    },
    {
      id: 'fac_2',
      name: 'Prof. Vikram Malhotra',
      email: 'vikram.m@campus.edu',
      role: 'faculty',
      department: 'Bioengineering & Nanotechnology',
      certifications: ['BIO-SAFETY-2', 'MICROSCOPY-LVL2', 'CLEANROOM-LVL1'],
      priorUsageHoursMonth: 0
    },
    {
      id: 'fac_3',
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@campus.edu',
      role: 'faculty',
      department: 'Robotics & Autonomous Systems',
      certifications: ['ROBOTICS-SAFETY-1'],
      priorUsageHoursMonth: 0
    },
    {
      id: 'admin_1',
      name: 'Central Lab Custodian Admin',
      email: 'labops@campus.edu',
      role: 'admin',
      department: 'Central Research Infrastructure',
      certifications: ['ALL'],
      priorUsageHoursMonth: 0
    }
  ],
  equipment: [
    {
      id: 'eq_1',
      name: 'Keysight Infiniium DSOX3014T Oscilloscope',
      model: 'DSOX3014T',
      department: 'Electrical & Computer Engineering',
      labRoom: 'ECE-RF-204',
      custodianFacultyId: 'fac_1',
      category: 'rf_microwave',
      description: '1 GHz, 4 analog channels, 5 GSa/s sample rate, 1M wave/sec update rate with digital protocol decode.',
      specifications: {
        bandwidth: '1 GHz',
        channels: 4,
        samplingRate: '5 GSa/s',
        protocolDecode: true,
        maxVoltage: '300V CAT I'
      },
      safetyPrerequisites: ['ESD-101'],
      status: 'operational',
      operatingHours: { open: '08:00', close: '20:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
      bufferTimeMinutes: 15
    },
    {
      id: 'eq_2',
      name: 'JEOL JSM-IT800 Field Emission SEM',
      model: 'JSM-IT800',
      department: 'Materials & Nanotechnology',
      labRoom: 'Nano-Cleanroom-B1',
      custodianFacultyId: 'fac_2',
      category: 'microscopy',
      description: 'Ultrahigh-resolution scanning electron microscope equipped with high-resolution snorkel objective lens and EDX.',
      specifications: {
        magnification: '2,000,000x',
        acceleratingVoltage: '0.5 to 30 kV',
        vacuumType: 'Ultra-High',
        edxSpectrometer: true
      },
      safetyPrerequisites: ['CLEANROOM-LVL1', 'MICROSCOPY-LVL2'],
      status: 'operational',
      operatingHours: { open: '09:00', close: '18:00', daysOfWeek: [1, 2, 3, 4, 5] },
      bufferTimeMinutes: 30
    },
    {
      id: 'eq_3',
      name: 'NVIDIA DGX H100 Deep Learning Workstation',
      model: 'DGX H100 (8x SXM5)',
      department: 'Computer Science & AI',
      labRoom: 'AI-HPC-402',
      custodianFacultyId: 'fac_1',
      category: 'compute_gpu',
      description: 'High-throughput enterprise AI computing cluster with 8x NVIDIA H100 GPUs and 640GB aggregate high-bandwidth VRAM.',
      specifications: {
        gpuCount: 8,
        totalVram: '640 GB HBM3',
        fp8Compute: '32 PFLOPS',
        interconnect: 'NVLink 900 GB/s'
      },
      safetyPrerequisites: ['GPU-CLUSTER-ADMIN'],
      status: 'operational',
      operatingHours: { open: '00:00', close: '23:59', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      bufferTimeMinutes: 0
    },
    {
      id: 'eq_4',
      name: 'Formlabs Form 4L Large SLA 3D Printer',
      model: 'Form 4L',
      department: 'Mechanical Engineering',
      labRoom: 'MakerSpace-108',
      custodianFacultyId: 'fac_1',
      category: 'prototyping',
      description: 'Industrial-grade stereolithography 3D printer for ultra-accurate mechanical enclosures and biocompatible parts.',
      specifications: {
        buildVolume: '353 x 196 x 350 mm',
        xyResolution: '46 microns',
        resinTanks: ['Tough 2000', 'BioMed Amber', 'Elastic 50A']
      },
      safetyPrerequisites: ['RAPID-PROTO-1'],
      status: 'operational',
      operatingHours: { open: '08:00', close: '22:00', daysOfWeek: [1, 2, 3, 4, 5, 6] },
      bufferTimeMinutes: 20
    },
    {
      id: 'eq_5',
      name: 'Rohde & Schwarz ZNB40 Vector Network Analyzer',
      model: 'ZNB40',
      department: 'Electrical & Computer Engineering',
      labRoom: 'ECE-RF-204',
      custodianFacultyId: 'fac_1',
      category: 'rf_microwave',
      description: 'High-precision 4-port 100 kHz to 40 GHz vector network analyzer for high-frequency S-parameter antenna and filter characterization.',
      specifications: {
        frequencyRange: '100 kHz to 40 GHz',
        dynamicRange: '140 dB',
        ports: 4
      },
      safetyPrerequisites: ['ESD-101', 'RF-SAFETY-LVL1'],
      status: 'operational',
      operatingHours: { open: '08:00', close: '20:00', daysOfWeek: [1, 2, 3, 4, 5] },
      bufferTimeMinutes: 15
    },
    {
      id: 'eq_6',
      name: 'Carl Zeiss LSM 980 Confocal Laser Microscope',
      model: 'LSM 980 with Airyscan 2',
      department: 'Bioengineering',
      labRoom: 'Bio-Imaging-310',
      custodianFacultyId: 'fac_2',
      category: 'microscopy',
      description: 'Multiphoton confocal microscope with Airyscan 2 multiplex mode for super-resolution live cell fluorescence imaging.',
      specifications: {
        laserLines: ['405nm', '488nm', '561nm', '633nm'],
        magnifications: ['10x', '20x', '40x Oil', '63x Oil'],
        superResolution: '90 nm lateral'
      },
      safetyPrerequisites: ['BIO-SAFETY-2', 'MICROSCOPY-LVL2'],
      status: 'operational',
      operatingHours: { open: '09:00', close: '19:00', daysOfWeek: [1, 2, 3, 4, 5] },
      bufferTimeMinutes: 30
    },
    {
      id: 'eq_7',
      name: 'Instron 5969 Universal Mechanical Tester',
      model: 'Instron 5969',
      department: 'Mechanical Engineering',
      labRoom: 'Materials-Test-102',
      custodianFacultyId: 'fac_1',
      category: 'prototyping',
      description: 'Dual column table-top mechanical testing system for tensile, compression, and peel testing.',
      specifications: {
        maxLoad: '50 kN',
        crossheadSpeed: '0.001 to 1000 mm/min'
      },
      safetyPrerequisites: ['MATERIALS-SAFETY-1'],
      status: 'maintenance', // Under maintenance
      operatingHours: { open: '08:00', close: '18:00', daysOfWeek: [1, 2, 3, 4, 5] },
      bufferTimeMinutes: 15
    },
    {
      id: 'eq_8',
      name: 'KUKA KR 6 Agilus 6-Axis Industrial Robotic Arm',
      model: 'KR 6 R900-2',
      department: 'Robotics & Autonomous Systems',
      labRoom: 'Robo-Automation-112',
      custodianFacultyId: 'fac_3',
      category: 'robotics',
      description: 'Precision 6-axis articulated robot with 6kg payload, 901mm reach, and sub-0.02mm repeatability for automated laboratory sample handling and pick-and-place testing.',
      specifications: {
        payload: '6 kg',
        reach: '901 mm',
        repeatability: '±0.02 mm',
        degreesOfFreedom: 6,
        controller: 'KR C4 compact'
      },
      safetyPrerequisites: ['ROBOTICS-SAFETY-1'],
      status: 'operational',
      operatingHours: { open: '08:00', close: '20:00', daysOfWeek: [1, 2, 3, 4, 5] },
      bufferTimeMinutes: 20
    }
  ],
  maintenanceWindows: [
    {
      id: 'maint_1',
      equipmentId: 'eq_1',
      title: 'Annual NIST Calibration & Firmware Patch',
      startTime: '2026-11-25T09:00:00.000Z',
      endTime: '2026-11-25T13:00:00.000Z',
      reason: 'Traceable RF frequency calibration'
    },
    {
      id: 'maint_2',
      equipmentId: 'eq_2',
      title: 'Vacuum Ion Pump Service',
      startTime: '2026-11-26T14:00:00.000Z',
      endTime: '2026-11-26T18:00:00.000Z',
      reason: 'Routine ultra-high vacuum regeneration'
    },
    {
      id: 'maint_3',
      equipmentId: 'eq_7',
      title: 'Load Cell Recalibration',
      startTime: '2026-11-23T00:00:00.000Z',
      endTime: '2026-11-30T23:59:59.000Z',
      reason: 'Decommissioned for 50kN sensor replacement'
    }
  ],
  projects: [
    {
      id: 'proj_1',
      title: 'Wide-Bandgap GaN Power Inverter for Formula Student EV',
      studentId: 'std_1',
      department: 'Electrical & Computer Engineering',
      supervisorFacultyId: 'fac_1',
      category: 'undergrad_capstone',
      abstract: 'Characterization of high-speed switching transients and ringing phenomena in 650V Gallium Nitride half-bridge modules switching at 500 kHz. Requires 1 GHz real-time bandwidth and high voltage differential probe characterization.',
      deliverableDeadline: '2026-11-27T17:00:00.000Z',
      extractedSpecs: {
        requiredCapabilities: ['High Bandwidth Oscilloscope', 'Multi-channel', 'Fast Transient Capture'],
        minBandwidth: '500 MHz',
        recommendedEquipmentIds: ['eq_1']
      }
    },
    {
      id: 'proj_2',
      title: 'Microfluidic Immuno-Capture for Early Circulating Tumor Cell Isolation',
      studentId: 'std_2',
      department: 'Bioengineering',
      supervisorFacultyId: 'fac_2',
      category: 'masters_thesis',
      abstract: 'Microfluidic device fabrication using biocompatible resin and subsequent morphological validation via confocal fluorescence imaging to observe fluorescent antibody binding on micro-channel posts.',
      deliverableDeadline: '2026-12-08T17:00:00.000Z',
      extractedSpecs: {
        requiredCapabilities: ['Confocal Laser Scanning', 'Fluorescence Imaging', 'Precision SLA 3D Printing'],
        recommendedEquipmentIds: ['eq_6', 'eq_4']
      }
    },
    {
      id: 'proj_3',
      title: 'Generative Diffusion Model for 3D Protein Backbone Folding',
      studentId: 'std_4',
      department: 'Computer Science & AI',
      supervisorFacultyId: 'fac_1',
      category: 'phd_thesis',
      abstract: 'Training invariant SE(3) diffusion models on full-length AlphaFold structures with billions of parameters. Requires large VRAM cluster and multi-GPU tensor parallelism.',
      deliverableDeadline: '2026-11-26T12:00:00.000Z',
      extractedSpecs: {
        requiredCapabilities: ['Multi-GPU Node', 'High VRAM', 'FP8 Tensor Acceleration'],
        recommendedEquipmentIds: ['eq_3']
      }
    }
  ],
  bookings: [
    {
      id: 'book_existing_1',
      projectId: 'proj_1',
      studentId: 'std_1',
      equipmentId: 'eq_1',
      requestedStartTime: '2026-11-24T10:00:00.000Z',
      requestedEndTime: '2026-11-24T12:00:00.000Z',
      purposeSummary: 'Gate drive ringing characterization',
      status: 'confirmed',
      facultyEndorsement: {
        facultyId: 'fac_1',
        endorsedAt: '2026-11-23T08:00:00.000Z',
        isApproved: true,
        note: 'Approved for senior capstone lab testing.'
      },
      createdAt: '2026-11-23T07:00:00.000Z'
    }
  ]
};

class Store {
  constructor() {
    this.data = JSON.parse(JSON.stringify(INITIAL_DATA));
    this.locks = new Map(); // equipmentId -> Promise chain for atomic concurrency
    this.ensureDataDir();
    this.loadFromDisk();
  }

  ensureDataDir() {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else {
        this.saveToDisk();
      }
    } catch (err) {
      console.warn('Could not load persistent store, using initial memory state:', err.message);
    }
  }

  saveToDisk() {
    try {
      this.ensureDataDir();
      const tmp = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.warn('Failed to persist to disk:', err.message);
    }
  }

  // Concurrency-safe execution block per resource
  async withLock(resourceId, action) {
    let currentLock = this.locks.get(resourceId) || Promise.resolve();
    let release;
    const newLock = new Promise(resolve => { release = resolve; });
    this.locks.set(resourceId, currentLock.then(() => newLock));

    await currentLock;
    try {
      return await action();
    } finally {
      release();
      if (this.locks.get(resourceId) === newLock) {
        this.locks.delete(resourceId);
      }
    }
  }

  // Queries
  getUsers() { return this.data.users; }
  getUserById(id) { return this.data.users.find(u => u.id === id); }

  getEquipment() { return this.data.equipment; }
  getEquipmentById(id) { return this.data.equipment.find(e => e.id === id); }

  getProjects() { return this.data.projects; }
  getProjectById(id) { return this.data.projects.find(p => p.id === id); }

  getBookings() { return this.data.bookings; }
  getBookingById(id) { return this.data.bookings.find(b => b.id === id); }

  getMaintenanceWindows() { return this.data.maintenanceWindows; }

  // Mutations
  addBooking(booking) {
    this.data.bookings.push(booking);
    this.saveToDisk();
    return booking;
  }

  updateBooking(id, patch) {
    const idx = this.data.bookings.findIndex(b => b.id === id);
    if (idx === -1) return null;
    this.data.bookings[idx] = { ...this.data.bookings[idx], ...patch };
    this.saveToDisk();
    return this.data.bookings[idx];
  }

  updateEquipmentStatus(id, newStatus, reason = '') {
    const eq = this.data.equipment.find(e => e.id === id);
    if (!eq) return null;
    const oldStatus = eq.status;
    eq.status = newStatus;

    // Connect equipment operational status directly with the booking system:
    // When equipment is marked under maintenance, flag all confirmed bookings for review
    if (newStatus === 'maintenance') {
      for (const booking of this.data.bookings) {
        if (booking.equipmentId === id && booking.status === 'confirmed') {
          booking.affectedByMaintenance = true;
          booking.maintenanceReviewNotice = reason || `Equipment ${eq.name} placed under maintenance. Operational inspection required.`;
          booking.maintenanceTriggeredAt = new Date().toISOString();
        }
      }
    } else if (newStatus === 'operational') {
      // When restored to operational, restore booking eligibility and clear flags
      for (const booking of this.data.bookings) {
        if (booking.equipmentId === id && booking.affectedByMaintenance) {
          booking.affectedByMaintenance = false;
          booking.maintenanceResolvedAt = new Date().toISOString();
        }
      }
    }

    this.saveToDisk();
    return { equipment: eq, previousStatus: oldStatus };
  }

  addProject(project) {
    this.data.projects.push(project);
    this.saveToDisk();
    return project;
  }

  reset(data = INITIAL_DATA) {
    this.data = JSON.parse(JSON.stringify(data));
    this.saveToDisk();
  }
}

export const store = new Store();
