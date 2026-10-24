'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';

type Theme = 'system' | 'light' | 'dark';
type TextScale = 'compact' | 'normal' | 'large';

const THEME_KEY = 'welp-theme';
const SCALE_KEY = 'welp-text-scale';

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove('dark', 'light');
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'light') {
    html.classList.add('light');
  } else {
    // system: follow prefers-color-scheme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    }
  }
}

function applyScale(scale: TextScale) {
  const value = scale === 'compact' ? '0.875' : scale === 'large' ? '1.125' : '1';
  document.documentElement.style.setProperty('--text-scale', value);
}

function scaleValue(scale: TextScale): string {
  return scale === 'compact' ? '0.875' : scale === 'large' ? '1.125' : '1';
}

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY) as Theme | null;
    if (v && (['system', 'light', 'dark'] as string[]).includes(v)) return v;
  } catch { /* ignore */ }
  return 'system';
}

function readScale(): TextScale {
  try {
    const v = localStorage.getItem(SCALE_KEY) as TextScale | null;
    if (v && (['compact', 'normal', 'large'] as string[]).includes(v)) return v;
  } catch { /* ignore */ }
  return 'normal';
}

export function SettingsPage() {
  // Lazy initialisers read localStorage once at mount — avoids setState-in-effect lint error.
  // applyTheme/applyScale are called in a separate effect that does NOT call setState.
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [scale, setScale] = useState<TextScale>(readScale);
  const [announcement, setAnnouncement] = useState('');
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply persisted values on first render (DOM side-effect only, no setState)
  useEffect(() => {
    applyTheme(theme);
    applyScale(scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for system color-scheme changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const announce = useCallback((message: string) => {
    if (announceTimer.current) clearTimeout(announceTimer.current);
    setAnnouncement(message);
    announceTimer.current = setTimeout(() => setAnnouncement(''), 2500);
  }, []);

  const changeTheme = useCallback(
    (next: Theme) => {
      setTheme(next);
      applyTheme(next);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // ignore
      }
      const labels: Record<Theme, string> = {
        system: 'Theme set to System',
        light: 'Theme set to Light',
        dark: 'Theme set to Dark',
      };
      announce(labels[next]);
    },
    [announce],
  );

  const changeScale = useCallback(
    (next: TextScale) => {
      setScale(next);
      applyScale(next);
      try {
        localStorage.setItem(SCALE_KEY, next);
      } catch {
        // ignore
      }
      const labels: Record<TextScale, string> = {
        compact: 'Text scale set to Compact',
        normal: 'Text scale set to Normal',
        large: 'Text scale set to Large',
      };
      announce(labels[next]);
    },
    [announce],
  );

  const resetDefaults = useCallback(() => {
    changeTheme('system');
    changeScale('normal');
    announce('Settings reset to defaults');
  }, [changeTheme, changeScale, announce]);

  return (
    <main className="app-shell">
      <AppSidebar active="settings" />

      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>WORKSPACE</span>
            <span className="crumb-slash">/</span>
            <strong>Settings</strong>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">PREFERENCES</p>
              <h1>
                App <em>settings.</em>
              </h1>
              <p className="welcome-copy">
                Adjust how WELP looks and reads. These preferences are stored locally in your browser
                and never affect wallet connections, trading permissions, or vault access.
              </p>
            </div>
          </section>

          <div className="settings-grid">
            {/* Theme */}
            <section className="panel settings-panel" aria-labelledby="theme-heading">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">APPEARANCE</p>
                  <h2 id="theme-heading">Theme</h2>
                </div>
              </div>

              <div className="settings-body">
                <p className="settings-description">
                  Choose how WELP renders colours. System follows your device preference automatically.
                </p>

                <fieldset className="settings-fieldset" aria-labelledby="theme-heading">
                  <legend className="sr-only">Theme</legend>
                  <div className="settings-options" role="group" aria-label="Theme options">
                    {(['system', 'light', 'dark'] as Theme[]).map((option) => (
                      <label
                        key={option}
                        className={`settings-option${theme === option ? ' settings-option-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={option}
                          checked={theme === option}
                          onChange={() => changeTheme(option)}
                          aria-label={`Theme: ${option.charAt(0).toUpperCase() + option.slice(1)}`}
                          className="settings-radio"
                        />
                        <span className="settings-option-label">
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </span>
                        {option === 'system' && (
                          <span className="settings-option-hint">Follows device</span>
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>

            {/* Text scale */}
            <section className="panel settings-panel" aria-labelledby="scale-heading">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">READABILITY</p>
                  <h2 id="scale-heading">Text scale</h2>
                </div>
              </div>

              <div className="settings-body">
                <p className="settings-description">
                  Adjusts the base font size across navigation, tables, forms, and wallet
                  confirmations. Fee and slippage summaries remain fully visible at all sizes.
                </p>

                <fieldset className="settings-fieldset" aria-labelledby="scale-heading">
                  <legend className="sr-only">Text scale</legend>
                  <div className="settings-options" role="group" aria-label="Text scale options">
                    {(['compact', 'normal', 'large'] as TextScale[]).map((option) => (
                      <label
                        key={option}
                        className={`settings-option${scale === option ? ' settings-option-selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="text-scale"
                          value={option}
                          checked={scale === option}
                          onChange={() => changeScale(option)}
                          aria-label={`Text scale: ${option.charAt(0).toUpperCase() + option.slice(1)} (${scaleValue(option)}×)`}
                          className="settings-radio"
                        />
                        <span className="settings-option-label">
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </span>
                        <span className="settings-option-hint">{scaleValue(option)}×</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>

            {/* Reset */}
            <section className="panel settings-panel settings-reset-panel" aria-labelledby="reset-heading">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">RESET</p>
                  <h2 id="reset-heading">Restore defaults</h2>
                </div>
              </div>

              <div className="settings-body">
                <p className="settings-description">
                  Resets theme to System and text scale to Normal. This only affects display
                  preferences — it does not disconnect your wallet or change any trading settings.
                </p>

                <button
                  type="button"
                  className="settings-reset-button"
                  onClick={resetDefaults}
                  aria-label="Reset all settings to defaults"
                >
                  Reset to defaults
                </button>
              </div>
            </section>
          </div>

          {/* ARIA live region for change announcements */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {announcement}
          </div>

          <footer className="footer">
            <span>WELP UP · Solana mainnet</span>
            <span>Trading is risky. A token can lose all value.</span>
            <a href="/terms">Terms &amp; Conditions</a>
          </footer>
        </div>
      </section>
    </main>
  );
}
