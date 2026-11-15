
import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { Hero } from '../../components/hero/hero';

import { EarthExplorer } from '../../../earth-explorer/pages/earth-explorer/earth-explorer';

@Component({
  selector: 'app-home',
  standalone: true,

  imports: [
    RouterLink,
    Hero,
    EarthExplorer,
  ],

  templateUrl: './home.html',
  styleUrl: './home.css',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {}
