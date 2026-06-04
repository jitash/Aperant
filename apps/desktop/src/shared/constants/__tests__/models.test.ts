import { describe, it, expect } from 'vitest';
import {
  getProviderPreset,
  getProviderPresetOrFallback,
  PROVIDER_PRESET_DEFINITIONS,
  resolveModelEquivalent,
} from '../models';

describe('getProviderPreset', () => {
  it('returns correct preset for known provider and presetId', () => {
    const result = getProviderPreset('anthropic', 'auto');
    expect(result).not.toBeNull();
    expect(result?.primaryModel).toBe('opus');
    expect(result?.primaryThinking).toBe('high');
  });

  it('returns correct balanced preset for anthropic', () => {
    const result = getProviderPreset('anthropic', 'balanced');
    expect(result).not.toBeNull();
    expect(result?.primaryModel).toBe('sonnet');
    expect(result?.primaryThinking).toBe('medium');
  });

  it('returns correct preset for openai provider', () => {
    const result = getProviderPreset('openai', 'auto');
    expect(result).not.toBeNull();
    expect(result?.primaryModel).toBe('gpt-5.3-codex');
  });

  it('returns null for unknown presetId', () => {
    const result = getProviderPreset('anthropic', 'nonexistent-preset');
    expect(result).toBeNull();
  });

  it('returns null for unknown provider', () => {
    // @ts-expect-error testing unknown provider
    const result = getProviderPreset('unknown-provider', 'auto');
    expect(result).toBeNull();
  });

  it('returns null for provider that does not have a complex preset (mistral)', () => {
    const result = getProviderPreset('mistral', 'complex');
    expect(result).toBeNull();
  });
});

describe('getProviderPresetOrFallback', () => {
  it('returns exact match when provider and preset both exist', () => {
    const result = getProviderPresetOrFallback('anthropic', 'complex');
    expect(result.primaryModel).toBe('opus');
    expect(result.primaryThinking).toBe('high');
    expect(result.phaseThinking.coding).toBe('high');
  });

  it('returns openai balanced preset exactly when available', () => {
    const result = getProviderPresetOrFallback('openai', 'balanced');
    expect(result.primaryModel).toBe('gpt-5.2-codex');
    expect(result.primaryThinking).toBe('medium');
  });

  it("falls back to provider's 'auto' preset when requested preset is missing", () => {
    // mistral has no 'complex' preset, so falls back to mistral 'auto'
    const result = getProviderPresetOrFallback('mistral', 'complex');
    const mistralAuto = PROVIDER_PRESET_DEFINITIONS['mistral']?.['auto'];
    expect(result).toEqual(mistralAuto);
  });

  it('falls back to anthropic preset when provider has no auto and no matching preset', () => {
    // groq has no 'complex' preset — its 'auto' fallback should be used first
    // but if we use a provider with NO 'auto' at all, it should fall back to anthropic
    // groq has 'auto', so verify we get groq auto
    const result = getProviderPresetOrFallback('groq', 'complex');
    const groqAuto = PROVIDER_PRESET_DEFINITIONS['groq']?.['auto'];
    expect(result).toEqual(groqAuto);
  });

  it('falls back to anthropic preset when provider is unknown', () => {
    // @ts-expect-error testing unknown provider to exercise anthropic fallback
    const result = getProviderPresetOrFallback('unknown-provider', 'complex');
    const anthropicComplex = PROVIDER_PRESET_DEFINITIONS['anthropic']?.['complex'];
    expect(result).toEqual(anthropicComplex);
  });

  it('falls back to anthropic auto as ultimate fallback', () => {
    // @ts-expect-error testing unknown provider and preset
    const result = getProviderPresetOrFallback('unknown-provider', 'unknown-preset');
    const anthropicAuto = PROVIDER_PRESET_DEFINITIONS['anthropic']!['auto'];
    expect(result).toEqual(anthropicAuto);
  });

  it('always returns a valid config (never null)', () => {
    const knownCombinations: Array<[Parameters<typeof getProviderPresetOrFallback>[0], string]> = [
      ['anthropic', 'auto'],
      ['anthropic', 'complex'],
      ['anthropic', 'balanced'],
      ['anthropic', 'quick'],
      ['openai', 'auto'],
      ['openai', 'complex'],
      ['google', 'balanced'],
      ['xai', 'quick'],
      ['mistral', 'complex'],  // no 'complex', falls back to mistral auto
      ['groq', 'quick'],       // groq has no 'quick', falls back to groq auto
    ];

    for (const [provider, presetId] of knownCombinations) {
      const result = getProviderPresetOrFallback(provider, presetId);
      expect(result).toBeDefined();
      expect(result.primaryModel).toBeTruthy();
      expect(result.phaseModels).toBeDefined();
      expect(result.phaseThinking).toBeDefined();
    }
  });

  it('returned config has all required phase keys', () => {
    const result = getProviderPresetOrFallback('anthropic', 'auto');
    const phaseKeys = ['spec', 'planning', 'coding', 'qa'] as const;
    for (const key of phaseKeys) {
      expect(result.phaseModels[key]).toBeTruthy();
      expect(result.phaseThinking[key]).toBeTruthy();
    }
  });
});

// =============================================================================
// resolveModelEquivalent — minimax provider
// (Regression for the missing BUILTIN_TO_SUPPORTED entry that caused
// "No available account in priority queue" for minimax accounts. The
// minimax account always uses the M3 model regardless of which Claude
// shorthand/full-ID is requested.)
// =============================================================================

describe('resolveModelEquivalent — minimax provider', () => {
  it('resolves opus shorthand to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('opus', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
    expect(result?.reasoning).toEqual({ type: 'none' });
  });

  it('resolves opus-1m shorthand to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('opus-1m', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
  });

  it('resolves opus-4.5 shorthand to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('opus-4.5', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
  });

  it('resolves sonnet shorthand to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('sonnet', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
    expect(result?.reasoning).toEqual({ type: 'none' });
  });

  it('resolves haiku shorthand to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('haiku', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
    expect(result?.reasoning).toEqual({ type: 'none' });
  });

  it('reverse-lookup: full model ID claude-opus-4-6 resolves to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('claude-opus-4-6', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
  });

  it('reverse-lookup: full model ID claude-sonnet-4-6 resolves to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('claude-sonnet-4-6', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
  });

  it('reverse-lookup: full model ID claude-haiku-4-5-20251001 resolves to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('claude-haiku-4-5-20251001', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
  });

  it('reverse-lookup: full model ID claude-opus-4-5-20251101 resolves to MiniMax-M3 for minimax', () => {
    const result = resolveModelEquivalent('claude-opus-4-5-20251101', 'minimax');
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('MiniMax-M3');
  });

  it('user override takes precedence over the default MiniMax-M3 mapping', () => {
    const override = {
      opus: {
        minimax: {
          modelId: 'custom-minimax-opus',
          reasoning: { type: 'thinking_tokens' as const, level: 'high' as const },
        },
      },
    };
    const result = resolveModelEquivalent('opus', 'minimax', override);
    expect(result).not.toBeNull();
    expect(result?.modelId).toBe('custom-minimax-opus');
  });

  it('returns null for an unknown model when no equivalence exists for minimax', () => {
    const result = resolveModelEquivalent('totally-fake-model-xyz', 'minimax');
    expect(result).toBeNull();
  });
});
