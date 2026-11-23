import express from 'express';
import { GoogleOAuthService } from '../services/googleOAuth.js';
import { GoogleCalendarSyncService } from '../services/googleCalendarSync.js';
import { tokenStore } from '../services/tokenStore.js';
import { store } from '../services/store.js';

const router = express.Router();

/**
 * Helper to resolve authenticated user identity
 * Checks header, cookie, query, or defaults safely
 */
function resolveUserId(req) {
  const fromHeader = req.headers['x-student-id'] || req.headers['x-user-id'];
  const fromCookie = req.cookies?.lablink_student_id;
  const fromQuery = req.query.studentId || req.query.userId;
  const fromBody = req.body?.studentId || req.body?.userId;

  const resolved = fromHeader || fromCookie || fromQuery || fromBody;
  if (resolved && typeof resolved === 'string') {
    return resolved.trim();
  }
  return null;
}

// GET /api/calendar/connect - Initiate Google OAuth 2.0 Authorization Code Flow
router.get('/connect', (req, res) => {
  try {
    const userId = resolveUserId(req) || 'std_1'; // Defaults to active student in demo environment
    const returnUrl = req.query.returnUrl || '/#calendar';

    const { authUrl, state } = GoogleOAuthService.generateConnectUrl(userId, returnUrl);

    // Set secure cookie with state for CSRF double-check
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('lablink_oauth_state', state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000 // 10 minutes
    });

    res.cookie('lablink_student_id', userId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 86400 * 1000
    });

    // If request asks for JSON redirect URL (e.g. AJAX / fetch)
    if (req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        data: {
          authUrl,
          state,
          userId
        }
      });
    }

    // Standard browser redirect
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calendar/oauth/callback - Handle OAuth redirect from Google
router.get('/oauth/callback', async (req, res) => {
  try {
    const { code, state, error: googleError } = req.query;

    if (googleError) {
      return res.status(400).send(`Google OAuth error: ${googleError}`);
    }

    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter in OAuth callback');
    }

    const stateCookie = req.cookies?.lablink_oauth_state;
    // Verify state match against cookie if cookie is available (CSRF defense)
    if (stateCookie && stateCookie !== state) {
      return res.status(403).send('OAuth state cookie mismatch. Potential CSRF attack detected.');
    }

    const result = await GoogleOAuthService.handleOAuthCallback(code, state);

    // Clear state cookie after successful verification
    res.clearCookie('lablink_oauth_state');

    // Automatically trigger initial background sync
    GoogleCalendarSyncService.performIncrementalSync(result.userId).catch(e => {
      console.warn('[Calendar Sync] Initial post-auth sync notice:', e.message);
    });

    // Redirect user to frontend with success query parameter
    const redirectTarget = result.returnUrl ? `${result.returnUrl}?calendar_connected=success` : '/#calendar?calendar_connected=success';
    res.redirect(redirectTarget);

  } catch (err) {
    console.error('[OAuth Callback Error]', err);
    res.status(err.statusCode || 500).send(`Authentication failed: ${err.message}`);
  }
});

// GET /api/calendar/status - Get current Google Calendar connection status for user
router.get('/status', (req, res) => {
  try {
    const userId = resolveUserId(req) || 'std_1';
    const status = tokenStore.getConnectionStatus(userId);
    const conflicts = tokenStore.getConflictsForUser(userId);
    const mappings = tokenStore.getAllMappingsForUser(userId);
    const config = GoogleOAuthService.getConfig();

    res.json({
      success: true,
      data: {
        userId,
        isConfigured: config.isConfigured,
        ...status,
        syncedReservationsCount: mappings.filter(m => m.status === 'synced').length,
        conflictsCount: conflicts.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calendar/disconnect - Disconnect and revoke Google Calendar tokens
router.post('/disconnect', async (req, res) => {
  try {
    const userId = resolveUserId(req) || 'std_1';
    const result = await GoogleOAuthService.disconnectUser(userId);

    res.json({
      success: true,
      message: result.message,
      data: { userId, connected: false }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calendar/sync - Manually trigger an incremental synchronization
router.post('/sync', async (req, res) => {
  try {
    const userId = resolveUserId(req) || 'std_1';
    const result = await GoogleCalendarSyncService.performIncrementalSync(userId);

    res.json({
      success: true,
      message: `Calendar sync completed: ${result.eventsProcessed} events checked, ${result.conflictsCount} conflicts identified.`,
      data: result
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// GET /api/calendar/conflicts - List external calendar conflicts and tampering notices
router.get('/conflicts', (req, res) => {
  try {
    const userId = resolveUserId(req) || 'std_1';
    const conflicts = tokenStore.getConflictsForUser(userId);

    res.json({
      success: true,
      count: conflicts.length,
      data: conflicts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calendar/conflicts/:id/resolve - Dismiss/resolve a conflict notice
router.post('/conflicts/:id/resolve', (req, res) => {
  try {
    const resolved = tokenStore.resolveConflict(req.params.id);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Conflict record not found' });
    }
    res.json({ success: true, message: 'Conflict marked as acknowledged' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/calendar/synced-events - List confirmed reservations synced to Google Calendar
router.get('/synced-events', (req, res) => {
  try {
    const userId = resolveUserId(req) || 'std_1';
    const mappings = tokenStore.getAllMappingsForUser(userId);

    // Enrich with equipment and booking details
    const enriched = mappings.map(m => {
      const booking = store.getBookingById(m.bookingId);
      const equipment = booking ? store.getEquipmentById(booking.equipmentId) : null;
      return {
        ...m,
        bookingStatus: booking?.status || 'unknown',
        equipmentName: equipment?.name || 'Lab Instrument',
        labRoom: equipment?.labRoom || 'Main Lab',
        startTime: booking?.requestedStartTime || m.lastKnownStartTime,
        endTime: booking?.requestedEndTime || m.lastKnownEndTime
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/calendar/webhook - Google Push Notifications Receiver
router.post('/webhook', async (req, res) => {
  try {
    const channelId = req.headers['x-goog-channel-id'];
    const resourceState = req.headers['x-goog-resource-state'];
    const channelToken = req.headers['x-goog-channel-token'];

    // Verify channel exists in our vault
    const channel = tokenStore.getWatchChannelByChannelId(channelId);
    if (!channel) {
      // Respond 200 so Google doesn't infinitely retry deleted channels
      return res.status(200).send('Channel not recognized, acknowledged');
    }

    if (resourceState === 'sync') {
      // Channel handshake
      return res.status(200).send('Handshake acknowledged');
    }

    // Trigger incremental sync for the channel's owner
    GoogleCalendarSyncService.performIncrementalSync(channel.userId).catch(e => {
      console.warn('[Calendar Webhook] Incremental sync trigger notice:', e.message);
    });

    res.status(200).send('Event update queued for processing');
  } catch (err) {
    res.status(200).send('Webhook acknowledged');
  }
});

export default router;
