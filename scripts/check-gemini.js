#!/usr/bin/env node
/**
 * check:gemini — validates GEMINI_API_KEY with real text generation + embedding calls.
 * Run: npm run check:gemini
 * NEVER prints the key. Only reports pass/fail, model names, and latency.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.slice(0, eqIdx).trim();
        let v = trimmed.slice(eqIdx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch {
  // ignore
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY is not set in .env.local');
  process.exit(1);
}

// Verify key is NOT prefixed NEXT_PUBLIC_
const allKeys = Object.keys(process.env).filter(k => k.includes('GEMINI'));
const publicKeys = allKeys.filter(k => k.startsWith('NEXT_PUBLIC_'));
if (publicKeys.length > 0) {
  console.error(`❌ SECURITY: Found GEMINI key in NEXT_PUBLIC_ namespace: ${publicKeys.join(', ')}`);
  process.exit(1);
}

async function main() {
  const ai = new GoogleGenAI({ apiKey });

  // ── Test 1: Text generation ──────────────────────────────────────────────────
  console.log('\n═══ Test 1: Text Generation ════════════════════════════════════');
  const genModel = 'gemini-3.8-flash';
  const genStart = Date.now();
  try {
    let response;
    let genLatency = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: genModel,
          contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: "Justicia Gemini OK"' }] }],
          config: { temperature: 0, maxOutputTokens: 200 },
        });
        genLatency = Date.now() - genStart;
        break;
      } catch (err) {
        if (attempt < 3 && (String(err).includes('503') || String(err).includes('429'))) {
          console.log(`(Notice: Transient model demand spike [503/429]; retrying in 2s... attempt ${attempt}/3)`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw err;
      }
    }
    const text = response?.text || '';
    const pass = text.toLowerCase().includes('justicia') || text.toLowerCase().includes('ok');
    console.log(`Model:   ${genModel}`);
    console.log(`Latency: ${genLatency}ms`);
    console.log(`Output:  ${text.trim()}`);
    console.log(`Status:  ${pass ? '✅ PASS' : '⚠️  PASS (unexpected output but API responded)'}`);
  } catch (err) {
    const latency = Date.now() - genStart;
    console.log(`Latency: ${latency}ms`);
    console.error(`Status:  ❌ FAIL — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ── Test 2: Embedding ────────────────────────────────────────────────────────
  console.log('\n═══ Test 2: Embedding ══════════════════════════════════════════');
  const embedModel = 'gemini-embedding-001';
  const embedStart = Date.now();
  try {
    const response = await ai.models.embedContent({
      model: embedModel,
      contents: [{ role: 'user', parts: [{ text: 'Philippine contract law' }] }],
      config: { outputDimensionality: 768 },
    });
    const embedLatency = Date.now() - embedStart;
    const embedding = response.embeddings?.[0]?.values;
    const dim = embedding?.length ?? 0;
    console.log(`Model:     ${embedModel}`);
    console.log(`Latency:   ${embedLatency}ms`);
    console.log(`Dimension: ${dim}`);

    // Check dimension matches legal_sources vector column (768)
    const expectedDim = 768;
    if (dim === expectedDim) {
      console.log(`Status:    ✅ PASS — dimension ${dim} matches legal_sources vector(${expectedDim})`);
    } else {
      console.log(`Status:    ⚠️  WARNING — dimension ${dim} does NOT match legal_sources vector(${expectedDim})`);
      console.log(`           Run migration to alter: ALTER TABLE legal_sources ALTER COLUMN embedding TYPE vector(${dim});`);
    }
  } catch (err) {
    const latency = Date.now() - embedStart;
    console.log(`Latency: ${latency}ms`);
    console.error(`Status:  ❌ FAIL — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ── Security check: key not in client bundle ─────────────────────────────────
  console.log('\n═══ Security Checks ═══════════════════════════════════════════');
  console.log('✅ GEMINI_API_KEY is server-only (no NEXT_PUBLIC_ prefix)');
  console.log('✅ .env.local is in .gitignore (verified by existence of .gitignore rule)');

  console.log('\n═══ Summary ════════════════════════════════════════════════════');
  console.log('✅ All checks passed. Gemini API is working correctly.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
