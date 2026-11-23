import { describe, it, expect, beforeEach } from 'vitest';
import { testClient } from './testHelper.js';
import app from '../app.js';
import { store } from '../services/store.js';
import { FairAllocEngine } from '../services/fairalloc.js';
import { CalendarConnectService } from '../services/calendarConnect.js';
import { AiMatcherService, sanitizeInput, safeParseJson } from '../services/aiMatcher.js';

const request = testClient;

describe('LABLINK Pre-Deployment Engineering Audit Test Suite', () => {
  beforeEach(() => {
    // Reset store to known baseline before each test
    store.reset();
  });

  describe('1. Health Endpoint and Server Startup', () => {
    it('GET /health returns HTTP 200 with healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.engine).toContain('FAIRALLOC');
    });
  });

  describe('2. Equipment Search and Filtering', () => {
    it('returns all catalogue equipment when no filters applied', async () => {
      const res = await request(app).get('/api/equipment');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(6);
    });

    it('filters equipment accurately by department', async () => {
      const depName = encodeURIComponent('Electrical & Computer Engineering');
      const res = await request(app).get(`/api/equipment?department=${depName}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every(e => e.department === 'Electrical & Computer Engineering')).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(2);
    });

    it('filters equipment by operational status', async () => {
      const res = await request(app).get('/api/equipment?status=maintenance');
      expect(res.status).toBe(200);
      expect(res.body.data.some(e => e.id === 'eq_7')).toBe(true);
      expect(res.body.data.every(e => e.status === 'maintenance')).toBe(true);
    });
  });

  describe('3. AI Project Requirement Extraction & Catalogue Grounding', () => {
    it('extracts technical requirements and matches real catalogue equipment', async () => {
      const payload = {
        title: 'High-frequency GaN half-bridge inverter testing',
        description: 'Need to capture fast 500 kHz switching transients and gate drive ringing requiring 1 GHz bandwidth and 4 channels.'
      };
      const res = await request(app).post('/api/ai/match').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.extractedRequirements.extractedCapabilities).toContain('High-Frequency Signal Acquisition');
      
      // Top recommendation must be Keysight Oscilloscope (eq_1) from real catalogue
      const topMatch = res.body.data.recommendations[0];
      expect(topMatch.equipmentId).toBe('eq_1');
      expect(topMatch.groundedRationale).toContain('bandwidth');
    });

    it('rejects too short or invalid project descriptions with 400 Bad Request', async () => {
      const res = await request(app).post('/api/ai/match').send({ description: 'hi' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Booking Interval Overlap Detection (overlapping bookings vs non-overlapping)', () => {
    it('detects overlapping bookings and rejects with 409 Conflict', async () => {
      // eq_1 has an existing booking: 2026-11-24T10:00:00.000Z to 2026-11-24T12:00:00.000Z
      const overlappingPayload = {
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-24T11:00:00.000Z', // overlaps second half
        requestedEndTime: '2026-11-24T13:00:00.000Z',
        purposeSummary: 'Test overlap collision'
      };

      const res = await request(app).post('/api/bookings').send(overlappingPayload);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SLOT_CONFLICT');
      expect(res.body.conflicts.length).toBeGreaterThan(0);
      expect(res.body.feasibleAlternatives).toBeDefined();
    });

    it('accepts non-overlapping bookings within operational hours', async () => {
      // Afternoon non-overlapping slot on 2026-11-24
      const nonOverlappingPayload = {
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-24T14:00:00.000Z',
        requestedEndTime: '2026-11-24T16:00:00.000Z',
        purposeSummary: 'Afternoon non-overlapping characterization'
      };

      const res = await request(app).post('/api/bookings').send(nonOverlappingPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending_faculty');
    });
  });

  describe('5. Maintenance Blackout Conflicts', () => {
    it('detects maintenance conflict and rejects with 409 Conflict and feasible alternatives', async () => {
      // eq_1 maintenance window: 2026-11-25T09:00:00.000Z to 2026-11-25T13:00:00.000Z
      const maintConflictPayload = {
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-25T10:00:00.000Z',
        requestedEndTime: '2026-11-25T12:00:00.000Z',
        purposeSummary: 'Attempt booking during calibration'
      };

      const res = await request(app).post('/api/bookings').send(maintConflictPayload);
      expect(res.status).toBe(409);
      expect(res.body.conflicts.some(c => c.type === 'maintenance')).toBe(true);
      expect(res.body.conflicts[0].title).toContain('Calibration');
    });

    it('blocks booking on equipment whose overall status is maintenance', async () => {
      // eq_7 is currently in maintenance status
      const maintStatusPayload = {
        equipmentId: 'eq_7',
        studentId: 'std_3',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-24T10:00:00.000Z',
        requestedEndTime: '2026-11-24T12:00:00.000Z',
        purposeSummary: 'Attempt booking decommissioned machine'
      };

      const res = await request(app).post('/api/bookings').send(maintStatusPayload);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('EQUIPMENT_UNAVAILABLE');
    });
  });

  describe('6. Safety & Certification Eligibility Enforcement', () => {
    it('rejects ineligible students missing safety prerequisites with 403 Forbidden', async () => {
      // std_ineligible has empty certifications; eq_1 requires ESD-101
      const ineligiblePayload = {
        equipmentId: 'eq_1',
        studentId: 'std_ineligible',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-24T14:00:00.000Z',
        requestedEndTime: '2026-11-24T16:00:00.000Z',
        purposeSummary: 'Booking attempt without ESD cert'
      };

      const res = await request(app).post('/api/bookings').send(ineligiblePayload);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STUDENT_INELIGIBLE');
      expect(res.body.missingCertifications).toContain('ESD-101');
    });
  });

  describe('7. Competing Project Deadlines and Priority Scoring', () => {
    it('awards higher urgency score to project with imminent deadline', () => {
      const urgentProject = {
        category: 'undergrad_capstone',
        deliverableDeadline: '2026-11-24T12:00:00.000Z' // 1 day away
      };
      const distantProject = {
        category: 'undergrad_capstone',
        deliverableDeadline: '2026-12-24T12:00:00.000Z' // 31 days away
      };
      const student = { priorUsageHoursMonth: 5 };
      const refTime = new Date('2026-11-23T12:00:00.000Z');

      const urgentEval = FairAllocEngine.calculatePriorityScore(urgentProject, student, null, refTime);
      const distantEval = FairAllocEngine.calculatePriorityScore(distantProject, student, null, refTime);

      expect(urgentEval.breakdown.urgencyScore).toBeGreaterThan(distantEval.breakdown.urgencyScore);
      expect(urgentEval.score).toBeGreaterThan(distantEval.score);
      expect(urgentEval.explanation).toContain('Deliverable due in');
    });
  });

  describe('8. Fairness Calculation (Historical Resource Access)', () => {
    it('penalizes high past usage to ensure equitable campus distribution', () => {
      const project = {
        category: 'masters_thesis',
        deliverableDeadline: '2026-12-05T12:00:00.000Z'
      };
      const lowUsageStudent = { priorUsageHoursMonth: 2 };
      const highUsageStudent = { priorUsageHoursMonth: 45 };
      const refTime = new Date('2026-11-23T12:00:00.000Z');

      const lowEval = FairAllocEngine.calculatePriorityScore(project, lowUsageStudent, null, refTime);
      const highEval = FairAllocEngine.calculatePriorityScore(project, highUsageStudent, null, refTime);

      expect(lowEval.breakdown.fairnessScore).toBe(95);
      expect(highEval.breakdown.fairnessScore).toBeLessThan(40);
      expect(lowEval.score).toBeGreaterThan(highEval.score);
    });
  });

  describe('9. Alternative Slot Feasibility and "No Feasible Slot" Handling', () => {
    it('alternative slots recommended are provably non-conflicting', () => {
      const equipment = store.getEquipmentById('eq_1');
      const requestedStart = '2026-11-24T10:00:00.000Z'; // conflicting with book_existing_1
      const requestedEnd = '2026-11-24T12:00:00.000Z';

      const alternatives = FairAllocEngine.findFeasibleAlternativeSlots(
        equipment,
        requestedStart,
        requestedEnd,
        store.getBookings(),
        store.getMaintenanceWindows(),
        store.getEquipment()
      );

      expect(alternatives.length).toBeGreaterThan(0);
      // Verify every returned alternative does not conflict with existing bookings or maintenance
      for (const alt of alternatives) {
        const conflictCheck = FairAllocEngine.detectConflicts(
          alt.equipmentId,
          alt.startTime,
          alt.endTime,
          store.getBookings(),
          store.getMaintenanceWindows(),
          0
        );
        expect(conflictCheck.hasConflict).toBe(false);
      }
    });

    it('returns empty array when equipment is completely blocked and no alternative is feasible', () => {
      // Simulate an equipment completely shut down with 24/7 continuous maintenance across 14 days
      const blockedEq = {
        id: 'eq_blocked',
        name: 'Blocked Instrument',
        category: 'unique_specialty',
        operatingHours: { open: '08:00', close: '18:00', daysOfWeek: [1,2,3,4,5] }
      };
      const continuousMaint = [{
        equipmentId: 'eq_blocked',
        startTime: '2026-11-20T00:00:00.000Z',
        endTime: '2026-12-10T23:59:59.000Z',
        title: 'Full Overhaul'
      }];

      const alternatives = FairAllocEngine.findFeasibleAlternativeSlots(
        blockedEq,
        '2026-11-24T10:00:00.000Z',
        '2026-11-24T12:00:00.000Z',
        [],
        continuousMaint,
        [] // No other equipment in category
      );

      expect(alternatives).toEqual([]);
    });
  });

  describe('10. Faculty Approval and Rejection Workflow', () => {
    it('faculty approval updates booking status to confirmed and boosts FAIRALLOC score', async () => {
      // First create a new booking
      const newBooking = store.addBooking({
        id: 'book_test_approval',
        projectId: 'proj_1',
        studentId: 'std_1',
        equipmentId: 'eq_1',
        requestedStartTime: '2026-11-27T14:00:00.000Z',
        requestedEndTime: '2026-11-27T16:00:00.000Z',
        purposeSummary: 'Pre-flight check',
        status: 'pending_faculty',
        allocationMetadata: { fairAllocScore: 65 }
      });

      const res = await request(app)
        .post(`/api/bookings/${newBooking.id}/endorse`)
        .send({
          facultyId: 'fac_1',
          isApproved: true,
          note: 'Approved for final project capstone presentation.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
      expect(res.body.data.facultyEndorsement.isApproved).toBe(true);
      expect(res.body.data.allocationMetadata.fairAllocScore).toBeGreaterThan(65);
    });

    it('faculty rejection updates booking status to rejected and sets endorsement score to 0', async () => {
      const newBooking = store.addBooking({
        id: 'book_test_rejection',
        projectId: 'proj_1',
        studentId: 'std_1',
        equipmentId: 'eq_1',
        requestedStartTime: '2026-11-28T14:00:00.000Z',
        requestedEndTime: '2026-11-28T16:00:00.000Z',
        purposeSummary: 'Test rejection',
        status: 'pending_faculty',
        allocationMetadata: { fairAllocScore: 65 }
      });

      const res = await request(app)
        .post(`/api/bookings/${newBooking.id}/endorse`)
        .send({
          facultyId: 'fac_1',
          isApproved: false,
          note: 'Scope of experiment not justified for this equipment.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
      expect(res.body.data.facultyEndorsement.isApproved).toBe(false);
      expect(res.body.data.allocationMetadata.scoreBreakdown.endorsementScore).toBe(0);
    });
  });

  describe('11. Server-Side Input Validation Integrity', () => {
    it('rejects booking with missing required fields with 400 Bad Request', async () => {
      const res = await request(app).post('/api/bookings').send({ equipmentId: 'eq_1' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('rejects booking where requestedStartTime >= requestedEndTime', async () => {
      const res = await request(app).post('/api/bookings').send({
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-24T16:00:00.000Z',
        requestedEndTime: '2026-11-24T14:00:00.000Z' // start after end
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('precede');
    });

    it('rejects single booking exceeding 12 hours max session duration', async () => {
      const res = await request(app).post('/api/bookings').send({
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-24T08:00:00.000Z',
        requestedEndTime: '2026-11-24T22:00:00.000Z' // 14 hours
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('12 continuous hours');
    });
  });

  describe('12. LABLINK IoT INTELLIGENCE & Hardware Telemetry Simulator', () => {
    it('GET /api/iot/devices returns monitored nodes across CS, Electronics, Mechanical, and Robotics', async () => {
      const res = await request(app).get('/api/iot/devices');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isSimulated).toBe(true);
      expect(res.body.disclaimer).toContain('SIMULATED DATA');

      const depts = res.body.data.map(d => d.deptCategory);
      expect(depts).toContain('electronics');
      expect(depts).toContain('computer_science');
      expect(depts).toContain('mechanical');
      expect(depts).toContain('robotics');
    });

    it('each IoT device possesses required telemetry metrics, thresholds, and simulated tag', async () => {
      const res = await request(app).get('/api/iot/devices/IOT-ECE-DSOX3014T-01');
      expect(res.status).toBe(200);
      const dev = res.body.data;
      expect(dev.deviceId).toBe('IOT-ECE-DSOX3014T-01');
      expect(dev.equipmentId).toBe('eq_1');
      expect(dev.telemetry.isSimulated).toBe(true);
      expect(typeof dev.telemetry.temperature).toBe('number');
      expect(typeof dev.telemetry.powerWatts).toBe('number');
      expect(typeof dev.telemetry.utilizationPercent).toBe('number');
      expect(dev.thresholds.maxTemperature).toBe(65.0);
      expect(dev.connectionStatus).toBe('online');
    });

    it('POST /api/iot/simulate-tick advances simulated telemetry with timestamp', async () => {
      const res = await request(app).post('/api/iot/simulate-tick');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isSimulated).toBe(true);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.devicesUpdated).toBeGreaterThanOrEqual(6);
    });

    it('POST /api/iot/pause and POST /api/iot/resume control simulation active state', async () => {
      const pauseRes = await request(app).post('/api/iot/pause');
      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.isPaused).toBe(true);

      const resumeRes = await request(app).post('/api/iot/resume');
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.isPaused).toBe(false);
    });

    it('DEMO SCENARIO: Overheat alert triggers transparent rule warning on electronics workstation', async () => {
      const res = await request(app).post('/api/iot/demo/overheat').send({ equipmentId: 'eq_1' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.device.telemetry.temperature).toBe(74.8);

      // Verify rule-based alert generated
      const devRes = await request(app).get('/api/iot/devices/IOT-ECE-DSOX3014T-01');
      expect(devRes.body.data.activeWarnings.length).toBeGreaterThan(0);
      const warn = devRes.body.data.activeWarnings[0];
      expect(warn.metric).toBe('temperature');
      expect(warn.message).toContain('Over-temperature warning');
      expect(warn.message).toContain('65');
    });

    it('RESOURCE INTEGRATION: Placing device under maintenance blocks new bookings & flags existing reservations', async () => {
      // 1. Place Keysight Oscilloscope (eq_1) into maintenance via IoT monitor
      const maintRes = await request(app)
        .post('/api/iot/devices/IOT-ECE-DSOX3014T-01/maintenance')
        .send({
          isMaintenance: true,
          reason: 'Emergency inspection: Simulated thermal limit exceeded (74.8°C).'
        });
      expect(maintRes.status).toBe(200);

      // 2. Verify equipment status in core catalogue transitioned to maintenance
      const eqRes = await request(app).get('/api/equipment/eq_1');
      expect(eqRes.body.data.status).toBe('maintenance');

      // 3. Verify existing confirmed booking on eq_1 is flagged with maintenance notice
      const bookListRes = await request(app).get('/api/bookings?equipmentId=eq_1');
      const existingBook = bookListRes.body.data.find(b => b.id === 'book_existing_1');
      expect(existingBook.affectedByMaintenance).toBe(true);
      expect(existingBook.maintenanceReviewNotice).toContain('thermal limit');

      // 4. Verify attempting a new booking on eq_1 is BLOCKED with 422 EQUIPMENT_UNAVAILABLE
      const attemptRes = await request(app).post('/api/bookings').send({
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-26T10:00:00.000Z',
        requestedEndTime: '2026-11-26T12:00:00.000Z',
        purposeSummary: 'Booking attempt during thermal maintenance'
      });
      expect(attemptRes.status).toBe(422);
      expect(attemptRes.body.code).toBe('EQUIPMENT_UNAVAILABLE');
    });

    it('RESOURCE INTEGRATION: Restoring equipment to operational status re-enables booking eligibility', async () => {
      // 1. Resolve overheat and restore to operational
      const restoreRes = await request(app).post('/api/iot/demo/resolve').send({ equipmentId: 'eq_1' });
      expect(restoreRes.status).toBe(200);

      // 2. Verify equipment status is operational
      const eqRes = await request(app).get('/api/equipment/eq_1');
      expect(eqRes.body.data.status).toBe('operational');

      // 3. Verify booking is now allowed again
      const newBookingRes = await request(app).post('/api/bookings').send({
        equipmentId: 'eq_1',
        studentId: 'std_1',
        projectId: 'proj_1',
        requestedStartTime: '2026-11-26T10:00:00.000Z',
        requestedEndTime: '2026-11-26T12:00:00.000Z',
        purposeSummary: 'Post-inspection verification session'
      });
      expect(newBookingRes.status).toBe(201);
      expect(newBookingRes.body.success).toBe(true);
      expect(newBookingRes.body.data.status).toBe('pending_faculty');
    });

    it('GET /api/iot/analytics returns aggregate fleet power, health distribution, and department utilization', async () => {
      const res = await request(app).get('/api/iot/analytics');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isSimulated).toBe(true);
      expect(res.body.data.summary.totalMonitoredNodes).toBeGreaterThanOrEqual(6);
      expect(typeof res.body.data.summary.totalPowerConsumptionKw).toBe('number');
      expect(res.body.data.summary.healthDistribution).toHaveProperty('normal');
      expect(res.body.data.summary.healthDistribution).toHaveProperty('warning');
      expect(res.body.data.summary.healthDistribution).toHaveProperty('maintenance');

      const depts = res.body.data.departmentUtilizationComparison;
      expect(depts.length).toBe(4);
      expect(depts.some(d => d.departmentCategory === 'robotics')).toBe(true);
    });
  });

  describe('13. LABLINK CALENDAR CONNECT: Google Calendar & RFC 5545 ICS Export', () => {
    it('generates valid Google Calendar URL with Asia/Kolkata timezone and prefilled details for confirmed booking', async () => {
      // book_existing_1 is confirmed: 2026-11-24T10:00:00.000Z to 2026-11-24T12:00:00.000Z
      const res = await request(app).get('/api/bookings/book_existing_1/calendar');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.timezone).toBe('Asia/Kolkata');
      expect(data.equipmentName).toContain('Keysight');
      expect(data.googleCalendarUrl).toContain('calendar.google.com/calendar/render?action=TEMPLATE');
      expect(data.googleCalendarUrl).toContain('20261124T100000Z%2F20261124T120000Z');
      expect(data.googleCalendarUrl).toContain('ctz=Asia%2FKolkata');
      expect(data.googleCalendarUrl).toContain('ECE-RF-204');
    });

    it('generates RFC 5545 compliant .ics file with CRLF endings and Asia/Kolkata timezone', async () => {
      const res = await request(app).get('/api/bookings/book_existing_1/calendar.ics');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('lablink-booking-book_existing_1.ics');

      const ics = res.body;
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//LabLink//Intelligent Laboratory Resource Network//EN');
      expect(ics).toContain('TZID:Asia/Kolkata');
      expect(ics).toContain('UID:book_existing_1@lablink.campus.edu');
      expect(ics).toContain('DTSTART:20261124T100000Z');
      expect(ics).toContain('DTEND:20261124T120000Z');
      expect(ics).toContain('STATUS:CONFIRMED');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');

      // Verify strict RFC 5545 CRLF line endings
      expect(ics.includes('\r\n')).toBe(true);
    });

    it('blocks calendar export for unconfirmed (pending_faculty) bookings with 422 Unprocessable Entity', async () => {
      // Create a pending booking
      const pendingBooking = store.addBooking({
        id: 'book_pending_cal_test',
        projectId: 'proj_1',
        studentId: 'std_1',
        equipmentId: 'eq_1',
        requestedStartTime: '2026-11-28T10:00:00.000Z',
        requestedEndTime: '2026-11-28T12:00:00.000Z',
        purposeSummary: 'Test pending calendar gate',
        status: 'pending_faculty'
      });

      const res = await request(app).get(`/api/bookings/${pendingBooking.id}/calendar`);
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('awaiting faculty supervisor endorsement');
    });

    it('blocks calendar export for rejected bookings with 422', async () => {
      const rejectedBooking = store.addBooking({
        id: 'book_rejected_cal_test',
        projectId: 'proj_1',
        studentId: 'std_1',
        equipmentId: 'eq_1',
        requestedStartTime: '2026-11-28T14:00:00.000Z',
        requestedEndTime: '2026-11-28T16:00:00.000Z',
        purposeSummary: 'Test rejected calendar gate',
        status: 'rejected'
      });

      const res = await request(app).get(`/api/bookings/${rejectedBooking.id}/calendar`);
      expect(res.status).toBe(422);
      expect(res.body.error).toContain('rejected by faculty');
    });

    it('cancelling a booking sets status to cancelled and disables calendar export', async () => {
      // Cancel book_existing_1
      const cancelRes = await request(app)
        .post('/api/bookings/book_existing_1/cancel')
        .send({ reason: 'Student completed experiment ahead of schedule' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');

      // Attempting to export cancelled booking must fail with 422
      const calRes = await request(app).get('/api/bookings/book_existing_1/calendar');
      expect(calRes.status).toBe(422);
      expect(calRes.body.error).toContain('cancelled');
    });

    it('rejects booking with missing or corrupt dates with 400 Bad Request', () => {
      const corruptBooking = {
        id: 'book_corrupt',
        status: 'confirmed',
        requestedStartTime: 'invalid-date',
        requestedEndTime: '2026-11-24T12:00:00.000Z'
      };

      const validation = CalendarConnectService.validateBookingForExport(corruptBooking, {}, {});
      expect(validation.valid).toBe(false);
      expect(validation.statusCode).toBe(400);
    });

    it('properly escapes special characters (commas, semicolons, backslashes, newlines) in .ics export', () => {
      const textWithSpecialChars = 'GaN modules, tests; with \\backslashes\\ and\nnew lines.';
      const escaped = CalendarConnectService.escapeIcsText(textWithSpecialChars);
      expect(escaped).toBe('GaN modules\\, tests\\; with \\\\backslashes\\\\ and\\nnew lines.');
    });
  });

  describe('14. Live Gemini API Integration, Catalogue Grounding & Fallback Resilience', () => {
    it('GET /api/ai/status returns current AI configuration and offline/online status', async () => {
      const res = await request(app).get('/api/ai/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBeDefined();
      expect(res.body.data.model).toBeDefined();
      expect(typeof res.body.data.isConfigured).toBe('boolean');
    });

    it('sanitizes input: truncates text exceeding limit and redacts PII', () => {
      const longInput = 'A'.repeat(5000);
      const sanitized = sanitizeInput(longInput, 4000);
      expect(sanitized.length).toBe(4000);

      const piiText = 'Contact student at student123@campus.edu or call +1 555-123-4567 for access.';
      const cleaned = sanitizeInput(piiText);
      expect(cleaned).not.toContain('student123@campus.edu');
      expect(cleaned).toContain('[REDACTED_EMAIL]');
      expect(cleaned).not.toContain('555-123-4567');
      expect(cleaned).toContain('[REDACTED_PHONE]');
    });

    it('falls back seamlessly to deterministic engine when GEMINI_API_KEY is not set', async () => {
      AiMatcherService.clearMockClient();
      const payload = {
        title: 'Deep learning diffusion training',
        description: 'Need multi-GPU cluster with 80GB VRAM to train transformer model with fp8 tensor cores.'
      };
      const res = await request(app).post('/api/ai/match').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('deterministic_fallback');
      expect(res.body.data.providerStatus).toBe('offline_rule_based');
      expect(res.body.data.fallbackReason).toContain('GEMINI_API_KEY');
      expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_3')).toBe(true);
    });

    it('processes mocked live Gemini API response with strict catalogue grounding', async () => {
      const mockGeminiResponse = {
        text: JSON.stringify({
          projectCategory: 'Master Thesis',
          extractedCapabilities: ['High-Frequency Signal Acquisition', 'Differential Waveform Characterization'],
          technicalSpecifications: { bandwidth: '1 GHz', channels: 4 },
          estimatedSessionHours: 4,
          missingOrAmbiguousInfo: ['Probing impedance and attenuation factor not stated'],
          recommendations: [
            {
              equipmentId: 'eq_1',
              matchScore: 95,
              groundedRationale: 'Keysight 1 GHz bandwidth matches high-frequency inverter ringing analysis.'
            },
            {
              // Hallucinated ID from hypothetical rogue model output
              equipmentId: 'eq_fantasy_instrument_999',
              matchScore: 99,
              groundedRationale: 'Invented fictional machine.'
            }
          ]
        })
      };

      AiMatcherService.setMockClient({
        models: {
          generateContent: async () => mockGeminiResponse
        }
      });

      try {
        const payload = {
          title: 'Wide-bandgap inverter testing',
          description: 'High-frequency switching measurement on GaN half-bridge with 1 GHz bandwidth requirement.'
        };
        const res = await request(app).post('/api/ai/match').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.provider).toBe('gemini');
        expect(res.body.data.providerStatus).toBe('live');
        expect(res.body.data.extractedRequirements.projectCategory).toBe('Master Thesis');
        expect(res.body.data.extractedRequirements.estimatedSessionHours).toBe(4);
        expect(res.body.data.missingOrAmbiguousInfo.length).toBeGreaterThan(0);

        // Grounding enforcement check:
        // eq_1 must exist in recommendations
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_1')).toBe(true);
        // eq_fantasy_instrument_999 MUST be rejected / filtered out
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_fantasy_instrument_999')).toBe(false);
      } finally {
        AiMatcherService.clearMockClient();
      }
    });

    it('separates equipment under maintenance into unavailableEquipment', async () => {
      const mockGeminiResponse = {
        text: JSON.stringify({
          projectCategory: 'Capstone',
          extractedCapabilities: ['Tensile Characterization', 'High-Frequency RF'],
          estimatedSessionHours: 3,
          recommendations: [
            {
              equipmentId: 'eq_1', // Operational
              matchScore: 90,
              groundedRationale: 'Operational oscilloscope.'
            },
            {
              equipmentId: 'eq_7', // In maintenance (Instron)
              matchScore: 85,
              groundedRationale: 'Mechanical tensile tester.'
            }
          ]
        })
      };

      AiMatcherService.setMockClient({
        models: {
          generateContent: async () => mockGeminiResponse
        }
      });

      try {
        const payload = {
          title: 'Composite material test',
          description: 'Evaluating tensile strength and transducer RF signal output.'
        };
        const res = await request(app).post('/api/ai/match').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_1')).toBe(true);
        expect(res.body.data.unavailableEquipment.some(u => u.equipmentId === 'eq_7')).toBe(true);
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_7')).toBe(false);
      } finally {
        AiMatcherService.clearMockClient();
      }
    });

    it('recovers from malformed JSON response and falls back to deterministic engine', async () => {
      AiMatcherService.setMockClient({
        models: {
          generateContent: async () => ({
            text: 'I cannot provide JSON right now, sorry!'
          })
        }
      });

      try {
        const payload = {
          title: 'Scanning Electron Microscopy',
          description: 'Need high magnification 100000x SEM imaging and nanoscale surface morphology.'
        };
        const res = await request(app).post('/api/ai/match').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.provider).toBe('deterministic_fallback');
        expect(res.body.data.fallbackReason).toContain('unparseable output');
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_2')).toBe(true);
      } finally {
        AiMatcherService.clearMockClient();
      }
    });

    it('handles 429 rate limit error gracefully with deterministic fallback', async () => {
      AiMatcherService.setMockClient({
        models: {
          generateContent: async () => {
            const err = new Error('Resource has been exhausted (e.g. check quota). [429]');
            err.status = 429;
            throw err;
          }
        }
      });

      try {
        const payload = {
          title: 'Confocal microscopy sample',
          description: 'Confocal laser scanning with live cell fluorescence staining.'
        };
        const res = await request(app).post('/api/ai/match').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.provider).toBe('deterministic_fallback');
        expect(res.body.data.fallbackReason).toContain('rate limit');
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_6')).toBe(true);
      } finally {
        AiMatcherService.clearMockClient();
      }
    });

    it('handles 401 invalid credentials gracefully without exposing API keys', async () => {
      AiMatcherService.setMockClient({
        models: {
          generateContent: async () => {
            const err = new Error('API key not valid. Please pass a valid API key. [401]');
            err.status = 401;
            throw err;
          }
        }
      });

      try {
        const payload = {
          title: 'SLA 3D printing enclosure',
          description: 'Prototyping enclosure using SLA resin 3D printing.'
        };
        const res = await request(app).post('/api/ai/match').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.provider).toBe('deterministic_fallback');
        expect(res.body.data.fallbackReason).toContain('authentication failed');
        // Credentials must not appear in response
        expect(JSON.stringify(res.body)).not.toContain('AIzaSy');
      } finally {
        AiMatcherService.clearMockClient();
      }
    });

    it('handles timeout gracefully with deterministic fallback', async () => {
      AiMatcherService.setMockClient({
        models: {
          generateContent: async () => {
            const err = new Error('Gemini API request timed out after 10000ms');
            err.name = 'TimeoutError';
            throw err;
          }
        }
      });

      try {
        const payload = {
          title: 'Robotics trajectory control',
          description: 'Articulated robotic arm sample handling with high repeatability.'
        };
        const res = await request(app).post('/api/ai/match').send(payload);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.provider).toBe('deterministic_fallback');
        expect(res.body.data.fallbackReason).toContain('timed out');
        expect(res.body.data.recommendations.some(r => r.equipmentId === 'eq_8')).toBe(true);
      } finally {
        AiMatcherService.clearMockClient();
      }
    });
  });
});
