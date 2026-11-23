/**
 * LABLINK CALENDAR CONNECT SERVICE
 *
 * Generates properly formatted personal calendar events for approved/confirmed lab bookings:
 * 1. Google Calendar pre-filled URL with Asia/Kolkata timezone and encoded metadata
 * 2. RFC 5545 compliant iCalendar (.ics) export with CRLF line endings and proper escaping
 * 3. Strict booking status verification (confirmed-only gate)
 */

export class CalendarConnectService {
  /**
   * Format Date to iCalendar compact UTC format: YYYYMMDDTHHmmssZ
   */
  static formatIcsUtc(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date value: ${dateInput}`);
    }

    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z'
    );
  }

  /**
   * Escape text according to RFC 5545 specs (commas, semicolons, backslashes, newlines)
   */
  static escapeIcsText(str) {
    if (!str) return '';
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\n|\r/g, '\\n');
  }

  /**
   * Validate booking for calendar export
   */
  static validateBookingForExport(booking, equipment, project) {
    if (!booking) {
      return { valid: false, statusCode: 404, error: 'Booking record not found.' };
    }

    // Status gate: only confirmed bookings can be exported
    if (booking.status !== 'confirmed') {
      let stateMessage = '';
      if (booking.status === 'pending_faculty') {
        stateMessage = 'Reservation is currently awaiting faculty supervisor endorsement. Calendar events are only generated for confirmed bookings.';
      } else if (booking.status === 'rejected') {
        stateMessage = 'Reservation was rejected by faculty or lab operations. Cannot export to calendar.';
      } else if (booking.status === 'cancelled') {
        stateMessage = 'Reservation has been cancelled and cannot be exported as an active session.';
      } else {
        stateMessage = `Booking is in '${booking.status}' status. Only confirmed bookings are eligible for calendar integration.`;
      }

      return {
        valid: false,
        statusCode: 422,
        error: stateMessage,
        currentStatus: booking.status
      };
    }

    if (!booking.requestedStartTime || !booking.requestedEndTime) {
      return {
        valid: false,
        statusCode: 400,
        error: 'Booking is missing requestedStartTime or requestedEndTime.'
      };
    }

    const start = new Date(booking.requestedStartTime);
    const end = new Date(booking.requestedEndTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        valid: false,
        statusCode: 400,
        error: 'Booking timestamps are invalid or corrupted.'
      };
    }

    if (start >= end) {
      return {
        valid: false,
        statusCode: 400,
        error: 'Start time must strictly precede end time.'
      };
    }

    return { valid: true };
  }

  /**
   * Generate Google Calendar event URL
   */
  static generateGoogleCalendarUrl(booking, equipment, project, options = {}) {
    const validation = this.validateBookingForExport(booking, equipment, project);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const startUtc = this.formatIcsUtc(booking.requestedStartTime);
    const endUtc = this.formatIcsUtc(booking.requestedEndTime);

    const eqName = equipment?.name || 'Laboratory Workstation';
    const projTitle = project?.title || booking.purposeSummary || 'Academic Project';
    const labRoom = equipment?.labRoom || 'Main Lab';
    const department = equipment?.department || 'Engineering';

    // Summary Title
    const title = `[LabLink] ${eqName} - ${projTitle}`;

    // Detailed Body
    const details = [
      `LABLINK CAMPUS LABORATORY RESERVATION`,
      `---------------------------------------`,
      `Booking ID: ${booking.id}`,
      `Equipment: ${eqName} (${equipment?.model || ''})`,
      `Department: ${department}`,
      `Lab Room: ${labRoom}`,
      `Project: ${projTitle}`,
      `Student ID: ${booking.studentId}`,
      `FAIRALLOC Score: ${booking.allocationMetadata?.fairAllocScore || 'N/A'}/100`,
      ``,
      `INSTRUCTIONS & PROTOCOLS:`,
      `1. Please arrive 5 minutes prior to slot start time for custodian check-in.`,
      `2. Ensure required certification badges are visible: ${equipment?.safetyPrerequisites?.join(', ') || 'Standard Lab Badge'}.`,
      `3. Verify calibration log before and after session.`,
      `4. Report any anomalies immediately to lab custodian (${equipment?.custodianFacultyId || 'Central Operations'}).`
    ].join('\n');

    // Location
    const location = `${labRoom}, ${department}, Campus Research Infrastructure`;

    const baseUrl = 'https://calendar.google.com/calendar/render';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${startUtc}/${endUtc}`,
      details: details,
      location: location,
      ctz: 'Asia/Kolkata' // Timezone handling as requested
    });

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Generate RFC 5545 iCalendar (.ics) content
   */
  static generateIcsContent(booking, equipment, project) {
    const validation = this.validateBookingForExport(booking, equipment, project);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const startUtc = this.formatIcsUtc(booking.requestedStartTime);
    const endUtc = this.formatIcsUtc(booking.requestedEndTime);
    const nowUtc = this.formatIcsUtc(new Date());

    const eqName = equipment?.name || 'Laboratory Workstation';
    const projTitle = project?.title || booking.purposeSummary || 'Academic Project';
    const labRoom = equipment?.labRoom || 'Main Lab';
    const department = equipment?.department || 'Engineering';

    const title = `[LabLink] ${eqName} - ${projTitle}`;
    const location = `${labRoom}, ${department}, Campus Labs`;
    const uid = `${booking.id}@lablink.campus.edu`;

    const description = [
      `LabLink Laboratory Reservation`,
      `Booking ID: ${booking.id}`,
      `Equipment: ${eqName} (${equipment?.model || ''})`,
      `Lab Location: ${labRoom} (${department})`,
      `Student ID: ${booking.studentId}`,
      `Project: ${projTitle}`,
      `Safety Prerequisites: ${equipment?.safetyPrerequisites?.join(', ') || 'Standard Lab Safety'}`,
      `Notice: Arrive 5 minutes prior with campus certification badges.`
    ].join('\n');

    // Build RFC 5545 structure with strict \r\n line endings
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LabLink//Intelligent Laboratory Resource Network//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-TIMEZONE:Asia/Kolkata',
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Kolkata',
      'X-LIC-LOCATION:Asia/Kolkata',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0530',
      'TZOFFSETTO:+0530',
      'TZNAME:IST',
      'DTSTART:19700101T000000',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${startUtc}`,
      `DTEND:${endUtc}`,
      `SUMMARY:${this.escapeIcsText(title)}`,
      `DESCRIPTION:${this.escapeIcsText(description)}`,
      `LOCATION:${this.escapeIcsText(location)}`,
      'STATUS:CONFIRMED',
      'CATEGORIES:LABORATORY,RESEARCH,ACADEMIC',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Upcoming LabLink reservation in 15 minutes',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    return lines.join('\r\n') + '\r\n';
  }
}
