import express from 'express';
import { AiMatcherService } from '../services/aiMatcher.js';
import { store } from '../services/store.js';

const router = express.Router();

// GET /api/ai/status - Report current AI engine configuration and live status
router.get('/status', (req, res) => {
  const isConfigured = Boolean(process.env.GEMINI_API_KEY);
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  res.json({
    success: true,
    data: {
      provider: isConfigured ? 'gemini' : 'deterministic_fallback',
      model: isConfigured ? model : 'deterministic_rule_engine',
      providerStatus: isConfigured ? 'live' : 'offline_rule_based',
      isConfigured,
      description: isConfigured
        ? `Configured with Google Gemini API (${model}) with strict catalogue grounding.`
        : 'Running in offline mode using institutional deterministic rule extractor.'
    }
  });
});

// POST /api/ai/match - Extract requirements and match against verified campus inventory
router.post('/match', async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Project description must be at least 5 characters long.'
      });
    }

    const catalogue = store.getEquipment();
    const result = await AiMatcherService.matchProject({
      title: title || '',
      description,
      catalogue
    });

    res.json({
      success: true,
      data: {
        provider: result.provider,
        model: result.model,
        providerStatus: result.providerStatus,
        fallbackReason: result.fallbackReason || null,
        extractedRequirements: result.extractedRequirements,
        missingOrAmbiguousInfo: result.missingOrAmbiguousInfo || [],
        matchedCount: result.recommendations.length,
        recommendations: result.recommendations,
        unavailableEquipment: result.unavailableEquipment || [],
        note: result.provider === 'gemini'
          ? 'Extracted via Google Gemini Flash with strict institutional catalogue grounding. Allocation availability is governed by FAIRALLOC.'
          : 'Extracted via Institutional Deterministic Rule Engine. Allocation availability is governed by FAIRALLOC.'
      }
    });
  } catch (err) {
    console.error('[AI Route Error]', err.message);
    res.status(500).json({ success: false, error: 'Internal AI processing error.' });
  }
});

export default router;
