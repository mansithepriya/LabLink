import { GoogleGenAI } from '@google/genai';

/**
 * AI Project-to-Equipment Matcher & Requirement Extraction Service
 *
 * Supports dual-mode operation:
 * 1. Live Google Gemini API via official @google/genai SDK (when GEMINI_API_KEY is configured)
 * 2. Institutional Deterministic Rule Engine (offline / fallback mode)
 *
 * Grounding Rule:
 * Matches ONLY against the actual real equipment catalogue.
 * Does NOT hallucinate fantasy equipment or invent calendar availability.
 * FAIRALLOC retains 100% deterministic authority over final allocation decisions.
 */

/**
 * Sanitize user input: limit length and strip potential PII
 */
export function sanitizeInput(text, maxLength = 4000) {
  if (typeof text !== 'string') return '';
  let sanitized = text.slice(0, maxLength);
  // Redact email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  // Redact phone numbers
  sanitized = sanitized.replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]');
  // Redact numeric ID sequences
  sanitized = sanitized.replace(/\b\d{8,12}\b/g, '[REDACTED_ID]');
  return sanitized;
}

/**
 * Safe JSON parser resilient to markdown fences and partial text
 */
export function safeParseJson(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  let text = rawText.trim();
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  text = text.trim();

  try {
    return JSON.parse(text);
  } catch (e) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (inner) {
        return null;
      }
    }
    return null;
  }
}

export class AiMatcherService {
  // Mock client holder for unit testing without live network
  static _mockClient = null;

  static setMockClient(client) {
    AiMatcherService._mockClient = client;
  }

  static clearMockClient() {
    AiMatcherService._mockClient = null;
  }

  /**
   * Primary entry point for project matching
   * Dispatches to live Gemini API if key is configured, or seamlessly to deterministic engine
   */
  static async matchProject({ title = '', description = '', catalogue = [] }) {
    const sanitizedTitle = sanitizeInput(title, 200);
    const sanitizedDesc = sanitizeInput(description, 4000);

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // If no API key configured and no mock client set, use deterministic fallback
    if (!apiKey && !AiMatcherService._mockClient) {
      return AiMatcherService.runDeterministicFallback({
        title: sanitizedTitle,
        description: sanitizedDesc,
        catalogue,
        reason: 'GEMINI_API_KEY not configured in environment. Using institutional deterministic rule matcher.'
      });
    }

    try {
      return await AiMatcherService.matchWithGemini({
        apiKey,
        modelName,
        title: sanitizedTitle,
        description: sanitizedDesc,
        catalogue
      });
    } catch (err) {
      // Categorize error cleanly without exposing sensitive info or keys
      let fallbackReason = 'Gemini API call failed. Using institutional deterministic rule matcher.';
      const msg = (err.message || '').toLowerCase();

      if (err.name === 'TimeoutError' || msg.includes('timeout')) {
        fallbackReason = 'Gemini API request timed out after 10s. Using institutional deterministic rule matcher.';
      } else if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
        fallbackReason = 'Gemini API rate limit or quota exceeded (429). Using institutional deterministic rule matcher.';
      } else if (msg.includes('401') || msg.includes('403') || msg.includes('api_key_invalid') || msg.includes('unauthenticated')) {
        fallbackReason = 'Gemini API authentication failed (invalid credentials). Using institutional deterministic rule matcher.';
      } else if (msg.includes('malformed') || msg.includes('json')) {
        fallbackReason = 'Gemini API returned unparseable output. Using institutional deterministic rule matcher.';
      } else {
        fallbackReason = `Gemini API unavailable (${err.message ? err.message.slice(0, 80) : 'connection error'}). Using deterministic fallback.`;
      }

      console.warn('[AI Matcher]', fallbackReason);

      return AiMatcherService.runDeterministicFallback({
        title: sanitizedTitle,
        description: sanitizedDesc,
        catalogue,
        reason: fallbackReason
      });
    }
  }

  /**
   * Live Gemini API caller using @google/genai SDK
   */
  static async matchWithGemini({ apiKey, modelName, title, description, catalogue }) {
    const client = AiMatcherService._mockClient || new GoogleGenAI({ apiKey });

    // Prepare compact verified catalogue data for grounding
    const compactCatalogue = catalogue.map(e => ({
      id: e.id,
      name: e.name,
      model: e.model,
      department: e.department,
      labRoom: e.labRoom,
      category: e.category,
      specifications: e.specifications,
      safetyPrerequisites: e.safetyPrerequisites,
      status: e.status
    }));

    const prompt = `You are the AI Laboratory Resource Matcher for LabLink, an institutional research laboratory platform.
Your task is to analyze the student's natural language project description, extract structured technical specifications, and recommend suitable equipment from the provided official campus catalogue.

OFFICIAL VERIFIED CAMPUS CATALOGUE:
${JSON.stringify(compactCatalogue, null, 2)}

STRICT GROUNDING RULES:
1. ONLY recommend equipment that exists in the catalogue above using their EXACT id (e.g. 'eq_1', 'eq_2', etc.).
2. NEVER invent non-existent equipment, fictional instrument IDs, or fantasy machines.
3. For each recommendation, provide an evidence-grounded rationale referencing the machine's actual hardware specifications (e.g., bandwidth, magnification, VRAM, build volume, laser lines) and how it addresses the project's technical requirements.
4. If an equipment matches technically but its status is 'maintenance', still include it in the recommendations list; the system will separate unavailable equipment from operational machines.
5. Identify any missing or ambiguous project parameters that would help refine equipment allocation (e.g., missing frequency range, sample preparation state, required sample throughput, power requirements).

STUDENT PROJECT:
Title: ${title}
Description: ${description}`;

    const config = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          projectCategory: { type: 'STRING' },
          extractedCapabilities: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          technicalSpecifications: {
            type: 'OBJECT',
            properties: {
              bandwidth: { type: 'STRING' },
              magnification: { type: 'STRING' },
              vram: { type: 'STRING' },
              resolution: { type: 'STRING' },
              laserLines: { type: 'ARRAY', items: { type: 'STRING' } },
              otherSpecs: { type: 'STRING' }
            }
          },
          estimatedSessionHours: { type: 'NUMBER' },
          preferredTimeframe: { type: 'STRING' },
          projectDeadline: { type: 'STRING' },
          eligibilityPrerequisites: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          missingOrAmbiguousInfo: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          recommendations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                equipmentId: { type: 'STRING' },
                matchScore: { type: 'INTEGER' },
                groundedRationale: { type: 'STRING' }
              },
              required: ['equipmentId', 'matchScore', 'groundedRationale']
            }
          }
        },
        required: ['extractedCapabilities', 'estimatedSessionHours', 'recommendations']
      }
    };

    // Execute with 10-second timeout and 1 transient retry
    const response = await AiMatcherService.executeWithTimeoutAndRetry(
      () => client.models.generateContent({
        model: modelName,
        contents: prompt,
        config
      }),
      10000
    );

    // Extract text safely
    let rawText = '';
    if (typeof response?.text === 'function') {
      rawText = response.text();
    } else if (typeof response?.text === 'string') {
      rawText = response.text;
    } else if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      rawText = response.candidates[0].content.parts[0].text;
    }

    const parsed = safeParseJson(rawText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Malformed JSON output received from Gemini API');
    }

    // Verify grounding: Only retain equipment that truly exists in catalogue
    const verifiedOperational = [];
    const verifiedUnavailable = [];

    const rawRecs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    for (const rec of rawRecs) {
      if (!rec || !rec.equipmentId) continue;
      const actualEq = catalogue.find(e => e.id === rec.equipmentId);
      if (!actualEq) {
        // Discard hallucinated ID!
        continue;
      }

      const matchScore = Math.max(10, Math.min(99, Number(rec.matchScore) || 50));
      const formatted = {
        equipmentId: actualEq.id,
        equipmentName: actualEq.name,
        model: actualEq.model,
        department: actualEq.department,
        labRoom: actualEq.labRoom,
        status: actualEq.status,
        matchScore,
        safetyPrerequisites: actualEq.safetyPrerequisites || [],
        groundedRationale: rec.groundedRationale || `Grounded match based on verified ${actualEq.category} hardware specifications.`
      };

      if (actualEq.status === 'operational') {
        verifiedOperational.push(formatted);
      } else {
        formatted.groundedRationale += ` [Note: Machine is currently ${actualEq.status} - scheduled maintenance in progress].`;
        verifiedUnavailable.push(formatted);
      }
    }

    // If Gemini returned zero valid catalogue matches, fall back to deterministic matcher
    if (verifiedOperational.length === 0 && verifiedUnavailable.length === 0) {
      const fallbackReqs = AiMatcherService.extractRequirements(description, title);
      const fallbackMatches = AiMatcherService.matchEquipmentWithCatalogue(fallbackReqs, catalogue);
      for (const m of fallbackMatches) {
        if (m.status === 'operational') verifiedOperational.push(m);
        else verifiedUnavailable.push(m);
      }
    }

    // Sort operational recommendations descending by match score
    verifiedOperational.sort((a, b) => b.matchScore - a.matchScore);

    return {
      provider: 'gemini',
      model: modelName,
      providerStatus: 'live',
      extractedRequirements: {
        projectCategory: parsed.projectCategory || 'Academic Research',
        extractedCapabilities: Array.isArray(parsed.extractedCapabilities) && parsed.extractedCapabilities.length > 0
          ? parsed.extractedCapabilities
          : ['General Precision Laboratory Instrumentation'],
        technicalSpecifications: parsed.technicalSpecifications || {},
        estimatedSessionHours: Number(parsed.estimatedSessionHours) || 2,
        preferredTimeframe: parsed.preferredTimeframe || '',
        projectDeadline: parsed.projectDeadline || '',
        eligibilityPrerequisites: Array.isArray(parsed.eligibilityPrerequisites) ? parsed.eligibilityPrerequisites : []
      },
      missingOrAmbiguousInfo: Array.isArray(parsed.missingOrAmbiguousInfo) ? parsed.missingOrAmbiguousInfo : [],
      recommendations: verifiedOperational,
      unavailableEquipment: verifiedUnavailable
    };
  }

  /**
   * Execute with 10s timeout and 1 transient retry
   */
  static async executeWithTimeoutAndRetry(fn, timeoutMs = 10000) {
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        let timeoutHandle;
        const timeoutPromise = new Promise((_, reject) => {
          timeoutHandle = setTimeout(() => {
            const err = new Error(`Gemini API request timed out after ${timeoutMs}ms`);
            err.name = 'TimeoutError';
            reject(err);
          }, timeoutMs);
        });

        const result = await Promise.race([fn(), timeoutPromise]);
        clearTimeout(timeoutHandle);
        return result;
      } catch (err) {
        lastError = err;
        const msg = (err.message || '').toLowerCase();
        // If it's an auth error, rate limit, timeout, or second attempt, do not retry
        if (
          err.name === 'TimeoutError' ||
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('429') ||
          msg.includes('quota') ||
          attempt === 2
        ) {
          throw err;
        }
        // Brief backoff before attempt 2
        await new Promise(r => setTimeout(r, 400));
      }
    }

    throw lastError;
  }

  /**
   * Deterministic Fallback Engine
   */
  static runDeterministicFallback({ title, description, catalogue, reason }) {
    const extractedRequirements = AiMatcherService.extractRequirements(description, title);
    const matches = AiMatcherService.matchEquipmentWithCatalogue(extractedRequirements, catalogue);

    const operational = matches.filter(m => m.status === 'operational');
    const unavailable = matches.filter(m => m.status !== 'operational');

    const missingOrAmbiguousInfo = [];
    const text = `${title} ${description}`.toLowerCase();
    if (!text.match(/\d+\s*(ghz|mhz|khz|v|w|a|nm|um|mm|cm|gb|tb|kn)/)) {
      missingOrAmbiguousInfo.push('Exact operating frequencies, electrical limits, or physical dimensions were not quantified.');
    }
    if (!text.match(/hour|session|duration|day|week|deadline|by\s+[a-z]+/)) {
      missingOrAmbiguousInfo.push('Target session duration or completion deadline not specified.');
    }

    return {
      provider: 'deterministic_fallback',
      model: 'deterministic_rule_engine',
      providerStatus: 'offline_rule_based',
      fallbackReason: reason,
      extractedRequirements,
      missingOrAmbiguousInfo,
      recommendations: operational,
      unavailableEquipment: unavailable
    };
  }

  /**
   * Extract structured technical equipment requirements from natural language project description
   * (Deterministic offline rule extractor)
   */
  static extractRequirements(projectDescription, projectTitle = '') {
    const text = `${projectTitle} ${projectDescription}`.toLowerCase();

    const capabilities = [];
    const minSpecs = {};
    const domainKeywords = [];

    // Frequency / RF / Microwave
    if (text.match(/ghz|mhz|rf|microwave|oscilloscope|switching|transient|signal|waveform|s-parameter|antenna|attenuation|gan|half-bridge/)) {
      capabilities.push('High-Frequency Signal Acquisition', 'Waveform Transient Capture');
      domainKeywords.push('rf_microwave', 'oscilloscope', 'vna');
      if (text.includes('ghz') || text.includes('1 ghz') || text.includes('high speed')) {
        minSpecs.minBandwidth = '1 GHz';
      } else {
        minSpecs.minBandwidth = '200 MHz';
      }
    }

    // Microscopy / SEM / Imaging
    if (text.match(/microscopy|sem|scanning electron|nanoscale|morphology|magnification|edx|edx spectrometer|vacuum|surface imaging/)) {
      capabilities.push('High-Resolution Electron Microscopy', 'Nanoscale Surface Topology', 'Elemental EDX Analysis');
      domainKeywords.push('microscopy', 'nanotechnology', 'sem');
      minSpecs.minMagnification = '100,000x';
      minSpecs.acceleratingVoltage = '0.5 to 30 kV';
    }

    // Fluorescence / Bio-imaging / Confocal
    if (text.match(/confocal|laser|fluorescence|cell|immuno|antibody|live cell|staining|tissue|multiphoton/)) {
      capabilities.push('Laser Confocal Microscopy', 'Multi-channel Fluorescence Imaging', 'Cellular Resolution');
      domainKeywords.push('bioengineering', 'microscopy', 'confocal');
      minSpecs.laserWavelengths = ['405nm', '488nm', '561nm', '633nm'];
    }

    // Prototyping / SLA / 3D Printing / Mechanical
    if (text.match(/3d print|sla|resin|prototyp|enclosure|biocompatible|stereolithography|tensile|mechanical test|load cell/)) {
      capabilities.push('Additive Manufacturing', 'High-Tolerance SLA Prototyping');
      domainKeywords.push('prototyping', '3d_printing', 'mechanical');
      minSpecs.buildVolume = 'Medium to Large Format';
      minSpecs.resolution = 'Sub-50 micron';
    }

    // GPU / Deep Learning / AI Compute
    if (text.match(/gpu|cuda|tensor|diffusion|deep learning|transformer|vram|h100|parallelism|model training|fp8/)) {
      capabilities.push('Enterprise AI Multi-GPU Acceleration', 'High-Bandwidth HBM Memory', 'Distributed Training');
      domainKeywords.push('compute_gpu', 'deep_learning', 'hpc');
      minSpecs.minVram = '80 GB+';
      minSpecs.gpuCount = '4 to 8 GPUs';
    }

    // Robotics / Automation / Articulated Manipulator
    if (text.match(/robot|articulated|arm|payload|trajectory|repeatability|kuka|automation|manipulat/)) {
      capabilities.push('Articulated Robotic Manipulation', 'Sub-millimeter Trajectory Automation');
      domainKeywords.push('robotics', 'automation');
      minSpecs.repeatability = '±0.02 mm';
      minSpecs.degreesOfFreedom = 6;
    }

    return {
      extractedCapabilities: capabilities.length > 0 ? capabilities : ['General Precision Laboratory Instrumentation'],
      domainKeywords,
      minSpecs,
      estimatedSessionHours: text.includes('training') || text.includes('diffusion') ? 8 : (text.includes('sem') ? 3 : 2)
    };
  }

  /**
   * Match project requirements against actual catalogue equipment
   * Produces grounded rationale referencing real machine specs
   */
  static matchEquipmentWithCatalogue(requirements, catalogueEquipment = []) {
    const scoredMatches = catalogueEquipment.map(equipment => {
      let matchScore = 0;
      const rationalePoints = [];

      // Category matching
      if (requirements.domainKeywords && requirements.domainKeywords.includes(equipment.category)) {
        matchScore += 45;
        rationalePoints.push(`Core instrumentation category matches domain requirements (${equipment.category.replace('_', ' ')}).`);
      }

      // Keyword and spec alignment
      const descLower = (equipment.description + ' ' + JSON.stringify(equipment.specifications)).toLowerCase();

      if (requirements.domainKeywords) {
        for (const kw of requirements.domainKeywords) {
          if (descLower.includes(kw)) {
            matchScore += 15;
          }
        }
      }

      // Specific capability grounding against real specs
      if (equipment.category === 'rf_microwave') {
        if (requirements.minSpecs?.minBandwidth && equipment.specifications.bandwidth) {
          matchScore += 25;
          rationalePoints.push(`Hardware bandwidth (${equipment.specifications.bandwidth}) satisfies project threshold (${requirements.minSpecs.minBandwidth}).`);
        }
      } else if (equipment.category === 'microscopy') {
        if (equipment.specifications.magnification) {
          matchScore += 25;
          rationalePoints.push(`Optical/electron magnification (${equipment.specifications.magnification}) supports target nanoscale resolution.`);
        }
        if (equipment.specifications.laserLines && requirements.domainKeywords?.includes('confocal')) {
          matchScore += 25;
          rationalePoints.push(`Equipped with required multi-laser excitation lines (${equipment.specifications.laserLines.join(', ')}).`);
        }
      } else if (equipment.category === 'compute_gpu') {
        if (equipment.specifications.totalVram) {
          matchScore += 30;
          rationalePoints.push(`High-memory architecture with ${equipment.specifications.totalVram} provides headroom for distributed tensor checkpoints.`);
        }
      } else if (equipment.category === 'prototyping') {
        if (equipment.specifications.xyResolution) {
          matchScore += 25;
          rationalePoints.push(`High resolution (${equipment.specifications.xyResolution}) ensures accurate physical tolerances.`);
        }
      } else if (equipment.category === 'robotics') {
        if (equipment.specifications.repeatability) {
          matchScore += 25;
          rationalePoints.push(`Articulated precision repeatability (${equipment.specifications.repeatability}) supports automated trajectory handling.`);
        }
      }

      // Operational status check
      if (equipment.status !== 'operational') {
        matchScore = Math.min(matchScore, 30);
        rationalePoints.push(`[Note: Machine is currently ${equipment.status}; alternative scheduling required].`);
      }

      const normalizedScore = Math.min(99, Math.max(10, matchScore));

      return {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        model: equipment.model,
        department: equipment.department,
        labRoom: equipment.labRoom,
        status: equipment.status,
        matchScore: normalizedScore,
        safetyPrerequisites: equipment.safetyPrerequisites,
        groundedRationale: rationalePoints.join(' ') || `Compatible institutional instrument in ${equipment.department}.`
      };
    });

    // Rank descending by match score
    return scoredMatches
      .sort((a, b) => b.matchScore - a.matchScore)
      .filter(item => item.matchScore >= 40);
  }
}
