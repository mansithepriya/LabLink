import { google } from 'googleapis';
import { tokenStore } from './tokenStore.js';
import { store } from './store.js';
import { GoogleOAuthService } from './googleOAuth.js';
import { CalendarConnectService } from './calendarConnect.js';

/**
 * Enterprise Bidirectional Google Calendar Synchronization Engine for LabLink
 *
 * Capabilities:
 * 1. Outbound Sync: Auto-creates, modifies, and cancels Google Calendar events on booking lifecycle events.
 * 2. Idempotent Mapping: Re-syncing does not create duplicate events.
 * 3. Inbound Incremental Sync: Utilizes Google Calendar events.list with syncToken and pagination.
 * 4. Self-Healing 410 Recovery: Detects expired sync tokens and executes an automatic full resync.
 * 5. Tamper Detection: Detects external alterations to LabLink events without allowing external edits
 *    to silently alter approved university lab slots (FAIRALLOC remains authoritative).
 * 6. Conflict Detection: Identifies external personal calendar appointments overlapping with lab bookings.
 * 7. Webhook & Fallback Polling: Processes push notifications or triggers manual/polling sync.
 */

export class GoogleCalendarSyncService {
  static _mockCalendar = null;

  static setMockCalendar(mock) {
    GoogleCalendarSyncService._mockCalendar = mock;
  }

  static clearMockCalendar() {
    GoogleCalendarSyncService._mockCalendar = null;
  }

  /**
   * Instantiate Google Calendar API client for a user
   */
  static async getCalendarClient(userId) {
    if (GoogleCalendarSyncService._mockCalendar) {
      return GoogleCalendarSyncService._mockCalendar;
    }

    const auth = await GoogleOAuthService.getAuthenticatedClient(userId);
    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Format human-readable event description for Google Calendar
   */
  static formatEventDescription(booking, equipment, project) {
    return [
      `LABLINK CAMPUS LABORATORY RESERVATION`,
      `=======================================`,
      `Booking ID: ${booking.id}`,
      `Equipment: ${equipment?.name || 'Laboratory Instrument'} (${equipment?.model || ''})`,
      `Department: ${equipment?.department || 'Engineering'}`,
      `Lab Room: ${equipment?.labRoom || 'Main Lab'}`,
      `Project: ${project?.title || booking.purposeSummary || 'Academic Project'}`,
      `Student ID: ${booking.studentId}`,
      `FAIRALLOC Score: ${booking.allocationMetadata?.fairAllocScore || 'N/A'}/100`,
      ``,
      `INSTRUCTIONS & PROTOCOLS:`,
      `1. Please arrive 5 minutes prior to slot start time for custodian check-in.`,
      `2. Ensure required certification badges are visible: ${equipment?.safetyPrerequisites?.join(', ') || 'Standard Lab Badge'}.`,
      `3. Verify calibration log before and after session.`,
      `4. Report any anomalies immediately to lab custodian (${equipment?.custodianFacultyId || 'Central Operations'}).`,
      ``,
      `NOTICE: Modifying this event on Google Calendar does not alter your approved reservation. All official scheduling adjustments must be submitted through LabLink.`
    ].join('\n');
  }

  // ==================== OUTBOUND: LABLINK -> GOOGLE CALENDAR ====================

  /**
   * Synchronize an approved booking to Google Calendar
   * Idempotent: Updates if already mapped; inserts if not.
   */
  static async syncBookingToGoogle(bookingId) {
    const booking = store.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Booking '${bookingId}' not found`);
    }

    // Only confirmed bookings can create/maintain calendar events
    if (booking.status !== 'confirmed') {
      return {
        synced: false,
        reason: `Booking status is '${booking.status}'. Only confirmed bookings are synchronized.`
      };
    }

    const userId = booking.studentId;
    const tokens = tokenStore.getUserTokens(userId);
    if (!tokens) {
      return {
        synced: false,
        reason: `User '${userId}' has not connected Google Calendar.`
      };
    }

    const equipment = store.getEquipmentById(booking.equipmentId);
    const project = store.getProjectById(booking.projectId);
    const calendar = await GoogleCalendarSyncService.getCalendarClient(userId);

    const summary = `[LabLink] ${equipment?.name || 'Lab Instrument'} - ${project?.title || 'Academic Project'}`;
    const description = GoogleCalendarSyncService.formatEventDescription(booking, equipment, project);
    const location = `${equipment?.labRoom || 'Main Lab'}, ${equipment?.department || 'Engineering'}, Campus Labs`;

    const eventPayload = {
      summary,
      description,
      location,
      start: {
        dateTime: new Date(booking.requestedStartTime).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: new Date(booking.requestedEndTime).toISOString(),
        timeZone: 'Asia/Kolkata'
      },
      extendedProperties: {
        private: {
          lablinkBookingId: booking.id,
          lablinkStudentId: booking.studentId,
          lablinkEquipmentId: booking.equipmentId
        }
      }
    };

    const existingMapping = tokenStore.getEventMapping(booking.id);

    try {
      if (existingMapping && existingMapping.googleEventId && existingMapping.status === 'synced') {
        // Idempotent update: update existing mapped event
        const res = await calendar.events.patch({
          calendarId: existingMapping.googleCalendarId || 'primary',
          eventId: existingMapping.googleEventId,
          requestBody: eventPayload
        });

        tokenStore.saveEventMapping(booking.id, {
          userId,
          googleEventId: existingMapping.googleEventId,
          googleCalendarId: existingMapping.googleCalendarId || 'primary',
          lastKnownSummary: summary,
          lastKnownStartTime: booking.requestedStartTime,
          lastKnownEndTime: booking.requestedEndTime,
          status: 'synced'
        });

        return {
          synced: true,
          action: 'updated',
          googleEventId: existingMapping.googleEventId,
          htmlLink: res.data?.htmlLink
        };
      } else {
        // Create new Google Calendar event
        const res = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: eventPayload
        });

        const googleEventId = res.data?.id;

        tokenStore.saveEventMapping(booking.id, {
          userId,
          googleEventId,
          googleCalendarId: 'primary',
          lastKnownSummary: summary,
          lastKnownStartTime: booking.requestedStartTime,
          lastKnownEndTime: booking.requestedEndTime,
          status: 'synced'
        });

        // Update booking metadata in store
        store.updateBooking(booking.id, {
          googleCalendarSync: {
            synced: true,
            googleEventId,
            syncedAt: new Date().toISOString()
          }
        });

        return {
          synced: true,
          action: 'created',
          googleEventId,
          htmlLink: res.data?.htmlLink
        };
      }
    } catch (err) {
      console.error(`[GoogleCalendarSync] Outbound sync failed for booking ${bookingId}:`, err.message);
      throw err;
    }
  }

  /**
   * Delete or mark cancelled on Google Calendar when booking is cancelled
   */
  static async deleteGoogleEvent(bookingId) {
    const mapping = tokenStore.getEventMapping(bookingId);
    if (!mapping || !mapping.googleEventId || mapping.status === 'cancelled') {
      return { deleted: false, reason: 'No active Google Calendar event mapped' };
    }

    const userId = mapping.userId;
    const tokens = tokenStore.getUserTokens(userId);
    if (!tokens) {
      tokenStore.deleteEventMapping(bookingId);
      return { deleted: true, reason: 'User not connected; mapping cleaned locally' };
    }

    try {
      const calendar = await GoogleCalendarSyncService.getCalendarClient(userId);
      await calendar.events.delete({
        calendarId: mapping.googleCalendarId || 'primary',
        eventId: mapping.googleEventId
      });
    } catch (err) {
      // If 404 or 410, it was already deleted externally
      if (err.code !== 404 && err.code !== 410) {
        console.warn(`[GoogleCalendarSync] Event delete warning for ${bookingId}:`, err.message);
      }
    } finally {
      tokenStore.deleteEventMapping(bookingId);
    }

    return { deleted: true };
  }

  // ==================== INBOUND: GOOGLE CALENDAR -> LABLINK ====================

  /**
   * Perform incremental synchronization using events.list with syncToken
   */
  static async performIncrementalSync(userId) {
    const tokens = tokenStore.getUserTokens(userId);
    if (!tokens) {
      throw new Error(`User '${userId}' has not connected Google Calendar`);
    }

    const calendar = await GoogleCalendarSyncService.getCalendarClient(userId);
    let syncToken = tokens.syncToken;
    let isFullSync = !syncToken;

    let items = [];
    let pageToken = null;
    let newSyncToken = null;

    try {
      do {
        const params = {
          calendarId: 'primary',
          singleEvents: true,
          pageToken
        };

        if (syncToken) {
          params.syncToken = syncToken;
        } else {
          // Initial sync window: 7 days ago to 60 days ahead
          const pastDate = new Date(Date.now() - 7 * 86400000).toISOString();
          const futureDate = new Date(Date.now() + 60 * 86400000).toISOString();
          params.timeMin = pastDate;
          params.timeMax = futureDate;
        }

        const res = await calendar.events.list(params);
        if (res.data?.items) {
          items.push(...res.data.items);
        }

        pageToken = res.data?.nextPageToken;
        if (res.data?.nextSyncToken) {
          newSyncToken = res.data.nextSyncToken;
        }
      } while (pageToken);

    } catch (err) {
      // Expired syncToken recovery (HTTP 410 Gone)
      if (err.code === 410 || (err.message && err.message.includes('410'))) {
        console.warn(`[GoogleCalendarSync] Expired syncToken for user ${userId}. Performing fresh full sync...`);
        tokenStore.updateSyncState(userId, { syncToken: null });
        return GoogleCalendarSyncService.performIncrementalSync(userId);
      }
      throw err;
    }

    // Process synchronized items
    const conflictsRecorded = [];
    const userBookings = store.getBookings().filter(b => b.studentId === userId && b.status === 'confirmed');

    for (const event of items) {
      // 1. External deletion of LabLink event
      if (event.status === 'cancelled') {
        const mapping = tokenStore.getEventMappingByGoogleId(event.id);
        if (mapping && mapping.status === 'synced') {
          const conflict = tokenStore.recordConflict({
            userId,
            bookingId: mapping.bookingId,
            type: 'external_booking_tamper',
            externalSummary: event.summary || mapping.lastKnownSummary,
            startTime: mapping.lastKnownStartTime,
            endTime: mapping.lastKnownEndTime,
            message: `Notice: Mapped Google Calendar event was removed externally. Your official LabLink lab reservation remains confirmed and active.`
          });
          conflictsRecorded.push(conflict);
        }
        continue;
      }

      // Check if this event was created by LabLink
      const isLabLinkEvent =
        event.extendedProperties?.private?.lablinkBookingId ||
        (event.summary && event.summary.startsWith('[LabLink]'));

      const eventStart = event.start?.dateTime || event.start?.date;
      const eventEnd = event.end?.dateTime || event.end?.date;

      if (!eventStart || !eventEnd) continue;

      if (isLabLinkEvent) {
        // Check for external time tampering
        const bookingId = event.extendedProperties?.private?.lablinkBookingId;
        const mappedBooking = bookingId
          ? store.getBookingById(bookingId)
          : userBookings.find(b => event.summary.includes(b.id));

        if (mappedBooking) {
          const bookingStartIso = new Date(mappedBooking.requestedStartTime).toISOString();
          const googleStartIso = new Date(eventStart).toISOString();

          // If external event time does not match official LabLink reservation:
          if (bookingStartIso !== googleStartIso) {
            const conflict = tokenStore.recordConflict({
              userId,
              bookingId: mappedBooking.id,
              type: 'external_booking_tamper',
              externalSummary: event.summary,
              startTime: googleStartIso,
              endTime: new Date(eventEnd).toISOString(),
              message: `Scheduling Discrepancy: Google Calendar event was moved to ${new Date(eventStart).toLocaleString()}, but approved LabLink slot remains at ${new Date(mappedBooking.requestedStartTime).toLocaleString()}. Submit a change request in LabLink if you need to reschedule.`
            });
            conflictsRecorded.push(conflict);
          }
        }
      } else {
        // External personal event (not created by LabLink):
        // Detect scheduling overlap with any confirmed lab booking
        const evStartMs = new Date(eventStart).getTime();
        const evEndMs = new Date(eventEnd).getTime();

        for (const booking of userBookings) {
          const bStartMs = new Date(booking.requestedStartTime).getTime();
          const bEndMs = new Date(booking.requestedEndTime).getTime();

          // Standard overlap check: (StartA < EndB) && (EndA > StartB)
          if (evStartMs < bEndMs && evEndMs > bStartMs) {
            const equipment = store.getEquipmentById(booking.equipmentId);
            const conflict = tokenStore.recordConflict({
              userId,
              bookingId: booking.id,
              type: 'schedule_overlap',
              externalSummary: event.summary || 'Personal Event',
              startTime: new Date(eventStart).toISOString(),
              endTime: new Date(eventEnd).toISOString(),
              message: `Calendar Conflict: External event "${event.summary || 'Personal Event'}" (${new Date(eventStart).toLocaleTimeString()} - ${new Date(eventEnd).toLocaleTimeString()}) overlaps with your confirmed reservation on ${equipment?.name || 'Laboratory Instrument'}.`
            });
            conflictsRecorded.push(conflict);
          }
        }
      }
    }

    // Save latest syncToken and timestamp
    tokenStore.updateSyncState(userId, {
      syncToken: newSyncToken || syncToken,
      lastSyncedAt: new Date().toISOString(),
      error: null
    });

    return {
      success: true,
      isFullSync,
      eventsProcessed: items.length,
      conflictsCount: conflictsRecorded.length,
      conflicts: conflictsRecorded,
      syncToken: newSyncToken || syncToken
    };
  }

  // ==================== PUSH NOTIFICATIONS / WEBHOOKS ====================

  /**
   * Setup push notification channel via calendar.events.watch
   */
  static async setupWatchChannel(userId, webhookUrl) {
    const calendar = await GoogleCalendarSyncService.getCalendarClient(userId);
    const channelId = `lablink-watch-${userId}-${Date.now()}`;
    const token = `token-${userId}-${Date.now()}`;

    try {
      const res = await calendar.events.watch({
        calendarId: 'primary',
        requestBody: {
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token
        }
      });

      const channel = tokenStore.saveWatchChannel(userId, {
        channelId: res.data?.id || channelId,
        resourceId: res.data?.resourceId,
        expiration: Number(res.data?.expiration) || (Date.now() + 7 * 86400000),
        token
      });

      return { success: true, channel };
    } catch (err) {
      console.warn(`[GoogleCalendarSync] Push notification setup notice for ${userId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Stop an active watch channel
   */
  static async stopWatchChannel(userId) {
    const channel = tokenStore.getWatchChannel(userId);
    if (!channel) return { success: true };

    try {
      const calendar = await GoogleCalendarSyncService.getCalendarClient(userId);
      await calendar.channels.stop({
        requestBody: {
          id: channel.channelId,
          resourceId: channel.resourceId
        }
      });
    } catch (err) {
      console.warn(`[GoogleCalendarSync] Channel stop notice for ${userId}:`, err.message);
    } finally {
      tokenStore.deleteWatchChannel(userId);
    }

    return { success: true };
  }
}
