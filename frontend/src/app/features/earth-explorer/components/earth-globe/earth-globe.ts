
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { ThermalControls } from '../thermal-controls/thermal-controls';

import {
  ThermalGrid,
  ThermalProvider,
  ThermalSource,
} from '../../../../core/models/thermal.model';

import {
  geographicCoordinates,
  createBoundaries,
  geographicVector,
} from './geography';

import { TEMPERATURE_STOPS } from './thermal-raster';

import { TemperatureGridService } from '../../../../core/services/temperature-grid.service';

import { TEMPERATURE_TEXTURE_FACTORY } from './temperature-texture';

export interface GlobeLocation {
  latitude: number;
  longitude: number;
}

export type GlobeLayer = 'surface' | 'temperature';

@Component({
  selector: 'app-earth-globe',
  standalone: true,
  imports: [ThermalControls],
  templateUrl: './earth-globe.html',
  styleUrl: './earth-globe.css',
})
export class EarthGlobe implements AfterViewInit, OnDestroy {
  @ViewChild('globeContainer', { static: true })
  private containerRef!: ElementRef<HTMLDivElement>;

  private readonly temperatureService = inject(TemperatureGridService);
  private readonly createTexture = inject(TEMPERATURE_TEXTURE_FACTORY);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  readonly latitude = input(19.845);
  readonly longitude = input(-90.523);
  readonly locationB = input<GlobeLocation | null>(null);

  readonly locationSelected = output<GlobeLocation>();

  readonly activeLayer = signal<GlobeLayer>('temperature');
  readonly selectedLocation = signal<GlobeLocation | null>(null);

  readonly temperatureDate = signal('2024-06-15');
  readonly provider = signal<ThermalProvider>('noaa');

  readonly sources = signal<ThermalSource[]>([]);
  readonly loadedGrid = signal<ThermalGrid | null>(null);

  readonly boundaryWarning = signal<string | null>(null);
  readonly webglError = signal<string | null>(null);

  readonly temperatureLoading = signal(false);
  readonly temperatureError = signal<string | null>(null);
  readonly temperatureCount = signal(0);

  readonly overlayOpacity = signal(100);

  readonly legendTicks = [-20, -10, 0, 10, 20, 30, 40];

  readonly legendGradient =
    'linear-gradient(to right, ' +
    TEMPERATURE_STOPS.map(
      ([temperature, red, green, blue]) =>
        `rgb(${red},${green},${blue}) ${
          ((temperature + 20) / 60) * 100
        }%`,
    ).join(', ') +
    ')';

  // ==========================================
  // THREE.JS
  // ==========================================

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private earth!: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshPhongMaterial
  >;

  private clouds?: THREE.Mesh;
  private atmosphere?: THREE.Mesh;

  private markerB?: THREE.Mesh;
  private locationMarker?: THREE.Group;

  private temperatureOverlay?: THREE.Mesh<
    THREE.SphereGeometry,
    THREE.MeshBasicMaterial
  >;

  private temperatureTexture?: THREE.DataTexture;
  private boundaries?: THREE.LineSegments;

  private readonly radius = 2;
  private initialDistance = 6.2;

  private readonly textures: THREE.Texture[] = [];

  private sourceSubscription?: Subscription;
  private temperatureSubscription?: Subscription;

  private textureAbort?: AbortController;
  private readonly boundaryAbort = new AbortController();

  private generation = 0;
  private animationFrame = 0;

  private resizeObserver?: ResizeObserver;
  private destroyed = false;

  private readonly ready = signal(false);

  // ==========================================
  // MOBILE INTERACTION
  // ==========================================

  readonly mobileInteractionEnabled = signal(false);

  private isMobile = false;

  private holdTimer?: ReturnType<typeof setTimeout>;

  private readonly pointers = new Set<number>();

  private holdStart?: {
    x: number;
    y: number;
  };

  private cancelHold = (): void => {
    if (this.holdTimer !== undefined) {
      clearTimeout(this.holdTimer);
      this.holdTimer = undefined;
    }

    this.holdStart = undefined;
  };

  private readonly pointerDown = (
    event: PointerEvent,
  ): void => {
    this.pointers.add(event.pointerId);
    this.cancelHold();

    if (
      event.pointerType === 'mouse' ||
      this.pointers.size !== 1
    ) {
      return;
    }

    this.holdStart = {
      x: event.clientX,
      y: event.clientY,
    };

    const startX = event.clientX;
    const startY = event.clientY;

    this.holdTimer = setTimeout(() => {
      if (
        this.destroyed ||
        this.pointers.size !== 1 ||
        !this.holdStart
      ) {
        return;
      }

      this.zone.run(() => {
        this.selectLocationAt(startX, startY);
      });

      this.cancelHold();
    }, 650);
  };

  private readonly pointerMove = (
    event: PointerEvent,
  ): void => {
    if (!this.holdStart) {
      return;
    }

    const distance = Math.hypot(
      event.clientX - this.holdStart.x,
      event.clientY - this.holdStart.y,
    );

    if (distance > 8) {
      this.cancelHold();
    }
  };

  private readonly pointerEnd = (
    event: PointerEvent,
  ): void => {
    this.pointers.delete(event.pointerId);
    this.cancelHold();
  };

  private readonly handleDoubleClick = (
    event: MouseEvent,
  ): void => {
    this.zone.run(() => {
      this.selectLocationAt(
        event.clientX,
        event.clientY,
      );
    });
  };

  // ==========================================
  // CONSTRUCTOR
  // ==========================================

  constructor() {
    effect(() => {
      const latitude = this.latitude();
      const longitude = this.longitude();
      const locationB = this.locationB();

      if (!this.ready()) {
        return;
      }

      this.updateLocationMarker(
        geographicVector(latitude, longitude, 1),
      );

      if (locationB) {
        if (!this.markerB) {
          this.markerB = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 16, 12),
            new THREE.MeshBasicMaterial({
              color: 0xfb923c,
            }),
          );

          this.earth.add(this.markerB);
        }

        this.markerB.position.copy(
          geographicVector(
            locationB.latitude,
            locationB.longitude,
            this.radius * 1.045,
          ),
        );

        this.markerB.visible = true;
      } else if (this.markerB) {
        this.markerB.visible = false;
      }
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });
  }

  // ==========================================
  // LIFECYCLE
  // ==========================================

  ngAfterViewInit(): void {
    try {
      this.initializeScene();
      this.createEarth();
      this.configureControls();

      this.ready.set(true);

      this.configureResize();
      this.resetView();

      this.zone.runOutsideAngular(() => {
        this.animate();
      });

      this.loadSources();
      this.loadTemperatureOverlay();

      void this.loadBoundaries();
    } catch (error) {
      console.error(
        'Earth globe initialization failed:',
        error,
      );

      this.webglError.set(
        'Unable to initialize the 3D Earth. Check WebGL and hardware acceleration.',
      );
    }
  }

  // ==========================================
  // SCENE INITIALIZATION
  // ==========================================

  private initializeScene(): void {
    const container = this.containerRef.nativeElement;

    const width = Math.max(
      container.clientWidth,
      1,
    );

    const height = Math.max(
      container.clientHeight,
      1,
    );

    this.scene = new THREE.Scene();

    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      100,
    );

    this.initialDistance = this.fittedDistance(
      this.camera.aspect,
    );

    this.camera.position.set(
      0,
      0,
      this.initialDistance,
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2,
      ),
    );

    this.renderer.setSize(
      width,
      height,
    );

    this.renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    container.appendChild(
      this.renderer.domElement,
    );

    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      1.15,
    );

    this.scene.add(ambientLight);

    const sunlight = new THREE.DirectionalLight(
      0xffffff,
      2.3,
    );

    sunlight.position.set(5, 3, 5);

    this.scene.add(sunlight);

    const rimLight = new THREE.DirectionalLight(
      0x38bdf8,
      1.35,
    );

    rimLight.position.set(-4, -2, -4);

    this.scene.add(rimLight);
  }

  // ==========================================
  // EARTH
  // ==========================================

  private createEarth(): void {
    const geometry = new THREE.SphereGeometry(
      this.radius,
      128,
      96,
    );

    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 18,
    });

    this.earth = new THREE.Mesh(
      geometry,
      material,
    );

    this.scene.add(this.earth);

    const loader = new THREE.TextureLoader();

    loader.load(
      '/textures/earth/earth-surface.jpg',

      (texture) => {
        if (this.destroyed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;

        texture.anisotropy = Math.min(
          this.renderer.capabilities.getMaxAnisotropy(),
          8,
        );

        this.textures.push(texture);

        material.map = texture;
        material.needsUpdate = true;
      },

      undefined,

      (error) => {
        console.warn(
          'Earth surface texture unavailable:',
          error,
        );
      },
    );

    loader.load(
      '/textures/earth/earth-specular.jpg',

      (texture) => {
        if (this.destroyed) {
          texture.dispose();
          return;
        }

        this.textures.push(texture);

        material.specularMap = texture;
        material.specular = new THREE.Color(0x555555);
        material.needsUpdate = true;
      },

      undefined,

      (error) => {
        console.warn(
          'Earth specular texture unavailable:',
          error,
        );
      },
    );

    this.createClouds(loader);
    this.createAtmosphere();
    this.createTemperatureOverlay();

    if (this.clouds) {
      this.clouds.visible = false;
    }
  }

  // ==========================================
  // CLOUDS
  // ==========================================

  private createClouds(
    loader: THREE.TextureLoader,
  ): void {
    const geometry = new THREE.SphereGeometry(
      this.radius * 1.012,
      96,
      64,
    );

    const material = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    this.clouds = new THREE.Mesh(
      geometry,
      material,
    );

    this.scene.add(this.clouds);

    loader.load(
      '/textures/earth/earth-clouds.png',

      (texture) => {
        if (this.destroyed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;

        this.textures.push(texture);

        material.map = texture;
        material.opacity = 0.28;
        material.needsUpdate = true;
      },

      undefined,

      (error) => {
        console.warn(
          'Cloud texture unavailable:',
          error,
        );
      },
    );
  }

  // ==========================================
  // ATMOSPHERE
  // ==========================================

  private createAtmosphere(): void {
    const geometry = new THREE.SphereGeometry(
      this.radius * 1.035,
      96,
      64,
    );

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,

      uniforms: {
        glowColor: {
          value: new THREE.Color(0x38bdf8),
        },
      },

      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);

          vec4 viewPosition =
            modelViewMatrix * vec4(position, 1.0);

          vPosition = viewPosition.xyz;

          gl_Position =
            projectionMatrix * viewPosition;
        }
      `,

      fragmentShader: `
        uniform vec3 glowColor;

        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vec3 viewDirection = normalize(-vPosition);

          float intensity = pow(
            1.0 - abs(
              dot(normalize(vNormal), viewDirection)
            ),
            3.0
          );

          gl_FragColor = vec4(
            glowColor,
            intensity * 0.55
          );
        }
      `,
    });

    this.atmosphere = new THREE.Mesh(
      geometry,
      material,
    );

    this.scene.add(this.atmosphere);
  }

  // ==========================================
  // TEMPERATURE OVERLAY
  // ==========================================

  private createTemperatureOverlay(): void {
    const geometry = new THREE.SphereGeometry(
      this.radius * 1.006,
      128,
      96,
    );

    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: this.overlayOpacity() / 100,
      depthWrite: false,
      toneMapped: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.temperatureOverlay = new THREE.Mesh(
      geometry,
      material,
    );

    this.temperatureOverlay.visible = false;
    this.temperatureOverlay.renderOrder = 2;

    this.earth.add(
      this.temperatureOverlay,
    );
  }

  // ==========================================
  // LAYER MANAGEMENT
  // ==========================================

  setLayer(layer: GlobeLayer): void {
    this.activeLayer.set(layer);

    if (this.clouds) {
      this.clouds.visible =
        layer === 'surface';
    }

    if (this.boundaries) {
      this.boundaries.visible =
        layer === 'temperature';
    }

    if (this.temperatureOverlay) {
      this.temperatureOverlay.visible =
        layer === 'temperature' &&
        !!this.temperatureTexture;
    }

    if (
      layer === 'temperature' &&
      !this.temperatureTexture &&
      !this.temperatureLoading()
    ) {
      this.loadTemperatureOverlay();
    }
  }

  // ==========================================
  // SOURCES
  // ==========================================

  loadSources(): void {
    this.sourceSubscription?.unsubscribe();

    this.sourceSubscription =
      this.temperatureService.sources().subscribe({
        next: (sources) => {
          this.sources.set(sources);
        },

        error: () => {
          this.temperatureError.set(
            'Unable to load archive metadata. Check the FastAPI connection and retry.',
          );
        },
      });
  }

  changeProvider(provider: ThermalProvider): void {
    const source = this.sources().find(
      (item) =>
        item.id === provider &&
        item.available,
    );

    if (!source) {
      return;
    }

    this.provider.set(provider);

    const current = this.temperatureDate();

    if (
      source.dates?.length &&
      !source.dates.includes(current)
    ) {
      this.temperatureDate.set(
        source.dates[source.dates.length - 1],
      );
    } else if (
      source.start &&
      current < source.start
    ) {
      this.temperatureDate.set(
        source.start,
      );
    } else if (
      source.end &&
      current > source.end
    ) {
      this.temperatureDate.set(
        source.end,
      );
    }

    this.loadTemperatureOverlay();
  }

  changeDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return;
    }

    this.temperatureDate.set(date);
    this.loadTemperatureOverlay();
  }

  changeOpacity(value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    const opacity = THREE.MathUtils.clamp(
      value,
      0,
      100,
    );

    this.overlayOpacity.set(opacity);

    if (this.temperatureOverlay) {
      this.temperatureOverlay.material.opacity =
        opacity / 100;
    }
  }

  retry(): void {
    this.loadSources();
    this.loadTemperatureOverlay();
  }

  // ==========================================
  // LOAD TEMPERATURE GRID
  // ==========================================

  loadTemperatureOverlay(): void {
    if (
      this.destroyed ||
      this.webglError()
    ) {
      return;
    }

    const generation = ++this.generation;

    this.temperatureSubscription?.unsubscribe();
    this.textureAbort?.abort();

    const abort = new AbortController();

    this.textureAbort = abort;

    this.temperatureLoading.set(true);
    this.temperatureError.set(null);

    this.loadedGrid.set(null);
    this.temperatureCount.set(0);

    if (this.temperatureOverlay) {
      this.temperatureOverlay.visible = false;
      this.temperatureOverlay.material.map = null;
      this.temperatureOverlay.material.needsUpdate = true;
    }

    this.temperatureTexture?.dispose();
    this.temperatureTexture = undefined;

    const date = this.temperatureDate();
    const provider = this.provider();

    this.temperatureSubscription =
      this.temperatureService
        .getTemperatureGrid(date, provider)
        .subscribe({
          next: async (response) => {
            try {
              if (
                response.date !== date ||
                response.provider !== provider
              ) {
                throw new Error(
                  'The server returned a different date or provider.',
                );
              }

              const texture = await this.createTexture(
                response,
                abort.signal,
              );

              if (
                this.destroyed ||
                generation !== this.generation
              ) {
                texture.dispose();
                return;
              }

              this.temperatureTexture = texture;

              this.loadedGrid.set(response);

              this.temperatureCount.set(
                response.valid_cells,
              );

              if (this.temperatureOverlay) {
                this.temperatureOverlay.material.map =
                  texture;

                this.temperatureOverlay.material.needsUpdate =
                  true;

                this.temperatureOverlay.visible =
                  this.activeLayer() === 'temperature';
              }
            } catch (error) {
              if (
                !abort.signal.aborted &&
                generation === this.generation
              ) {
                this.temperatureError.set(
                  error instanceof Error
                    ? error.message
                    : 'Unable to process the temperature grid.',
                );
              }
            } finally {
              if (
                !this.destroyed &&
                generation === this.generation
              ) {
                this.temperatureLoading.set(false);
              }
            }
          },

          error: (error: HttpErrorResponse) => {
            if (
              this.destroyed ||
              generation !== this.generation
            ) {
              return;
            }

            this.temperatureLoading.set(false);

            const detail = error.error?.detail;

            this.temperatureError.set(
              typeof detail === 'string'
                ? detail
                : 'Unable to load the temperature grid. Check FastAPI.',
            );
          },
        });
  }

  // ==========================================
  // GEOGRAPHIC BOUNDARIES
  // ==========================================

  private async loadBoundaries(): Promise<void> {
    try {
      const response = await fetch(
        '/geography/countries-110m.geojson',
        {
          signal: this.boundaryAbort.signal,
        },
      );

      if (!response.ok) {
        throw new Error(
          'Country boundaries unavailable.',
        );
      }

      const data = await response.json();

      if (this.destroyed) {
        return;
      }

      this.boundaries = createBoundaries(
        data,
        this.radius * 1.008,
      );

      this.boundaries.visible =
        this.activeLayer() === 'temperature';

      this.earth.add(this.boundaries);
    } catch {
      if (!this.destroyed) {
        this.boundaryWarning.set(
          'Country outlines unavailable. Temperature data remain valid.',
        );
      }
    }
  }

  // ==========================================
  // CONTROLS / MOBILE SCROLL FIX
  // ==========================================

  private configureControls(): void {
    const canvas = this.renderer.domElement;

    this.controls = new OrbitControls(
      this.camera,
      canvas,
    );

    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;

    this.controls.enablePan = false;

    this.controls.minDistance = 2.8;
    this.controls.maxDistance = 11;

    this.controls.rotateSpeed = 0.65;
    this.controls.zoomSpeed = 0.8;

    this.controls.enableRotate = true;
    this.controls.enableZoom = true;

    // ========================================
    // TOUCH BEHAVIOR
    // ========================================

    this.isMobile = window.matchMedia(
      '(max-width: 768px) and (pointer: coarse)',
    ).matches;

    if (this.isMobile) {
      // By default, one-finger gestures scroll
      // the page rather than rotating Earth.

      this.mobileInteractionEnabled.set(false);

      this.controls.enabled = false;

      canvas.style.touchAction = 'pan-y';
    } else {
      // Desktop interaction.

      this.controls.enabled = true;

      this.controls.enableRotate = true;
      this.controls.enableZoom = true;

      this.controls.touches.ONE =
        THREE.TOUCH.ROTATE;

      this.controls.touches.TWO =
        THREE.TOUCH.DOLLY_ROTATE;

      canvas.style.touchAction = 'auto';
    }

    // ========================================
    // LOCATION SELECTION
    // ========================================

    canvas.addEventListener(
      'pointerdown',
      this.pointerDown,
    );

    canvas.addEventListener(
      'pointermove',
      this.pointerMove,
    );

    canvas.addEventListener(
      'pointerup',
      this.pointerEnd,
    );

    canvas.addEventListener(
      'pointercancel',
      this.pointerEnd,
    );

    canvas.addEventListener(
      'pointerleave',
      this.pointerEnd,
    );

    canvas.addEventListener(
      'dblclick',
      this.handleDoubleClick,
    );
  }

  // ==========================================
  // ENABLE / DISABLE MOBILE INTERACTION
  // ==========================================

  toggleMobileInteraction(): void {
    if (!this.isMobile || !this.controls) {
      return;
    }

    const enabled =
      !this.mobileInteractionEnabled();

    this.mobileInteractionEnabled.set(enabled);

    this.controls.enabled = enabled;

    if (enabled) {
      this.controls.enableRotate = true;
      this.controls.enableZoom = true;

      this.controls.touches.ONE =
        THREE.TOUCH.ROTATE;

      this.controls.touches.TWO =
        THREE.TOUCH.DOLLY_ROTATE;

      this.renderer.domElement.style.touchAction =
        'none';
    } else {
      this.renderer.domElement.style.touchAction =
        'pan-y';

      this.cancelHold();
    }
  }

  // ==========================================
  // LOCATION SELECTION
  // ==========================================

  private selectLocationAt(
    clientX: number,
    clientY: number,
  ): void {
    if (
      this.destroyed ||
      !this.renderer ||
      !this.camera
    ) {
      return;
    }

    const bounds =
      this.renderer.domElement.getBoundingClientRect();

    if (
      bounds.width <= 0 ||
      bounds.height <= 0
    ) {
      return;
    }

    const pointer = new THREE.Vector2(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();

    raycaster.setFromCamera(
      pointer,
      this.camera,
    );

    const intersections =
      raycaster.intersectObject(
        this.earth,
        false,
      );

    if (!intersections.length) {
      return;
    }

    const intersection = intersections[0];

    const localPoint = this.earth
      .worldToLocal(
        intersection.point.clone(),
      )
      .normalize();

    const coordinates =
      geographicCoordinates(localPoint);

    const longitude =
      ((coordinates.longitude + 540) % 360) - 180;

    const location: GlobeLocation = {
      latitude: Number(
        coordinates.latitude.toFixed(4),
      ),

      longitude: Number(
        longitude.toFixed(4),
      ),
    };

    this.selectedLocation.set(location);

    // Point A/B selection is handled
    // by the parent EarthExplorer component.

    this.locationSelected.emit(location);
  }

  // ==========================================
  // MARKERS
  // ==========================================

  private updateLocationMarker(
    localPoint: THREE.Vector3,
  ): void {
    if (!this.locationMarker) {
      this.locationMarker = new THREE.Group();

      this.earth.add(
        this.locationMarker,
      );

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(
          0.035,
          16,
          12,
        ),

        new THREE.MeshBasicMaterial({
          color: 0xffffff,
        }),
      );

      this.locationMarker.add(dot);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(
          0.055,
          0.085,
          32,
        ),

        new THREE.MeshBasicMaterial({
          color: 0x00c8ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
        }),
      );

      this.locationMarker.add(ring);
    }

    this.locationMarker.position.copy(
      localPoint
        .clone()
        .multiplyScalar(
          this.radius * 1.045,
        ),
    );

    this.locationMarker.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      localPoint,
    );
  }

  // ==========================================
  // ZOOM
  // ==========================================

  zoomIn(): void {
    this.setZoom(0.8);
  }

  zoomOut(): void {
    this.setZoom(1.25);
  }

  private setZoom(factor: number): void {
    if (!this.camera || !this.controls) {
      return;
    }

    const distance =
      this.camera.position.length();

    const nextDistance = THREE.MathUtils.clamp(
      distance * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );

    this.camera.position.setLength(
      nextDistance,
    );

    this.camera.updateProjectionMatrix();
  }

  resetView(): void {
    if (!this.camera || !this.controls) {
      return;
    }

    this.camera.position.set(
      0,
      0,
      this.initialDistance,
    );

    this.controls.target.set(0, 0, 0);

    this.controls.update();

    this.earth.rotation.set(
      0,
      -Math.PI / 2,
      0,
    );

    if (this.clouds) {
      this.clouds.rotation.copy(
        this.earth.rotation,
      );
    }
  }

  // ==========================================
  // RESPONSIVE CAMERA
  // ==========================================

  private fittedDistance(
    aspect: number,
  ): number {
    const vertical =
      THREE.MathUtils.degToRad(45 / 2);

    const horizontal = Math.atan(
      Math.tan(vertical) * aspect,
    );

    const halfAngle = Math.min(
      vertical,
      horizontal,
    );

    return (
      this.radius /
      Math.sin(
        Math.atan(
          0.84 * Math.tan(halfAngle),
        ),
      )
    );
  }

  // ==========================================
  // RESIZE
  // ==========================================

  private configureResize(): void {
    const container =
      this.containerRef.nativeElement;

    this.resizeObserver = new ResizeObserver(() => {
      if (
        this.destroyed ||
        !this.renderer ||
        !this.camera
      ) {
        return;
      }

      const width = Math.max(
        container.clientWidth,
        1,
      );

      const height = Math.max(
        container.clientHeight,
        1,
      );

      const zoomRatio =
        this.camera.position.length() /
        this.initialDistance;

      this.camera.aspect =
        width / height;

      this.initialDistance =
        this.fittedDistance(
          this.camera.aspect,
        );

      this.controls.maxDistance = Math.max(
        11,
        this.initialDistance * 1.8,
      );

      this.camera.position.setLength(
        THREE.MathUtils.clamp(
          this.initialDistance * zoomRatio,
          this.controls.minDistance,
          this.controls.maxDistance,
        ),
      );

      this.camera.updateProjectionMatrix();

      this.renderer.setSize(
        width,
        height,
      );
    });

    this.resizeObserver.observe(
      container,
    );
  }

  // ==========================================
  // ANIMATION
  // ==========================================

  private animate = (): void => {
    if (this.destroyed) {
      return;
    }

    this.animationFrame =
      requestAnimationFrame(
        this.animate,
      );

    this.controls.update();

    if (
      this.clouds &&
      !window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
    ) {
      this.clouds.rotation.y += 0.00012;
    }

    this.renderer.render(
      this.scene,
      this.camera,
    );
  };

  // ==========================================
  // CLEANUP
  // ==========================================

  ngOnDestroy(): void {
    this.destroyed = true;

    this.cancelHold();
    this.pointers.clear();

    this.temperatureSubscription?.unsubscribe();
    this.sourceSubscription?.unsubscribe();

    this.textureAbort?.abort();
    this.boundaryAbort.abort();

    this.generation++;

    cancelAnimationFrame(
      this.animationFrame,
    );

    this.resizeObserver?.disconnect();

    const canvas =
      this.renderer?.domElement;

    canvas?.removeEventListener(
      'pointerdown',
      this.pointerDown,
    );

    canvas?.removeEventListener(
      'pointermove',
      this.pointerMove,
    );

    canvas?.removeEventListener(
      'pointerup',
      this.pointerEnd,
    );

    canvas?.removeEventListener(
      'pointercancel',
      this.pointerEnd,
    );

    canvas?.removeEventListener(
      'pointerleave',
      this.pointerEnd,
    );

    canvas?.removeEventListener(
      'dblclick',
      this.handleDoubleClick,
    );

    this.controls?.dispose();

    if (this.temperatureOverlay) {
      this.temperatureOverlay.material.map = null;
    }

    this.temperatureTexture?.dispose();

    this.scene?.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.LineSegments
      ) {
        object.geometry.dispose();

        const materials =
          Array.isArray(object.material)
            ? object.material
            : [object.material];

        for (const material of materials) {
          material.dispose();
        }
      }
    });

    for (const texture of this.textures) {
      texture.dispose();
    }

    this.renderer?.dispose();

    this.renderer?.domElement.remove();
  }
}
