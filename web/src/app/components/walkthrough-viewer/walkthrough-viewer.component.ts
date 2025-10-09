import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import * as THREE from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

interface WalkthroughScene {
  id: string;
  type: 'exterior' | 'interior';
  name: string;
  model_path?: string;  // 3D model (PLY/OBJ)
  panorama_path?: string;  // 360° panorama
  point_cloud_path?: string;
  walkable_area?: any;
  entry_points?: Array<{
    position: { x: number, y: number, z: number };
    rotation: number;
    target_scene_id?: string;
    label?: string;
  }>;
}

@Component({
  selector: 'app-walkthrough-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="walkthrough-container" #container>
      <!-- Instructions Overlay -->
      <div class="instructions" *ngIf="showInstructions">
        <h2>Controls</h2>
        <ul>
          <li><strong>Click</strong> to start</li>
          <li><strong>W/↑</strong> - Move forward</li>
          <li><strong>S/↓</strong> - Move backward</li>
          <li><strong>A/←</strong> - Move left</li>
          <li><strong>D/→</strong> - Move right</li>
          <li><strong>Mouse</strong> - Look around</li>
          <li><strong>E</strong> - Interact with hotspot</li>
          <li><strong>ESC</strong> - Release mouse</li>
        </ul>
        <button (click)="startWalkthrough()" class="start-btn">Start Walkthrough</button>
      </div>

      <!-- HUD -->
      <div class="hud" *ngIf="!showInstructions">
        <div class="scene-info">
          <h3>{{ currentScene?.name }}</h3>
          <span class="scene-type">{{ currentScene?.type }}</span>
        </div>
        
        <div class="controls-hint" *ngIf="!controlsLocked">
          <p>Click to enable controls</p>
        </div>
        
        <div class="interaction-hint" *ngIf="nearbyHotspot">
          <p>Click to {{ nearbyHotspot.label || 'interact' }}</p>
        </div>

        <button (click)="exitWalkthrough()" class="exit-btn">
          <i class="material-icons">close</i>
        </button>
      </div>

      <!-- Crosshair -->
      <div class="crosshair" *ngIf="controlsLocked"></div>

      <!-- Loading -->
      <div class="loading" *ngIf="loading">
        <div class="spinner"></div>
        <p>{{ loadingMessage }}</p>
      </div>
    </div>
  `,
  styles: [`
    .walkthrough-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100vh;
      background: #000;
      cursor: pointer;
    }

    .instructions {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.95);
      padding: 40px;
      border-radius: 12px;
      color: white;
      max-width: 500px;
      z-index: 1000;

      h2 {
        margin: 0 0 24px 0;
        font-size: 32px;
      }

      ul {
        list-style: none;
        padding: 0;
        margin: 0 0 32px 0;

        li {
          padding: 8px 0;
          font-size: 16px;

          strong {
            color: #00ff00;
          }
        }
      }
    }

    .start-btn {
      width: 100%;
      padding: 16px;
      background: #00ff00;
      color: #000;
      border: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: #00dd00;
        transform: translateY(-2px);
      }
    }

    .hud {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      padding: 20px;
      z-index: 100;
      pointer-events: none;
    }

    .hud > * {
      pointer-events: auto;
    }

    .scene-info {
      background: rgba(0, 0, 0, 0.8);
      padding: 16px 24px;
      border-radius: 8px;
      display: inline-block;

      h3 {
        margin: 0 0 4px 0;
        font-size: 24px;
        color: white;
      }

      .scene-type {
        color: #00ff00;
        font-size: 14px;
        text-transform: uppercase;
      }
    }

    .controls-hint {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      padding: 20px 40px;
      border-radius: 8px;

      p {
        margin: 0;
        color: white;
        font-size: 18px;
      }
    }

    .interaction-hint {
      position: absolute;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.2);

      p {
        margin: 0;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
      }
    }

    .exit-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      backdrop-filter: blur(10px);

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }

    .crosshair {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      pointer-events: none;
      z-index: 50;

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 4px;
        height: 4px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 50%;
      }
    }

    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: white;

      .spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-left-color: #00ff00;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }

      p {
        font-size: 16px;
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class WalkthroughViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef;

  projectId: string = '';
  currentScene: WalkthroughScene | null = null;
  scenes: WalkthroughScene[] = [];
  
  loading = false;
  loadingMessage = '';
  showInstructions = true;
  controlsLocked = false;
  nearbyHotspot: any = null;

  // Three.js objects
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: PointerLockControls;
  private animationId: number = 0;

  // Movement
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private readonly WALK_SPEED = 450.0;  // Units per second (increased for faster movement)
  private readonly PLAYER_HEIGHT = 1.7;  // Meters
  
  // Raycaster for interactions
  private raycaster = new THREE.Raycaster();
  private hotspotMeshes: THREE.Object3D[] = [];

  // Clock for delta time
  private clock = new THREE.Clock();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['projectId'];
      this.loadWalkthroughData();
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
    if (this.controls) {
      this.controls.disconnect();
    }
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    const containerEl = this.container?.nativeElement;
    if (containerEl) {
      containerEl.removeEventListener('click', this.onClickInteract);
    }
  }

  private initThreeJS() {
    const containerEl = this.container.nativeElement;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);  // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 0, 1000);

    // Camera (First-person perspective)
    this.camera = new THREE.PerspectiveCamera(
      75,
      containerEl.clientWidth / containerEl.clientHeight,
      0.1,
      2000
    );
    this.camera.position.y = this.PLAYER_HEIGHT;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    containerEl.appendChild(this.renderer.domElement);

    // Pointer Lock Controls for FPS-style movement
    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);

    this.controls.addEventListener('lock', () => {
      this.controlsLocked = true;
      this.showInstructions = false;
    });

    this.controls.addEventListener('unlock', () => {
      this.controlsLocked = false;
    });

    // Lighting
    this.setupLighting();

    // Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    // Click to interact with hotspot in center of view
    containerEl.addEventListener('click', this.onClickInteract);

    // Start animation
    this.animate();
  }

  private setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    this.scene.add(sunLight);
  }

  private async loadWalkthroughData() {
    try {
      this.loading = true;
      this.loadingMessage = 'Loading walkthrough data...';

      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `http://localhost:3000/api/virtual-tour/projects/${this.projectId}/tour-data`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to load walkthrough data');

      const data = await response.json();
      
      // Convert rooms to scenes
      this.scenes = data.rooms.map((room: any) => ({
        id: room.id,
        type: room.metadata?.scene_type || 'interior',
        name: room.name,
        panorama_path: room.panorama_url,
        point_cloud_path: room.metadata?.reconstruction?.point_cloud_path,
        model_path: room.metadata?.reconstruction?.mesh_path,
        walkable_area: room.metadata?.reconstruction?.walkable_area,
        entry_points: room.hotspots?.map((h: any) => ({
          position: { x: h.coordinates_x, y: h.coordinates_y, z: h.coordinates_z },
          rotation: h.rotation_y,
          target_scene_id: h.target_room_id,
          label: h.label
        }))
      }));

      // Load first scene (exterior if available, otherwise first interior)
      const exteriorScene = this.scenes.find(s => s.type === 'exterior');
      this.currentScene = exteriorScene || this.scenes[0];

      if (this.currentScene) {
        await this.loadScene(this.currentScene);
      }

      this.loading = false;

    } catch (error) {
      console.error('Error loading walkthrough:', error);
      this.toastr.error('Failed to load walkthrough');
      this.loading = false;
    }
  }

  private async loadScene(scene: WalkthroughScene) {
    try {
      this.loading = true;
      this.loadingMessage = `Loading ${scene.name}...`;

      // Clear existing scene objects
      this.clearScene();

      if (scene.type === 'exterior' && scene.model_path) {
        // Load 3D model for exterior
        await this.load3DModel(scene.model_path);
        
      } else if (scene.type === 'interior' && scene.panorama_path) {
        // Load 360° panorama for interior
        await this.loadPanorama(scene.panorama_path);
      }

      // Load entry point hotspots
      if (scene.entry_points) {
        this.createHotspots(scene.entry_points);
      }

      this.loading = false;
      console.log(`✅ Loaded scene: ${scene.name} (${scene.type})`);

    } catch (error) {
      console.error('Error loading scene:', error);
      this.loading = false;
    }
  }

  private async load3DModel(modelPath: string) {
    const loader = new PLYLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        `http://localhost:3000/api/files/${modelPath}`,
        (geometry) => {
          const material = new THREE.PointsMaterial({ 
            size: 0.05, 
            vertexColors: true 
          });
          
          const pointCloud = new THREE.Points(geometry, material);
          this.scene.add(pointCloud);
          
          // Add ground plane
          this.addGroundPlane();
          
          resolve(pointCloud);
        },
        undefined,
        reject
      );
    });
  }

  private async loadPanorama(panoramaUrl: string) {
    const loader = new THREE.TextureLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        panoramaUrl,
        (texture) => {
          const geometry = new THREE.SphereGeometry(500, 60, 40);
          geometry.scale(-1, 1, 1);
          
          const material = new THREE.MeshBasicMaterial({ map: texture });
          const sphere = new THREE.Mesh(geometry, material);
          
          this.scene.add(sphere);
          resolve(sphere);
        },
        undefined,
        reject
      );
    });
  }

  private addGroundPlane() {
    const geometry = new THREE.PlaneGeometry(1000, 1000);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x808080,
      roughness: 0.8
    });
    
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    
    this.scene.add(ground);
  }

  private createHotspots(entryPoints: any[]) {
    this.hotspotMeshes = [];

    entryPoints.forEach(entry => {
      // Create a white circular quad with an upward arrow sprite to match desired design
      const size = 0.7;
      // Vertical plane so full surface is clickable from the camera
      const geometry = new THREE.PlaneGeometry(size, size);

      // Create a canvas-based texture for a white circle with blue arrow
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 256);
      // Outer circle shadow
      ctx.shadowColor = 'rgba(0,0,0,0.25)';
      ctx.shadowBlur = 16;
      // White circle
      ctx.beginPath();
      ctx.arc(128, 128, 110, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      // Border
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
      // Upward arrow
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#2196F3';
      ctx.beginPath();
      ctx.moveTo(128, 72); // tip
      ctx.lineTo(178, 132);
      ctx.lineTo(148, 132);
      ctx.lineTo(148, 184);
      ctx.lineTo(108, 184);
      ctx.lineTo(108, 132);
      ctx.lineTo(78, 132);
      ctx.closePath();
      ctx.fill();

      const texture = new THREE.CanvasTexture(canvas);
      texture.anisotropy = 8;
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });

      const hotspot = new THREE.Mesh(geometry, material);
      hotspot.position.set(0, 0, 0);
      // Face the camera: add to a group positioned at the entry point and billboard each frame
      const group = new THREE.Group();
      group.position.set(entry.position.x, 1.2, entry.position.z);
      group.add(hotspot);
      group.userData = entry;
      this.scene.add(group);
      this.hotspotMeshes.push(group);
    });
  }

  private clearScene() {
    // Remove all objects except camera and lights
    const objectsToRemove: THREE.Object3D[] = [];
    this.scene.traverse((object) => {
      if (object !== this.scene && 
          !(object instanceof THREE.Light) && 
          object !== this.camera) {
        objectsToRemove.push(object);
      }
    });

    objectsToRemove.forEach(obj => {
      this.scene.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(mat => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.hotspotMeshes = [];
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();

    if (this.controlsLocked && this.controls.isLocked) {
      // Update movement
      this.velocity.x -= this.velocity.x * 10.0 * delta;
      this.velocity.z -= this.velocity.z * 10.0 * delta;

      this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
      this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
      this.direction.normalize();

      if (this.moveForward || this.moveBackward) {
        this.velocity.z -= this.direction.z * this.WALK_SPEED * delta;
      }
      if (this.moveLeft || this.moveRight) {
        this.velocity.x -= this.direction.x * this.WALK_SPEED * delta;
      }

      this.controls.moveRight(-this.velocity.x * delta);
      this.controls.moveForward(-this.velocity.z * delta);

      // Keep camera at player height
      this.camera.position.y = this.PLAYER_HEIGHT;

      // Check for nearby hotspots
      this.checkNearbyHotspots();

      // Make hotspot icons billboard to face camera
      this.hotspotMeshes.forEach(obj => {
        obj.lookAt(this.camera.position.x, obj.position.y, this.camera.position.z);
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  private checkNearbyHotspots() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    // Intersect children meshes inside groups for accurate hit testing
    const intersectTargets: THREE.Object3D[] = [];
    this.hotspotMeshes.forEach(obj => {
      if ((obj as THREE.Group).children?.length) {
        intersectTargets.push(...(obj as THREE.Group).children);
      } else {
        intersectTargets.push(obj);
      }
    });
    const intersects = this.raycaster.intersectObjects(intersectTargets, true);

    if (intersects.length > 0 && intersects[0].distance < 4) {
      // If we hit the child mesh, read data from its parent group
      const obj = intersects[0].object;
      const parent = obj.parent as THREE.Object3D;
      this.nearbyHotspot = (parent && parent.userData && Object.keys(parent.userData).length)
        ? parent.userData
        : obj.userData;
    } else {
      this.nearbyHotspot = null;
    }
  }

  private onKeyDown = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
    }
  };

  // Click handler to interact with the hotspot currently centered
  private onClickInteract = (event: MouseEvent) => {
    // Only when controls are locked (user is in walkthrough)
    if (!this.controlsLocked) return;
    if (this.nearbyHotspot && this.nearbyHotspot.target_scene_id) {
      this.transitionToScene(this.nearbyHotspot.target_scene_id);
    }
  }

  private onKeyUp = (event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
    }
  };

  private onWindowResize = () => {
    const containerEl = this.container.nativeElement;
    this.camera.aspect = containerEl.clientWidth / containerEl.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
  };

  startWalkthrough() {
    this.controls.lock();
  }

  async transitionToScene(sceneId: string) {
    const targetScene = this.scenes.find(s => s.id === sceneId);
    if (targetScene) {
      this.currentScene = targetScene;
      await this.loadScene(targetScene);
      this.toastr.info(`Entered ${targetScene.name}`);
    }
  }

  exitWalkthrough() {
    this.router.navigate(['/projects']);
  }
}
