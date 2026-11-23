import express from 'express';
import { store } from '../services/store.js';
import { FairAllocEngine } from '../services/fairalloc.js';
import { CalendarConnectService } from '../services/calendarConnect.js';
import { GoogleCalendarSyncService } from '../services/googleCalendarSync.js';

const router = express.Router();

// GET /api/bookings - Query bookings
router.get('/', (req, res) => {
  try {
    const { studentId, equipmentId, status } = req.query;
    let list = store.getBookings();

    if (studentId) list = list.filter(b => b.studentId === studentId);
    if (equipmentId) list = list.filter(b => b.equipmentId === equipmentId);
    if (status) list = list.filter(b => b.status === status);

    res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings/:id - Single booking
router.get('/:id', (req, res) => {
  const item = store.getBookingById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Booking not found' });
  }
  res.json({ success: true, data: item });
});

// POST /api/bookings - Submit project-based booking with atomic mutex and FAIRALLOC checks
router.post('/', async (req, res) => {
  try {
    const { equipmentId, studentId, projectId, requestedStartTime, requestedEndTime, purposeSummary } = req.body;

    // 1. Rigorous Server-Side Input Validation
    const validationErrors = [];
    if (!equipmentId || typeof equipmentId !== 'string') validationErrors.push('Field equipmentId is required and must be a string.');
    if (!studentId || typeof studentId !== 'string') validationErrors.push('Field studentId is required and must be a string.');
    if (!projectId || typeof projectId !== 'string') validationErrors.push('Field projectId is required and must be a string.');
    if (!requestedStartTime) validationErrors.push('Field requestedStartTime is required.');
    if (!requestedEndTime) validationErrors.push('Field requestedEndTime is required.');

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const startDate = new Date(requestedStartTime);
    const endDate = new Date(requestedEndTime);

    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid requestedStartTime format (must be ISO datetime).' });
    }
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid requestedEndTime format (must be ISO datetime).' });
    }
    if (startDate >= endDate) {
      return res.status(400).json({ success: false, error: 'requestedStartTime must precede requestedEndTime.' });
    }

    const durationHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (durationHours > 12) {
      return res.status(400).json({ success: false, error: 'Single booking duration cannot exceed 12 continuous hours.' });
    }

    // 2. Entity Lookups
    const equipment = store.getEquipmentById(equipmentId);
    if (!equipment) {
      return res.status(404).json({ success: false, error: `Equipment with ID '${equipmentId}' not found.` });
    }

    const student = store.getUserById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, error: `Student with ID '${studentId}' not found.` });
    }

    const project = store.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: `Project with ID '${projectId}' not found.` });
    }

    // 3. Operational and Maintenance Status Check
    const statusCheck = FairAllocEngine.checkEquipmentStatus(equipment);
    if (!statusCheck.operational) {
      const feasibleAlternatives = FairAllocEngine.findFeasibleAlternativeSlots(
        equipment,
        requestedStartTime,
        requestedEndTime,
        store.getBookings(),
        store.getMaintenanceWindows(),
        store.getEquipment()
      );

      return res.status(422).json({
        success: false,
        error: statusCheck.reason,
        code: 'EQUIPMENT_UNAVAILABLE',
        feasibleAlternatives
      });
    }

    // 4. Student Safety & Certification Eligibility Check
    const eligibility = FairAllocEngine.checkEligibility(student, equipment);
    if (!eligibility.eligible) {
      return res.status(403).json({
        success: false,
        error: `Ineligible student: Safety prerequisites not satisfied. Missing certifications: ${eligibility.missingCertifications.join(', ')}`,
        code: 'STUDENT_INELIGIBLE',
        missingCertifications: eligibility.missingCertifications,
        requiredCertifications: equipment.safetyPrerequisites
      });
    }

    // 5. Operating Hours Verification
    const operatingCheck = FairAllocEngine.checkOperatingHours(requestedStartTime, requestedEndTime, equipment.operatingHours);
    if (!operatingCheck.withinHours) {
      return res.status(422).json({
        success: false,
        error: operatingCheck.reason,
        code: 'OUTSIDE_OPERATING_HOURS'
      });
    }

    // 6. Concurrency-Safe Atomic Check & Allocation under Mutex Lock
    const bookingResult = await store.withLock(equipmentId, async () => {
      // Re-query latest bookings and maintenance windows under lock
      const currentBookings = store.getBookings();
      const currentMaintenance = store.getMaintenanceWindows();

      const conflictCheck = FairAllocEngine.detectConflicts(
        equipmentId,
        requestedStartTime,
        requestedEndTime,
        currentBookings,
        currentMaintenance,
        equipment.bufferTimeMinutes || 0
      );

      if (conflictCheck.hasConflict) {
        // Compute verified feasible alternatives
        const feasibleAlternatives = FairAllocEngine.findFeasibleAlternativeSlots(
          equipment,
          requestedStartTime,
          requestedEndTime,
          currentBookings,
          currentMaintenance,
          store.getEquipment()
        );

        return {
          conflict: true,
          conflicts: conflictCheck.conflicts,
          feasibleAlternatives
        };
      }

      // Calculate initial FAIRALLOC Priority Score
      const fairAllocEval = FairAllocEngine.calculatePriorityScore(project, student, null);

      const newBooking = {
        id: `book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        studentId,
        equipmentId,
        requestedStartTime,
        requestedEndTime,
        purposeSummary: purposeSummary || project.title,
        status: 'pending_faculty', // Requires supervisor endorsement
        facultyEndorsement: null,
        allocationMetadata: {
          fairAllocScore: fairAllocEval.score,
          scoreBreakdown: fairAllocEval.breakdown,
          explanation: fairAllocEval.explanation
        },
        createdAt: new Date().toISOString()
      };

      store.addBooking(newBooking);
      return { conflict: false, booking: newBooking };
    });

    if (bookingResult.conflict) {
      return res.status(409).json({
        success: false,
        error: 'Requested time slot has a scheduling conflict.',
        code: 'SLOT_CONFLICT',
        conflicts: bookingResult.conflicts,
        feasibleAlternatives: bookingResult.feasibleAlternatives,
        recommendation: bookingResult.feasibleAlternatives.length > 0 
          ? `FAIRALLOC identified ${bookingResult.feasibleAlternatives.length} non-conflicting feasible alternative slots.`
          : 'No feasible alternative slots available within the 7-day scheduling horizon.'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Booking request created successfully. Submitted for faculty endorsement.',
      data: bookingResult.booking
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bookings/:id/endorse - Faculty supervisor approves or rejects request
router.post('/:id/endorse', async (req, res) => {
  try {
    const { facultyId, isApproved, note } = req.body;
    const booking = store.getBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Field isApproved is required and must be a boolean (true to approve, false to reject).'
      });
    }

    const endorsement = {
      facultyId: facultyId || 'fac_1',
      endorsedAt: new Date().toISOString(),
      isApproved,
      note: note || (isApproved ? 'Approved by faculty supervisor.' : 'Declined by faculty supervisor.')
    };

    // Update status based on approval
    const newStatus = isApproved ? 'confirmed' : 'rejected';

    // Recalculate FAIRALLOC score reflecting faculty action
    const student = store.getUserById(booking.studentId);
    const project = store.getProjectById(booking.projectId);
    const updatedFairAlloc = FairAllocEngine.calculatePriorityScore(project, student, endorsement);

    const updatedBooking = store.updateBooking(booking.id, {
      status: newStatus,
      facultyEndorsement: endorsement,
      allocationMetadata: {
        fairAllocScore: updatedFairAlloc.score,
        scoreBreakdown: updatedFairAlloc.breakdown,
        explanation: updatedFairAlloc.explanation
      }
    });

    // Auto-sync approved reservation to student's Google Calendar if connected
    if (isApproved) {
      try {
        await GoogleCalendarSyncService.syncBookingToGoogle(booking.id);
      } catch (syncErr) {
        console.warn(`[Auto-Sync] Notice on approval for ${booking.id}:`, syncErr.message);
      }
    }

    res.json({
      success: true,
      message: `Booking request successfully ${isApproved ? 'approved and confirmed' : 'rejected'}.`,
      data: updatedBooking
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bookings/:id/cancel - Student or admin cancels a booking
router.post('/:id/cancel', async (req, res) => {
  try {
    const booking = store.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const updated = store.updateBooking(booking.id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: req.body.reason || 'Cancelled by requester'
    });

    // Remove or cancel mapped Google Calendar event if synced
    try {
      await GoogleCalendarSyncService.deleteGoogleEvent(booking.id);
    } catch (syncErr) {
      console.warn(`[Auto-Sync] Notice on cancellation for ${booking.id}:`, syncErr.message);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully. Calendar synchronization disabled.',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings/:id/calendar - Retrieve Google Calendar URL & metadata
router.get('/:id/calendar', (req, res) => {
  try {
    const booking = store.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const equipment = store.getEquipmentById(booking.equipmentId);
    const project = store.getProjectById(booking.projectId);

    // Validate confirmation status and dates
    const validation = CalendarConnectService.validateBookingForExport(booking, equipment, project);
    if (!validation.valid) {
      return res.status(validation.statusCode).json({
        success: false,
        error: validation.error,
        currentStatus: validation.currentStatus
      });
    }

    const googleUrl = CalendarConnectService.generateGoogleCalendarUrl(booking, equipment, project);
    const icsDownloadUrl = `/api/bookings/${booking.id}/calendar.ics`;

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        status: booking.status,
        equipmentName: equipment?.name,
        labRoom: equipment?.labRoom,
        department: equipment?.department,
        timezone: 'Asia/Kolkata',
        startTime: booking.requestedStartTime,
        endTime: booking.requestedEndTime,
        googleCalendarUrl: googleUrl,
        icsDownloadUrl: icsDownloadUrl
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings/:id/calendar.ics - Download RFC 5545 .ics file
router.get('/:id/calendar.ics', (req, res) => {
  try {
    const booking = store.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).send('Booking not found');
    }

    const equipment = store.getEquipmentById(booking.equipmentId);
    const project = store.getProjectById(booking.projectId);

    const validation = CalendarConnectService.validateBookingForExport(booking, equipment, project);
    if (!validation.valid) {
      return res.status(validation.statusCode).send(validation.error);
    }

    const icsString = CalendarConnectService.generateIcsContent(booking, equipment, project);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lablink-booking-${booking.id}.ics"`);
    res.send(icsString);
  } catch (err) {
    res.status(500).send(`Calendar generation error: ${err.message}`);
  }
});

export default router;
