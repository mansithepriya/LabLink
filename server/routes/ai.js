import express from 'express';
import { AiMatcherService } from '../services/aiMatcher.js';
import { store } from '../services/store.js';

const router = express.Router();

// POST /api/ai/match - Extract requirements and match against real catalogue
router.post('/match', (req, res) => {
  try {
    const { title, description } = req.body;

    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: Project description must be at least 5 characters long.'
      });
    }

    const extractedRequirements = AiMatcherService.extractRequirements(description, title || '');
    const catalogue = store.getEquipment();
    const matches = AiMatcherService.matchEquipmentWithCatalogue(extractedRequirements, catalogue);

    res.json({
      success: true,
      data: {
        extractedRequirements,
        matchedCount: matches.length,
        recommendations: matches,
        note: 'AI matched against real verified laboratory inventory. Allocation availability is governed by FAIRALLOC.'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
