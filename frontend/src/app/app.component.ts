import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: [':host { display: block; height: 100%; }'],
})
export class AppComponent {
  // Injecting ThemeService here ensures the effect runs at app startup
  // and applies the saved dark-mode preference before first render.
  private _theme = inject(ThemeService);
}
