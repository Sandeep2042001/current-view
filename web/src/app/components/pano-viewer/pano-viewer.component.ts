import { Component, OnInit, OnDestroy, ElementRef, ViewChild, Input, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';

export interface Hotspot {
  id: string;
  source_room_id: string;
  target_room_id: string;
  coordinates_x: number;
  coordinates_y: number;
  coordinates_z: number;
  rotation_y: number;
  label?: string;
  icon?: string;
  color?: string;
}

export interface Room {
  id: string;
  name: string;
  panorama_url: string;
  initial_coordinates_x?: number;
  initial_coordinates_y?: number;
  initial_coordinates_z?: number;
  rotation_y?: number;
  hotspots?: Hotspot[];
}

@Component({
  selector: 'app-pano-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pano-viewer-container" #viewerContainer>
      <canvas #canvas></canvas>
      
      <!-- Hotspot Labels -->
      <div class="hotspot-label" 
           *ngFor="let hotspot of visibleHotspots"
           [style.left.px]="hotspot.screenX"
           [style.top.px]="hotspot.screenY"
           [style.opacity]="hotspot.opacity"
           (click)="onHotspotClick(hotspot)">
        <div class="hotspot-icon">
          <i class="material-icons">{{ hotspot.icon || 'navigation' }}</i>
        </div>
        <div class="hotspot-text" *ngIf="hotspot.label">{{ hotspot.label }}</div>
      </div>

      <!-- Loading Indicator -->
      <div class="loading" *ngIf="loading">
        <div class="spinner"></div>
        <p>Loading panorama...</p>
      </div>
    </div>
  `,
  styles: [`
    .pano-viewer-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }

    .hotspot-label {
      position: absolute;
      transform: translate(-50%, -50%);
      cursor: pointer;
      transition: all 0.3s ease;
      pointer-events: all;
      z-index: 10;
    }

    .hotspot-icon {
      width: 60px;
      height: 60px;
      background: rgba(0, 255, 0, 0.8);
      border: 3px solid white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      transition: all 0.3s ease;
    }

    .hotspot-label:hover .hotspot-icon {
      transform: scale(1.2);
      background: rgba(0, 255, 0, 1);
      box-shadow: 0 6px 20px rgba(0, 255, 0, 0.6);
    }

    .hotspot-icon i {
      color: white;
      font-size: 30px;
    }

    .hotspot-text {
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-top: 8px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      white-space: nowrap;
      font-size: 14px;
      pointer-events: none;
    }

    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;
      z-index: 100;
    }

    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top-color: #00ff00;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class PanoViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) viewerContainer!: ElementRef;
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() room: Room | null = null;
  @Input() hotspots: Hotspot[] = [];
  @Output() hotspotClicked = new EventEmitter<Hotspot>();

  loading = false;
  visibleHotspots: any[] = [];

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private sphere!: THREE.Mesh;
  private animationId: number = 0;
  
  // Camera control
  private isUserInteracting = false;
  private onPointerDownMouseX = 0;
  private onPointerDownMouseY = 0;
  private lon = 0;
  private onPointerDownLon = 0;
  private lat = 0;
  private onPointerDownLat = 0;
  private phi = 0;
  private theta = 0;

  // Hotspot meshes
  private hotspotMeshes: Map<string, THREE.Mesh> = new Map();

  ngOnInit() {}

  ngAfterViewInit() {
    this.initThreeJS();
    if (this.room) {
      this.loadPanorama(this.room.panorama_url);
    }
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    window.removeEventListener('resize', this.onWindowResize);
  }

  private initThreeJS() {
    const container = this.viewerContainer.nativeElement;
    const canvasEl = this.canvas.nativeElement;

    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      1,
      1100
    );
    this.camera.position.set(0, 0, 0.1);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvasEl,
      antialias: true 
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Add event listeners
    canvasEl.addEventListener('pointerdown', this.onPointerDown.bind(this));
    canvasEl.addEventListener('pointermove', this.onPointerMove.bind(this));
    canvasEl.addEventListener('pointerup', this.onPointerUp.bind(this));
    canvasEl.addEventListener('wheel', this.onDocumentMouseWheel.bind(this));
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private loadPanorama(imageUrl: string) {
    this.loading = true;

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // Invert to see inside

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        const material = new THREE.MeshBasicMaterial({ map: texture });
        
        if (this.sphere) {
          this.scene.remove(this.sphere);
          this.sphere.geometry.dispose();
          (this.sphere.material as THREE.Material).dispose();
        }

        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        // Load hotspots
        this.loadHotspots();

        this.loading = false;
      },
      undefined,
      (error) => {
        console.error('Error loading panorama:', error);
        this.loading = false;
      }
    );
  }

  private loadHotspots() {
    // Clear existing hotspot meshes
    this.hotspotMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.hotspotMeshes.clear();

    if (!this.hotspots || this.hotspots.length === 0) return;

    // Create 3D hotspot meshes - FIXED ON GROUND
    this.hotspots.forEach(hotspot => {
      // Create a cylinder standing on the ground (like a marker)
      const geometry = new THREE.CylinderGeometry(3, 3, 0.5, 32);
      const material = new THREE.MeshBasicMaterial({
        color: hotspot.color || '#00ff00',
        transparent: true,
        opacity: 0.9
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Position FIXED on ground (y = 0.25 to sit on floor)
      mesh.position.set(
        hotspot.coordinates_x,
        0.25,  // Fixed at ground level
        hotspot.coordinates_z
      );
      
      // Make it non-rotating with scene
      mesh.matrixAutoUpdate = true;
      mesh.userData = { hotspot };

      this.scene.add(mesh);
      this.hotspotMeshes.set(hotspot.id, mesh);
    });
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    if (!this.isUserInteracting) {
      this.lon += 0.1; // Auto-rotate slowly
    }

    this.lat = Math.max(-85, Math.min(85, this.lat));
    this.phi = THREE.MathUtils.degToRad(90 - this.lat);
    this.theta = THREE.MathUtils.degToRad(this.lon);

    const x = 500 * Math.sin(this.phi) * Math.cos(this.theta);
    const y = 500 * Math.cos(this.phi);
    const z = 500 * Math.sin(this.phi) * Math.sin(this.theta);

    this.camera.lookAt(x, y, z);

    // Update hotspot screen positions
    this.updateHotspotPositions();

    this.renderer.render(this.scene, this.camera);
  }

  private updateHotspotPositions() {
    this.visibleHotspots = [];

    this.hotspotMeshes.forEach((mesh, id) => {
      const hotspot = mesh.userData['hotspot'];
      
      // Project 3D position to 2D screen coordinates
      const vector = mesh.position.clone();
      vector.project(this.camera);

      // Check if hotspot is in front of camera
      const dotProduct = mesh.position.clone().normalize().dot(
        this.camera.getWorldDirection(new THREE.Vector3())
      );

      if (dotProduct > 0) {
        const container = this.viewerContainer.nativeElement;
        const x = (vector.x * 0.5 + 0.5) * container.clientWidth;
        const y = (vector.y * -0.5 + 0.5) * container.clientHeight;

        // Calculate opacity based on viewing angle
        const opacity = Math.max(0.3, Math.min(1, dotProduct));

        this.visibleHotspots.push({
          ...hotspot,
          screenX: x,
          screenY: y,
          opacity: opacity
        });
      }
    });
  }

  private onPointerDown(event: PointerEvent) {
    this.isUserInteracting = true;
    this.onPointerDownMouseX = event.clientX;
    this.onPointerDownMouseY = event.clientY;
    this.onPointerDownLon = this.lon;
    this.onPointerDownLat = this.lat;
  }

  private onPointerMove(event: PointerEvent) {
    if (this.isUserInteracting) {
      this.lon = (this.onPointerDownMouseX - event.clientX) * 0.1 + this.onPointerDownLon;
      this.lat = (event.clientY - this.onPointerDownMouseY) * 0.1 + this.onPointerDownLat;
    }
  }

  private onPointerUp() {
    this.isUserInteracting = false;
  }

  private onDocumentMouseWheel(event: WheelEvent) {
    const fov = this.camera.fov + event.deltaY * 0.05;
    this.camera.fov = THREE.MathUtils.clamp(fov, 30, 100);
    this.camera.updateProjectionMatrix();
  }

  private onWindowResize = () => {
    const container = this.viewerContainer.nativeElement;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  };

  onHotspotClick(hotspot: any) {
    this.hotspotClicked.emit(hotspot);
  }

  // Public methods
  public updateRoom(room: Room) {
    this.room = room;
    if (room.panorama_url) {
      this.loadPanorama(room.panorama_url);
    }
  }

  public updateHotspots(hotspots: Hotspot[]) {
    this.hotspots = hotspots;
    this.loadHotspots();
  }
}
