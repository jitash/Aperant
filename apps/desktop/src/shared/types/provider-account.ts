import type { ClaudeUsageData, ClaudeRateLimitEvent } from './agent';

/** How a credential was resolved — shown in UI for transparency */
export type CredentialSource = 'oauth' | 'api-key' | 'env' | 'keychain';

/** Supported built-in providers (matches @ai-sdk/* packages) */
export type BuiltinProvider =
  | 'anthropic' | 'openai' | 'google' | 'amazon-bedrock' | 'azure'
  | 'mistral' | 'groq' | 'xai' | 'openrouter' | 'zai'
  | 'local-cli'
  | 'ollama' | 'openai-compatible';

export type BillingModel = 'subscription' | 'pay-per-use';

/** A user-defined model for custom endpoints */
export interface CustomModel {
  id: string;
  label: string;
}

/** A credential entry for any AI provider */
export interface ProviderAccount {
  id: string;
  provider: BuiltinProvider;
  name: string;
  authType: 'oauth' | 'api-key' | 'local-cli';
  billingModel: BillingModel;
  apiKey?: string;
  /** Authenticated email (populated from OAuth keychain or provider API) */
  email?: string;
  baseUrl?: string;
  region?: string;
  createdAt: number;
  updatedAt: number;
  claudeProfileId?: string;
  usage?: ClaudeUsageData;
  rateLimitEvents?: ClaudeRateLimitEvent[];
  /** User-configured models for openai-compatible endpoints */
  customModels?: CustomModel[];
  /**
   * Local-CLI binary to spawn for this account when authType === 'local-cli'.
   * Ignored for other authTypes. Resolution of the actual binary path
   * (e.g. from $PATH or the user-configured claudePath/codexPath) is
   * performed by the CLI tool manager at runtime.
   */
  localCliBinary?: 'claude' | 'codex';
  /**
   * Optional override of the local-CLI binary path. If unset, the CLI
   * tool manager's detection result is used.
   */
  localCliBinaryPath?: string;
}

export type ProviderCategory = 'popular' | 'infrastructure' | 'local';

/** Provider display metadata for UI rendering */
export interface ProviderInfo {
  id: BuiltinProvider;
  name: string;
  description: string;
  category: ProviderCategory;
  authMethods: ('oauth' | 'api-key' | 'local-cli')[];
  envVars: string[];
  configFields: ('baseUrl' | 'region' | 'cliPath')[];
  website?: string;
}
