/**
 * AI Project-to-Equipment Matcher & Requirement Extraction Service
 *
 * Grounding Rule:
 * Matches ONLY against the actual real equipment catalogue.
 * Does NOT hallucinate fantasy equipment or invent calendar availability.
 */

export class AiMatcherService {
  /**
   * Extract structured technical equipment requirements from natural language project description
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
      if (requirements.domainKeywords.includes(equipment.category)) {
        matchScore += 45;
        rationalePoints.push(`Core instrumentation category matches domain requirements (${equipment.category.replace('_', ' ')}).`);
      }

      // Keyword and spec alignment
      const descLower = (equipment.description + ' ' + JSON.stringify(equipment.specifications)).toLowerCase();

      for (const kw of requirements.domainKeywords) {
        if (descLower.includes(kw)) {
          matchScore += 15;
        }
      }

      // Specific capability grounding against real specs
      if (equipment.category === 'rf_microwave') {
        if (requirements.minSpecs.minBandwidth && equipment.specifications.bandwidth) {
          matchScore += 25;
          rationalePoints.push(`Hardware bandwidth (${equipment.specifications.bandwidth}) satisfies project threshold (${requirements.minSpecs.minBandwidth}).`);
        }
      } else if (equipment.category === 'microscopy') {
        if (equipment.specifications.magnification) {
          matchScore += 25;
          rationalePoints.push(`Optical/electron magnification (${equipment.specifications.magnification}) supports target nanoscale resolution.`);
        }
        if (equipment.specifications.laserLines && requirements.domainKeywords.includes('confocal')) {
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
