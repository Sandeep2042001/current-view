import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { UploadService } from '../../services/upload.service';
import { ToastrService } from 'ngx-toastr';
import { Project, Room, Hotspot, Annotation, Measurement } from '../../models/user.model';

// Three.js imports
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="viewer-container">
      <!-- Viewer Controls -->
      <div class="viewer-controls">
        <div class="control-group">
          <button (click)="toggleFullscreen()" class="control-btn" title="Fullscreen">
            <i class="material-icons">{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</i>
          </button>
          <button (click)="toggleVR()" class="control-btn" title="VR Mode">
            <i class="material-icons">view_in_ar</i>
          </button>
          <button (click)="toggleAnnotations()" class="control-btn" title="Toggle Annotations">
            <i class="material-icons">{{ showAnnotations ? 'visibility' : 'visibility_off' }}</i>
          </button>
          <button (click)="toggleMeasurements()" class="control-btn" title="Toggle Measurements">
            <i class="material-icons">{{ showMeasurements ? 'straighten' : 'straighten' }}</i>
          </button>
        </div>

        <div class="room-navigation" *ngIf="rooms.length > 1">
          <select [(ngModel)]="currentRoomId" (change)="switchRoom()" class="room-selector">
            <option *ngFor="let room of rooms" [value]="room.id">{{ room.name }}</option>
          </select>
        </div>
      </div>

      <!-- 360° Viewer Canvas -->
      <div #viewerContainer class="viewer-canvas-container">
        <canvas #viewerCanvas class="viewer-canvas"></canvas>
        
        <!-- Loading Overlay -->
        <div *ngIf="loading" class="loading-overlay">
          <div class="loading-spinner"></div>
          <p>{{ loadingMessage }}</p>
        </div>

        <!-- Hotspots -->
        <div *ngFor="let hotspot of hotspots" 
             class="hotspot" 
             [style.left.px]="hotspot.screenPosition.x" 
             [style.top.px]="hotspot.screenPosition.y"
             [class]="'hotspot-' + hotspot.type"
             (click)="onHotspotClick(hotspot)">
          <div class="hotspot-icon">
            <i class="material-icons">{{ getHotspotIcon(hotspot.type) }}</i>
          </div>
          <div class="hotspot-tooltip" *ngIf="hotspot.showTooltip">
            <h4>{{ hotspot.title }}</h4>
            <p>{{ hotspot.description }}</p>
          </div>
        </div>

        <!-- Annotations Overlay -->
        <div *ngIf="showAnnotations" class="annotations-overlay">
          <div *ngFor="let annotation of annotations" 
               class="annotation"
               [style.left.px]="annotation.screenPosition.x"
               [style.top.px]="annotation.screenPosition.y">
            <div class="annotation-marker" [class]="'annotation-' + annotation.type">
              <i class="material-icons">{{ getAnnotationIcon(annotation.type) }}</i>
            </div>
            <div class="annotation-content" *ngIf="annotation.title">
              <h5>{{ annotation.title }}</h5>
              <p>{{ annotation.description }}</p>
            </div>
          </div>
        </div>

        <!-- Measurements Overlay -->
        <div *ngIf="showMeasurements" class="measurements-overlay">
          <div *ngFor="let measurement of measurements" 
               class="measurement"
               [style.left.px]="measurement.screenPosition.x"
               [style.top.px]="measurement.screenPosition.y">
            <div class="measurement-line"></div>
            <div class="measurement-label">
              {{ measurement.distance?.toFixed(2) }} {{ measurement.unit }}
            </div>
          </div>
        </div>
      </div>

      <!-- Minimap -->
      <div class="minimap" *ngIf="showMinimap">
        <div class="minimap-header">
          <h4>Floor Plan</h4>
          <button (click)="toggleMinimap()" class="minimap-close">×</button>
        </div>
        <div class="minimap-content">
          <canvas #minimapCanvas class="minimap-canvas"></canvas>
        </div>
      </div>

      <!-- Info Panel -->
      <div class="info-panel" *ngIf="showInfoPanel">
        <div class="info-header">
          <h3>{{ currentRoom?.name }}</h3>
          <button (click)="toggleInfoPanel()" class="info-close">×</button>
        </div>
        <div class="info-content">
          <p>{{ currentRoom?.description }}</p>
          <div class="room-stats">
            <div class="stat">
              <span class="stat-label">Images:</span>
              <span class="stat-value">{{ currentRoom?.images?.length || 0 }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Hotspots:</span>
              <span class="stat-value">{{ hotspots.length }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Status:</span>
              <span class="stat-value" [class]="'status-' + currentRoom?.status">
                {{ currentRoom?.status }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="viewer-toolbar">
        <button (click)="toggleMinimap()" class="toolbar-btn" title="Toggle Minimap">
          <i class="material-icons">map</i>
        </button>
        <button (click)="toggleInfoPanel()" class="toolbar-btn" title="Room Info">
          <i class="material-icons">info</i>
        </button>
        <button (click)="addAnnotation()" class="toolbar-btn" title="Add Annotation">
          <i class="material-icons">add_location</i>
        </button>
        <button (click)="startMeasurement()" class="toolbar-btn" title="Start Measurement">
          <i class="material-icons">straighten</i>
        </button>
        <button (click)="takeScreenshot()" class="toolbar-btn" title="Take Screenshot">
          <i class="material-icons">camera_alt</i>
        </button>
      </div>
    </div>
  `,
  styleUrls: ['./viewer.component.scss']
})
export class ViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) viewerContainer!: ElementRef;
  @ViewChild('viewerCanvas', { static: true }) viewerCanvas!: ElementRef;
  @ViewChild('minimapCanvas', { static: true }) minimapCanvas!: ElementRef;

  // Three.js objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private sphere!: THREE.Mesh;
  private animationId!: number;

  // Component state
  projectId!: string;
  currentRoomId!: string;
  project!: Project;
  rooms: Room[] = [];
  currentRoom!: Room;
  hotspots: Hotspot[] = [];
  annotations: Annotation[] = [];
  measurements: Measurement[] = [];

  // UI state
  loading = false;
  loadingMessage = 'Loading 360° viewer...';
  isFullscreen = false;
  showAnnotations = true;
  showMeasurements = true;
  showMinimap = false;
  showInfoPanel = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService,
    private uploadService: UploadService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['projectId'];
      this.currentRoomId = params['roomId'];
      this.loadProject();
    });
  }

  ngAfterViewInit() {
    this.initThreeJS();
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private async loadProject() {
    try {
      this.loading = true;
      this.loadingMessage = 'Loading project...';

      this.project = await this.projectService.getProject(this.projectId).toPromise();
      this.rooms = this.project.rooms || [];

      if (this.rooms.length === 0) {
        this.toastr.error('No rooms found in this project');
        this.router.navigate(['/projects']);
        return;
      }

      // Find current room
      this.currentRoom = this.rooms.find(r => r.id === this.currentRoomId) || this.rooms[0];
      this.currentRoomId = this.currentRoom.id;

      await this.loadRoomData();

    } catch (error) {
      this.toastr.error('Failed to load project');
      console.error('Error loading project:', error);
    } finally {
      this.loading = false;
    }
  }

  private async loadRoomData() {
    try {
      this.loadingMessage = 'Loading room data...';

      // Load hotspots
      this.hotspots = this.currentRoom.hotspots || [];
      this.calculateHotspotScreenPositions();

      // Load annotations
      this.annotations = await this.loadAnnotations();
      this.calculateAnnotationScreenPositions();

      // Load measurements
      this.measurements = await this.loadMeasurements();
      this.calculateMeasurementScreenPositions();

      // Load 360° image
      await this.load360Image();

    } catch (error) {
      this.toastr.error('Failed to load room data');
      console.error('Error loading room data:', error);
    }
  }

  private async load360Image() {
    try {
      this.loadingMessage = 'Loading 360° image...';

      if (this.currentRoom.metadata?.stitched_image_path) {
        // Get presigned URL for the stitched image
        const imageUrl = await this.uploadService.getImageUrl(this.currentRoom.metadata.stitched_image_path).toPromise();
        
        // Load texture
        const texture = await this.loadTexture(imageUrl);
        
        // Create sphere geometry
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Invert the sphere

        // Create material with texture
        const material = new THREE.MeshBasicMaterial({ map: texture });
        
        // Create sphere mesh
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);

        this.startRenderLoop();
      } else {
        this.toastr.warning('No 360° image available for this room');
      }

    } catch (error) {
      this.toastr.error('Failed to load 360° image');
      console.error('Error loading 360° image:', error);
    }
  }

  private loadTexture(url: string): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          resolve(texture);
        },
        undefined,
        (error) => reject(error)
      );
    });
  }

  private initThreeJS() {
    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.viewerContainer.nativeElement.clientWidth / this.viewerContainer.nativeElement.clientHeight,
      0.1,
      1000
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.viewerCanvas.nativeElement,
      antialias: true
    });
    this.renderer.setSize(
      this.viewerContainer.nativeElement.clientWidth,
      this.viewerContainer.nativeElement.clientHeight
    );

    // Create controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;

    // Set initial camera position
    this.camera.position.set(0, 0, 0);

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private startRenderLoop() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }

  private onWindowResize() {
    const width = this.viewerContainer.nativeElement.clientWidth;
    const height = this.viewerContainer.nativeElement.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private calculateHotspotScreenPositions() {
    this.hotspots.forEach(hotspot => {
      const screenPos = this.worldToScreen(hotspot.position);
      hotspot.screenPosition = screenPos;
    });
  }

  private calculateAnnotationScreenPositions() {
    this.annotations.forEach(annotation => {
      if (annotation.coordinates.length > 0) {
        const screenPos = this.worldToScreen(annotation.coordinates[0]);
        annotation.screenPosition = screenPos;
      }
    });
  }

  private calculateMeasurementScreenPositions() {
    this.measurements.forEach(measurement => {
      if (measurement.points.length > 0) {
        const screenPos = this.worldToScreen(measurement.points[0]);
        measurement.screenPosition = screenPos;
      }
    });
  }

  private worldToScreen(worldPosition: { x: number; y: number; z: number }) {
    const vector = new THREE.Vector3(worldPosition.x, worldPosition.y, worldPosition.z);
    vector.project(this.camera);

    const x = (vector.x * 0.5 + 0.5) * this.viewerContainer.nativeElement.clientWidth;
    const y = (vector.y * -0.5 + 0.5) * this.viewerContainer.nativeElement.clientHeight;

    return { x, y };
  }

  private async loadAnnotations(): Promise<Annotation[]> {
    // TODO: Implement API call to load annotations
    return [];
  }

  private async loadMeasurements(): Promise<Measurement[]> {
    // TODO: Implement API call to load measurements
    return [];
  }

  // UI Event Handlers
  onHotspotClick(hotspot: Hotspot) {
    if (hotspot.type === 'navigation' && hotspot.targetRoomId) {
      this.switchToRoom(hotspot.targetRoomId);
    } else {
      this.toastr.info(hotspot.title || 'Hotspot clicked');
    }
  }

  switchRoom() {
    const room = this.rooms.find(r => r.id === this.currentRoomId);
    if (room) {
      this.currentRoom = room;
      this.loadRoomData();
    }
  }

  switchToRoom(roomId: string) {
    this.currentRoomId = roomId;
    this.switchRoom();
  }

  // Control Methods
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.viewerContainer.nativeElement.requestFullscreen();
      this.isFullscreen = true;
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
    }
  }

  toggleVR() {
    this.toastr.info('VR mode coming soon!');
  }

  toggleAnnotations() {
    this.showAnnotations = !this.showAnnotations;
  }

  toggleMeasurements() {
    this.showMeasurements = !this.showMeasurements;
  }

  toggleMinimap() {
    this.showMinimap = !this.showMinimap;
  }

  toggleInfoPanel() {
    this.showInfoPanel = !this.showInfoPanel;
  }

  addAnnotation() {
    this.toastr.info('Add annotation feature coming soon!');
  }

  startMeasurement() {
    this.toastr.info('Measurement tool coming soon!');
  }

  takeScreenshot() {
    const canvas = this.viewerCanvas.nativeElement;
    const link = document.createElement('a');
    link.download = `screenshot_${this.currentRoom.name}_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
    this.toastr.success('Screenshot saved!');
  }

  // Helper Methods
  getHotspotIcon(type: string): string {
    switch (type) {
      case 'navigation': return 'navigation';
      case 'info': return 'info';
      case 'measurement': return 'straighten';
      default: return 'place';
    }
  }

  getAnnotationIcon(type: string): string {
    switch (type) {
      case 'point': return 'place';
      case 'polygon': return 'polygon';
      case 'line': return 'timeline';
      default: return 'place';
    }
  }
}
