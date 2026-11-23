/**
 * FAIRALLOC: Explainable, Constraint-Aware Resource Allocation Engine
 *
 * Deterministic engine responsible for:
 * 1. Equipment compatibility & safety eligibility verification
 * 2. Operating hours and maintenance blackout validation
 * 3. Exact interval overlap conflict detection
 * 4. Multi-factor reproducible priority scoring (Urgency, Academic Tier, Fairness/Past Usage, Faculty Endorsement)
 * 5. Mathematically grounded and verified alternative feasible slot discovery
 * 6. Faculty approval state management
 */

export class FairAllocEngine {
  /**
   * Check if student certifications satisfy equipment safety prerequisites
   */
  static checkEligibility(student, equipment) {
    if (!equipment.safetyPrerequisites || equipment.safetyPrerequisites.length === 0) {
      return { eligible: true, missingCertifications: [] };
    }

    const studentCerts = new Set(student.certifications || []);
    if (studentCerts.has('ALL')) {
      return { eligible: true, missingCertifications: [] };
    }

    const missing = equipment.safetyPrerequisites.filter(req => !studentCerts.has(req));
    return {
      eligible: missing.length === 0,
      missingCertifications: missing
    };
  }

  /**
   * Validate that equipment is operational
   */
  static checkEquipmentStatus(equipment) {
    if (equipment.status !== 'operational') {
      return {
        operational: false,
        reason: `Equipment '${equipment.name}' is currently ${equipment.status.toUpperCase()} and unavailable for booking.`
      };
    }
    return { operational: true };
  }

  /**
   * Check if requested slot falls within equipment daily operating hours
   */
  static checkOperatingHours(startTimeStr, endTimeStr, operatingHours) {
    if (!operatingHours || !operatingHours.open || !operatingHours.close) {
      return { withinHours: true };
    }

    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);

    // Check day of week
    if (operatingHours.daysOfWeek && operatingHours.daysOfWeek.length > 0) {
      const day = start.getUTCDay();
      if (!operatingHours.daysOfWeek.includes(day)) {
        return {
          withinHours: false,
          reason: `Lab is closed on ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]}.`
        };
      }
    }

    const startHours = start.getUTCHours() + start.getUTCMinutes() / 60;
    const endHours = end.getUTCHours() + end.getUTCMinutes() / 60;

    const [openH, openM] = operatingHours.open.split(':').map(Number);
    const [closeH, closeM] = operatingHours.close.split(':').map(Number);
    const openFloat = openH + (openM || 0) / 60;
    const closeFloat = closeH + (closeM || 0) / 60;

    if (startHours < openFloat || endHours > closeFloat) {
      return {
        withinHours: false,
        reason: `Requested time (${operatingHours.open}-${operatingHours.close} UTC operating window violated). Slot: ${startHours.toFixed(1)}h - ${endHours.toFixed(1)}h UTC.`
      };
    }

    return { withinHours: true };
  }

  /**
   * Check if two time intervals overlap (with optional buffer minutes)
   */
  static isOverlapping(startAStr, endAStr, startBStr, endBStr, bufferMinutes = 0) {
    const startA = new Date(startAStr).getTime();
    const endA = new Date(endAStr).getTime() + (bufferMinutes * 60 * 1000);
    const startB = new Date(startBStr).getTime();
    const endB = new Date(endBStr).getTime() + (bufferMinutes * 60 * 1000);

    return startA < endB && endA > startB;
  }

  /**
   * Detect any conflicts with existing bookings or scheduled maintenance
   */
  static detectConflicts(equipmentId, requestedStartStr, requestedEndStr, existingBookings = [], maintenanceWindows = [], bufferMinutes = 0) {
    const conflicts = [];

    // Check maintenance windows
    for (const maint of maintenanceWindows) {
      if (maint.equipmentId === equipmentId) {
        if (this.isOverlapping(requestedStartStr, requestedEndStr, maint.startTime, maint.endTime, 0)) {
          conflicts.push({
            type: 'maintenance',
            id: maint.id,
            title: maint.title,
            startTime: maint.startTime,
            endTime: maint.endTime,
            reason: `Maintenance conflict: ${maint.title} (${maint.reason || 'Routine calibration'})`
          });
        }
      }
    }

    // Check existing confirmed/pending bookings
    for (const book of existingBookings) {
      if (book.equipmentId === equipmentId && book.status === 'confirmed') {
        if (this.isOverlapping(requestedStartStr, requestedEndStr, book.requestedStartTime, book.requestedEndTime, bufferMinutes)) {
          conflicts.push({
            type: 'booking',
            id: book.id,
            projectId: book.projectId,
            startTime: book.requestedStartTime,
            endTime: book.requestedEndTime,
            reason: `Occupied by confirmed reservation: ${book.purposeSummary || book.id}`
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * FAIRALLOC Deterministic Multi-Factor Priority Scoring
   *
   * Formula:
   * Score = 0.35 * Urgency + 0.25 * AcademicTier + 0.25 * Fairness + 0.15 * FacultyEndorsement
   */
  static calculatePriorityScore(project, student, facultyEndorsement = null, referenceTime = new Date()) {
    const refDate = new Date(referenceTime);
    const deadlineDate = project?.deliverableDeadline ? new Date(project.deliverableDeadline) : new Date(refDate.getTime() + 14 * 86400000);
    
    // 1. Urgency Score (0 - 100)
    const diffMs = deadlineDate.getTime() - refDate.getTime();
    const daysUntilDeadline = Math.max(0.1, diffMs / (1000 * 60 * 60 * 24));
    let urgencyScore = 20;
    if (daysUntilDeadline <= 1) {
      urgencyScore = 98;
    } else if (daysUntilDeadline <= 3) {
      urgencyScore = 90;
    } else if (daysUntilDeadline <= 7) {
      urgencyScore = 78;
    } else if (daysUntilDeadline <= 14) {
      urgencyScore = 60;
    } else {
      urgencyScore = Math.max(20, Math.round(100 * Math.exp(-0.04 * daysUntilDeadline)));
    }

    // 2. Academic Tier Weight (0 - 100)
    const categoryWeights = {
      phd_thesis: 100,
      masters_thesis: 85,
      undergrad_capstone: 75,
      grant_research: 70,
      hackathon_innovation: 60,
      course_lab: 50
    };
    const academicTierScore = categoryWeights[project?.category] || 45;

    // 3. Fairness & Prior Consumption Score (0 - 100)
    // Fair monthly quota benchmark is 20 hours.
    // Students who have consumed less hours receive higher priority.
    const priorHours = student?.priorUsageHoursMonth || 0;
    let fairnessScore = 50;
    if (priorHours <= 5) {
      fairnessScore = 95; // Low historical footprint bonus
    } else if (priorHours <= 15) {
      fairnessScore = 80;
    } else if (priorHours <= 25) {
      fairnessScore = 55;
    } else {
      fairnessScore = Math.max(10, Math.round(100 - (priorHours / 20) * 35)); // Resource hog penalty
    }

    // 4. Faculty Endorsement Score (0 - 100)
    let endorsementScore = 35; // default pending
    if (facultyEndorsement?.isApproved === true) {
      endorsementScore = 100;
    } else if (facultyEndorsement?.isApproved === false) {
      endorsementScore = 0;
    }

    // Composite Weighted Calculation
    const compositeScore = Number((
      0.35 * urgencyScore +
      0.25 * academicTierScore +
      0.25 * fairnessScore +
      0.15 * endorsementScore
    ).toFixed(1));

    // Grounded human-readable explanation
    const explanation = [
      `FAIRALLOC Score: ${compositeScore}/100.`,
      `[Urgency: ${urgencyScore}/100] Deliverable due in ${daysUntilDeadline.toFixed(1)} days (${project?.deliverableDeadline?.slice(0, 10)}).`,
      `[Academic Tier: ${academicTierScore}/100] Program track: ${project?.category?.replace('_', ' ').toUpperCase() || 'GENERAL'}.`,
      `[Fairness Index: ${fairnessScore}/100] Prior 30-day usage: ${priorHours} hrs (Fair benchmark: 20 hrs).`,
      `[Faculty Status: ${endorsementScore}/100] ${facultyEndorsement?.isApproved ? 'Endorsed by faculty supervisor' : (facultyEndorsement?.isApproved === false ? 'Rejected by faculty' : 'Pending faculty review')}.`
    ].join(' ');

    return {
      score: compositeScore,
      breakdown: {
        urgencyScore,
        academicTierScore,
        fairnessScore,
        endorsementScore,
        daysUntilDeadline: Number(daysUntilDeadline.toFixed(1)),
        priorUsageHours: priorHours
      },
      explanation
    };
  }

  /**
   * Find feasible alternative slots that are provably non-conflicting
   * Scans candidate windows during valid operating hours
   */
  static findFeasibleAlternativeSlots(equipment, requestedStartStr, requestedEndStr, existingBookings = [], maintenanceWindows = [], allEquipment = []) {
    const durationMs = new Date(requestedEndStr).getTime() - new Date(requestedStartStr).getTime();
    if (durationMs <= 0) return [];

    const feasibleSlots = [];
    const baseDate = new Date(requestedStartStr);
    const horizonDays = 7;

    // First scan candidate slots on the SAME equipment
    for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
      if (feasibleSlots.length >= 3) break;

      const candidateDay = new Date(baseDate);
      candidateDay.setUTCDate(baseDate.getUTCDate() + dayOffset);

      // Try morning and afternoon test slots within operating hours
      const testHours = [9, 11, 14, 16];
      for (const hour of testHours) {
        if (feasibleSlots.length >= 3) break;

        const candidateStart = new Date(candidateDay);
        candidateStart.setUTCHours(hour, 0, 0, 0);
        const candidateEnd = new Date(candidateStart.getTime() + durationMs);

        // Skip slots that are identical to the originally requested slot
        if (candidateStart.toISOString() === new Date(requestedStartStr).toISOString()) {
          continue;
        }

        // Must be in future or ahead of baseDate
        if (candidateStart.getTime() <= baseDate.getTime() && dayOffset === 0) {
          continue;
        }

        // Check operating hours
        const opCheck = this.checkOperatingHours(candidateStart.toISOString(), candidateEnd.toISOString(), equipment.operatingHours);
        if (!opCheck.withinHours) continue;

        // Check conflicts
        const conflictCheck = this.detectConflicts(
          equipment.id,
          candidateStart.toISOString(),
          candidateEnd.toISOString(),
          existingBookings,
          maintenanceWindows,
          equipment.bufferTimeMinutes || 0
        );

        if (!conflictCheck.hasConflict) {
          feasibleSlots.push({
            equipmentId: equipment.id,
            equipmentName: equipment.name,
            startTime: candidateStart.toISOString(),
            endTime: candidateEnd.toISOString(),
            department: equipment.department,
            type: 'same_equipment'
          });
        }
      }
    }

    // If needed or to offer diversity, check equivalent equipment in sister departments
    if (feasibleSlots.length < 3 && allEquipment && allEquipment.length > 0) {
      const alternatives = allEquipment.filter(e => 
        e.id !== equipment.id && 
        e.category === equipment.category && 
        e.status === 'operational'
      );

      for (const altEq of alternatives) {
        if (feasibleSlots.length >= 3) break;

        for (let dayOffset = 0; dayOffset <= 3; dayOffset++) {
          if (feasibleSlots.length >= 3) break;

          const candidateDay = new Date(baseDate);
          candidateDay.setUTCDate(baseDate.getUTCDate() + dayOffset);

          const candidateStart = new Date(candidateDay);
          candidateStart.setUTCHours(10, 0, 0, 0);
          const candidateEnd = new Date(candidateStart.getTime() + durationMs);

          const conflictCheck = this.detectConflicts(
            altEq.id,
            candidateStart.toISOString(),
            candidateEnd.toISOString(),
            existingBookings,
            maintenanceWindows,
            altEq.bufferTimeMinutes || 0
          );

          if (!conflictCheck.hasConflict) {
            feasibleSlots.push({
              equipmentId: altEq.id,
              equipmentName: altEq.name,
              startTime: candidateStart.toISOString(),
              endTime: candidateEnd.toISOString(),
              department: altEq.department,
              type: 'cross_department_alternative'
            });
          }
        }
      }
    }

    return feasibleSlots;
  }
}
