import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero {
  readonly reducedMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  readonly paused = signal(this.reducedMotion);
  toggleVideo(video: HTMLVideoElement): void {
    if (video.paused) {
      void video
        .play()
        .then(() => this.paused.set(false))
        .catch(() => this.paused.set(true));
    } else {
      video.pause();
      this.paused.set(true);
    }
  }
}
