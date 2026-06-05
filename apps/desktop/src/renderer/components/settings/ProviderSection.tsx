import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, Plus, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { ProviderAccountCard } from './ProviderAccountCard';
import { OllamaConnectionPanel } from './OllamaConnectionPanel';
import type { BillingModel, BuiltinProvider, ProviderAccount, ProviderInfo } from '@shared/types/provider-account';
import type { ToolDetectionResult } from '@shared/types';

interface ProviderSectionProps {
  provider: ProviderInfo;
  accounts: ProviderAccount[];
  envDetected: boolean;
  onAddAccount: (provider: BuiltinProvider, authType: 'oauth' | 'api-key' | 'local-cli', billingModel?: BillingModel) => void;
  onEditAccount: (account: ProviderAccount) => void;
  onDeleteAccount: (id: string) => void;
  onReauthAccount?: (account: ProviderAccount) => void;
}

export function ProviderSection({
  provider,
  accounts,
  envDetected,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onReauthAccount,
}: ProviderSectionProps) {
  const { t } = useTranslation('settings');
  const [isOpen, setIsOpen] = useState(accounts.length > 0);

  // For 'local-cli' provider, scan the user's machine for installed CLIs
  // (claude, codex) and surface them as quick-add chips. Mirrors Open
  // Design's "Integrations" page pattern.
  const [cliScan, setCliScan] = useState<{ claude?: ToolDetectionResult; codex?: ToolDetectionResult } | null>(null);
  useEffect(() => {
    if (provider.id !== 'local-cli' || !isOpen) return;
    let cancelled = false;
    window.electronAPI.getCliToolsInfo()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return;
        const data = res.data as { claude?: ToolDetectionResult; codex?: ToolDetectionResult };
        setCliScan({ claude: data.claude, codex: data.codex });
      })
      .catch(() => { /* ignore — show empty state */ });
    return () => { cancelled = true; };
  }, [provider.id, isOpen]);

  const hasOAuth = provider.authMethods.includes('oauth');
  const hasApiKey = provider.authMethods.includes('api-key');
  const isOllamaLike = provider.authMethods.length === 0 || (provider.authMethods.length === 0 && provider.configFields.includes('baseUrl'));
  const canAdd = hasOAuth || hasApiKey || isOllamaLike;

  return (
    <div className={cn(
      'rounded-lg border transition-colors',
      accounts.length > 0 ? 'border-border' : 'border-border/50'
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{provider.name}</span>
              {accounts.length > 0 && (
                <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-medium">
                  {accounts.length}
                </span>
              )}
              {envDetected && accounts.length === 0 && (
                <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {t('providers.section.envDetected')}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{provider.description}</span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-3">
              {provider.id === 'ollama' ? (
                <>
                  {/* Show existing account cards above the connection panel */}
                  {accounts.map((account) => (
                    <ProviderAccountCard
                      key={account.id}
                      account={account}
                      onEdit={onEditAccount}
                      onDelete={onDeleteAccount}
                      onReauth={onReauthAccount}
                    />
                  ))}
                  {/* Ollama connection panel handles its own empty state and auto-creation */}
                  <OllamaConnectionPanel accounts={accounts} />
                </>
              ) : (
                <>
                  {/* Account cards */}
                  {accounts.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
                      {envDetected ? (
                        <p className="text-xs text-muted-foreground">
                          {t('providers.section.envCredentialDetected', { envVar: provider.envVars[0] })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t('providers.section.noAccounts')}
                        </p>
                      )}

                      {/* Local CLI: detected binaries quick-add */}
                      {provider.id === 'local-cli' && cliScan && (cliScan.claude || cliScan.codex) && (
                        <div className="space-y-1.5 text-left">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                            {t('providers.section.localCli.detected')}
                          </p>
                          {cliScan.claude && cliScan.claude.found && (
                            <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Terminal className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    Claude Code {cliScan.claude.version ? <span className="text-muted-foreground font-normal">v{cliScan.claude.version}</span> : null}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">{cliScan.claude.path}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAddAccount('local-cli', 'local-cli')}
                                className="h-6 text-[11px] gap-1 shrink-0"
                              >
                                <Plus className="h-3 w-3" />
                                {t('providers.section.localCli.addClaude')}
                              </Button>
                            </div>
                          )}
                          {cliScan.codex && cliScan.codex.found && (
                            <div className="flex items-center justify-between rounded-md border border-border/50 bg-background/50 px-2.5 py-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Terminal className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    Codex CLI {cliScan.codex.version ? <span className="text-muted-foreground font-normal">v{cliScan.codex.version}</span> : null}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">{cliScan.codex.path}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onAddAccount('local-cli', 'local-cli')}
                                className="h-6 text-[11px] gap-1 shrink-0"
                              >
                                <Plus className="h-3 w-3" />
                                {t('providers.section.localCli.addCodex')}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {provider.id === 'local-cli' && cliScan && !cliScan.claude?.found && !cliScan.codex?.found && (
                        <p className="text-[11px] text-muted-foreground">
                          {t('providers.section.localCli.notDetected')}
                        </p>
                      )}
                    </div>
                  ) : (
                    accounts.map((account) => (
                      <ProviderAccountCard
                        key={account.id}
                        account={account}
                        onEdit={onEditAccount}
                        onDelete={onDeleteAccount}
                        onReauth={onReauthAccount}
                      />
                    ))
                  )}

                  {/* Add buttons */}
                  {canAdd && (
                    <div className="flex items-center gap-2 pt-1">
                      {hasOAuth && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAddAccount(provider.id, 'oauth')}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          {provider.id === 'openai'
                            ? t('providers.section.addCodexSubscription')
                            : provider.id === 'anthropic'
                              ? t('providers.section.addClaudeCode')
                              : t('providers.section.addOAuth')}
                        </Button>
                      )}
                      {/* Z.AI: Coding Plan subscription button before generic API Key */}
                      {provider.id === 'zai' && hasApiKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAddAccount(provider.id, 'api-key', 'subscription')}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          {t('providers.section.addCodingPlan')}
                        </Button>
                      )}
                      {hasApiKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAddAccount(provider.id, 'api-key')}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          {provider.id === 'zai'
                            ? t('providers.section.addUsageBased')
                            : t('providers.section.addApiKey')}
                        </Button>
                      )}
                      {/* No-key providers with baseUrl (non-Ollama) */}
                      {!hasOAuth && !hasApiKey && provider.configFields.includes('baseUrl') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAddAccount(provider.id, 'api-key')}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          {t('providers.section.addEndpoint')}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
