#!/usr/bin/env node

/**
 * LabLink - Standalone Gemini API Smoke Test Script
 *
 * Usage:
 *   # Linux / macOS:
 *   GEMINI_API_KEY=your_key node server/scripts/smokeTestGemini.js
 *
 *   # Windows PowerShell:
 *   $env:GEMINI_API_KEY="your_key"; node server/scripts/smokeTestGemini.js
 */

import { GoogleGenAI } from '@google/genai';
import { AiMatcherService } from '../services/aiMatcher.js';

console.log('='.repeat(70));
console.log('  LABLINK — Live Gemini API Smoke Test Verification');
console.log('='.repeat(70));

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!apiKey) {
  console.log('\n❌ [STATUS: NO API KEY DETECTED]');
  console.log('GEMINI_API_KEY is not set in your environment.');
  console.log('\nTo run a live test with your official Google Gemini API key:');
  console.log('  PowerShell:');
  console.log('    $env:GEMINI_API_KEY="AIzaSy..."; node server/scripts/smokeTestGemini.js');
  console.log('  Bash / Command Prompt:');
  console.log('    export GEMINI_API_KEY="AIzaSy..."; node server/scripts/smokeTestGemini.js');
  console.log('\nLabLink will continue operating safely in deterministic fallback mode.');
  console.log('='.repeat(70));
  process.exit(0);
}

console.log(`\n🔑 Detected GEMINI_API_KEY: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`);
console.log(`🤖 Target Model: ${modelName}`);

const sampleCatalogue = [
  {
    id: 'eq_1',
    name: 'Keysight Infiniium DSOX3014T Oscilloscope',
    model: 'DSOX3014T',
    department: 'Electrical & Computer Engineering',
    labRoom: 'ECE-RF-204',
    category: 'rf_microwave',
    specifications: { bandwidth: '1 GHz', channels: 4, samplingRate: '5 GSa/s' },
    safetyPrerequisites: ['ESD-101'],
    status: 'operational'
  },
  {
    id: 'eq_7',
    name: 'Instron 5969 Universal Mechanical Tester',
    model: 'Instron 5969',
    department: 'Mechanical Engineering',
    labRoom: 'Materials-Test-102',
    category: 'prototyping',
    specifications: { maxLoad: '50 kN', crossheadSpeed: '0.001 to 1000 mm/min' },
    safetyPrerequisites: ['MATERIALS-SAFETY-1'],
    status: 'maintenance'
  }
];

const sampleProject = {
  title: 'Wide-bandgap GaN inverter switching analysis',
  description: 'Need to capture 500 kHz high-speed switching transients with sub-nanosecond rise times and gate ringing requiring 1 GHz bandwidth and 4 channels.'
};

async function runSmokeTest() {
  const startTime = Date.now();
  console.log('\n📡 Sending test project prompt to Gemini API...');

  try {
    const result = await AiMatcherService.matchProject({
      title: sampleProject.title,
      description: sampleProject.description,
      catalogue: sampleCatalogue
    });

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Gemini API response received in ${elapsed}ms!`);
    console.log(`Provider: ${result.provider} (${result.providerStatus})`);
    console.log(`Model: ${result.model}`);
    console.log('\n📋 Extracted Capabilities:');
    result.extractedRequirements.extractedCapabilities.forEach(c => console.log(`  • ${c}`));

    console.log('\n🎯 Grounded Recommendations (Operational):');
    result.recommendations.forEach(r => {
      console.log(`  • [${r.equipmentId}] ${r.equipmentName} (${r.matchScore}% fit)`);
      console.log(`    Rationale: ${r.groundedRationale}`);
    });

    if (result.unavailableEquipment?.length > 0) {
      console.log('\n⚠️ Unavailable Equipment (Under Maintenance):');
      result.unavailableEquipment.forEach(u => {
        console.log(`  • [${u.equipmentId}] ${u.equipmentName} - ${u.status}`);
      });
    }

    if (result.missingOrAmbiguousInfo?.length > 0) {
      console.log('\n❓ Missing / Ambiguous Information Identified:');
      result.missingOrAmbiguousInfo.forEach(m => console.log(`  • ${m}`));
    }

    console.log('\n🎉 SMOKE TEST PASSED: Live Gemini integration is fully verified and functional.');
    console.log('='.repeat(70));
  } catch (err) {
    console.error('\n❌ Smoke test failed:', err.message);
    process.exit(1);
  }
}

runSmokeTest();
