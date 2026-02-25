import { Injectable, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export interface Language {
  code: string;
  label: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
];

const STORAGE_KEY = 'mess_lang';
const DEFAULT_LANG = 'fr';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly languages = SUPPORTED_LANGUAGES;

  private _current = signal<string>(this.resolveLang());
  readonly current = this._current.asReadonly();
  readonly currentLang = computed(() =>
    SUPPORTED_LANGUAGES.find(l => l.code === this._current()) ?? SUPPORTED_LANGUAGES[0]
  );

  constructor(private translate: TranslateService) {}

  /**
   * Called by APP_INITIALIZER — registers langs, sets default, and awaits
   * the HTTP fetch for the active locale before Angular renders anything.
   */
  init(): Promise<unknown> {
    this.translate.addLangs(SUPPORTED_LANGUAGES.map(l => l.code));
    this.translate.setDefaultLang(DEFAULT_LANG);
    return firstValueFrom(this.translate.use(this._current()));
  }

  use(code: string): void {
    if (!SUPPORTED_LANGUAGES.find(l => l.code === code)) return;
    this._current.set(code);
    localStorage.setItem(STORAGE_KEY, code);
    this.translate.use(code);
  }

  /** Resolve language: localStorage → browser preference → default */
  private resolveLang(): string {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.find(l => l.code === stored)) return stored;

    const browser = navigator.language?.split('-')[0];
    if (browser && SUPPORTED_LANGUAGES.find(l => l.code === browser)) return browser;

    return DEFAULT_LANG;
  }
}
