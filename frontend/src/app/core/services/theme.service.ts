import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'yoolo_dark_mode';

  isDark = signal<boolean>(this.loadPreference());

  constructor() {
    effect(() => {
      const dark = this.isDark();
      document.documentElement.classList.toggle('dark-mode', dark);
      localStorage.setItem(this.STORAGE_KEY, dark ? '1' : '0');
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  private loadPreference(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored !== null) return stored === '1';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
