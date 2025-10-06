import { Injectable, ElementRef } from '@angular/core';
import * as THREE from 'three';

export interface ViewParameters {
  yaw: number;    // Horizontal rotation (0 to 2π)
  pitch: number;  // Vertical rotation (-π/2 to π/2)
  fov: number;    // Field of view (0.1 to π)
}

export interface Hotspot {
  id: string;
  type: 'link' | 'info';
  yaw: number;
  pitch: number;
  rotation?: number;
  title?: string;
  text?: string;
  target?: string; // For link hotspots
  element?: HTMLElement;
}

export interface Scene {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  levels: Array<{ width: number; tileSize?: number }>;
  initialViewParameters: ViewParameters;
  linkHotspots: Hotspot[];
  infoHotspots: Hotspot[];
}

@Injectable({
  providedIn: 'root'
})
export class MarzipanoViewerService {
  private viewer: any = null;
  private scenes: Map<string, any> = new Map();
  private currentScene: any = null;
  private container: HTMLElement | null = null;

  constructor() { }

  /**
   * Initialize the Marzipano-style viewer
   */
  initialize(container: HTMLElement): void {
    this.container = container;
    this.viewer = this.createViewer(container);
  }

  /**
   * Create the main viewer instance
   */
  private createViewer(container: HTMLElement): any {
    // Create a simple WebGL-based viewer similar to Marzipano
    const viewer = {
      container: container,
      scenes: new Map(),
      currentScene: null,
      controls: this.createControls(),
      renderer: this.createRenderer(container),
      camera: this.createCamera(),
      scene: new THREE.Scene(),
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      
      // Marzipano-style methods
      createScene: (opts: any) => this.createScene(viewer, opts),
      switchScene: (scene: any) => this.switchScene(viewer, scene),
      lookTo: (params: ViewParameters) => this.lookTo(viewer, params),
      destroy: () => {
        viewer.scenes.forEach((scene: any) => scene.destroy());
        viewer.renderer.dispose();
        if (viewer.container) {
          viewer.container.innerHTML = '';
        }
      }
    };

    this.setupEventListeners(viewer);
    this.animate(viewer);
    
    return viewer;
  }

  /**
   * Create WebGL renderer
   */
  private createRenderer(container: HTMLElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    return renderer;
  }

  /**
   * Create perspective camera
   */
  private createCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      75, // fov
      window.innerWidth / window.innerHeight, // aspect
      0.1, // near
      1000 // far
    );
    return camera;
  }

  /**
   * Create controls similar to Marzipano
   */
  private createControls(): any {
    const controls = {
      enabled: true,
      mouseViewMode: 'drag',
      velocity: 0.7,
      friction: 3,
      isMouseDown: false,
      lastMouseX: 0,
      lastMouseY: 0,
      
      // Marzipano-style control methods
      enable: () => { controls.enabled = true; },
      disable: () => { controls.enabled = false; }
    };
    return controls;
  }

  /**
   * Create a scene with equirectangular geometry
   */
  createScene(viewer: any, opts: any): any {
    const scene = {
      id: opts.id || 'scene_' + Date.now(),
      name: opts.name || 'Untitled Scene',
      geometry: this.createEquirectGeometry(opts.levels || [{ width: 2048 }]),
      material: this.createEquirectMaterial(opts.imageUrl),
      mesh: null,
      hotspotContainer: this.createHotspotContainer(viewer),
      view: this.createView(opts.initialViewParameters || { yaw: 0, pitch: 0, fov: Math.PI / 2 }),
      
      // Marzipano-style methods
      switchTo: () => this.switchScene(viewer, scene),
      lookTo: (params: ViewParameters) => this.lookTo(viewer, params),
      createHotspot: (element: HTMLElement, coords: any) => this.createHotspot(scene, element, coords),
      destroy: () => this.destroyScene(scene)
    };

    // Create the sphere mesh for equirectangular projection
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // Invert the sphere
    
    scene.material = new THREE.MeshBasicMaterial({
      map: new THREE.TextureLoader().load(opts.imageUrl),
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, scene.material);
    mesh.userData = { scene: scene };
    (scene as any).mesh = mesh;
    
    viewer.scenes.set(scene.id, scene);
    return scene;
  }

  /**
   * Create equirectangular geometry similar to Marzipano
   */
  private createEquirectGeometry(levels: Array<{ width: number }>): any {
    return {
      levels: levels,
      maxLevel: Math.max(...levels.map(l => l.width)),
      type: 'equirect'
    };
  }

  /**
   * Create equirectangular material
   */
  private createEquirectMaterial(imageUrl: string): THREE.MeshBasicMaterial {
    const texture = new THREE.TextureLoader().load(imageUrl);
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide
    });
  }

  /**
   * Create view with Marzipano-style parameters
   */
  private createView(initialParams: ViewParameters): any {
    return {
      parameters: () => initialParams,
      setParameters: (params: ViewParameters) => {
        Object.assign(initialParams, params);
      },
      lookTo: (params: ViewParameters) => {
        // Smooth transition to new view parameters
        this.animateToView(initialParams, params);
      }
    };
  }

  /**
   * Create hotspot container
   */
  private createHotspotContainer(viewer: any): any {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    
    viewer.container.appendChild(container);
    
    return {
      domElement: () => container,
      createHotspot: (element: HTMLElement, coords: any) => this.createHotspot(null, element, coords),
      destroy: () => {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }
    };
  }

  /**
   * Switch to a different scene
   */
  switchScene(viewer: any, newScene: any): void {
    if (viewer.currentScene) {
      viewer.scene.remove(viewer.currentScene.mesh);
    }
    
    viewer.scene.add(newScene.mesh);
    viewer.currentScene = newScene;
    
    // Set initial view parameters
    if (newScene.view) {
      const params = newScene.view.parameters();
      this.setViewParameters(viewer, params);
    }
  }

  /**
   * Look to specific view parameters
   */
  lookTo(viewer: any, params: ViewParameters): void {
    this.setViewParameters(viewer, params);
  }

  /**
   * Set view parameters on the camera
   */
  private setViewParameters(viewer: any, params: ViewParameters): void {
    // Convert Marzipano coordinates to Three.js camera rotation
    const yaw = params.yaw || 0;
    const pitch = params.pitch || 0;
    const fov = params.fov || Math.PI / 2;
    
    // Apply yaw rotation (around Y axis)
    viewer.camera.rotation.y = yaw;
    
    // Apply pitch rotation (around X axis)
    viewer.camera.rotation.x = pitch;
    
    // Apply field of view
    viewer.camera.fov = (fov * 180) / Math.PI;
    viewer.camera.updateProjectionMatrix();
  }

  /**
   * Create a hotspot
   */
  createHotspot(scene: any, element: HTMLElement, coords: any): any {
    element.style.position = 'absolute';
    element.style.pointerEvents = 'auto';
    
    const hotspot = {
      element: element,
      coords: coords,
      update: () => this.updateHotspotPosition(hotspot, scene)
    };
    
    // Add to hotspot container
    if (scene && scene.hotspotContainer) {
      scene.hotspotContainer.domElement().appendChild(element);
    }
    
    return hotspot;
  }

  /**
   * Update hotspot position based on view
   */
  private updateHotspotPosition(hotspot: any, scene: any): void {
    // Convert spherical coordinates to screen coordinates
    const coords = hotspot.coords;
    const yaw = coords.yaw || 0;
    const pitch = coords.pitch || 0;
    
    // Simple projection for now (can be improved with proper spherical math)
    const x = (yaw / (2 * Math.PI)) * this.container!.clientWidth;
    const y = (pitch / Math.PI + 0.5) * this.container!.clientHeight;
    
    hotspot.element.style.left = x + 'px';
    hotspot.element.style.top = y + 'px';
  }

  /**
   * Setup event listeners for controls
   */
  private setupEventListeners(viewer: any): void {
    const canvas = viewer.renderer.domElement;
    
    // Mouse controls
    canvas.addEventListener('mousedown', (event: MouseEvent) => {
      if (!viewer.controls.enabled) return;
      
      viewer.controls.isMouseDown = true;
      viewer.controls.lastMouseX = event.clientX;
      viewer.controls.lastMouseY = event.clientY;
    });
    
    canvas.addEventListener('mousemove', (event: MouseEvent) => {
      if (!viewer.controls.enabled || !viewer.controls.isMouseDown) return;
      
      const deltaX = event.clientX - viewer.controls.lastMouseX;
      const deltaY = event.clientY - viewer.controls.lastMouseY;
      
      // Apply rotation based on mouse movement
      viewer.camera.rotation.y -= deltaX * 0.01;
      viewer.camera.rotation.x -= deltaY * 0.01;
      
      viewer.controls.lastMouseX = event.clientX;
      viewer.controls.lastMouseY = event.clientY;
    });
    
    canvas.addEventListener('mouseup', () => {
      viewer.controls.isMouseDown = false;
    });
    
    // Wheel zoom
    canvas.addEventListener('wheel', (event: WheelEvent) => {
      if (!viewer.controls.enabled) return;
      
      event.preventDefault();
      viewer.camera.fov += event.deltaY * 0.01;
      viewer.camera.fov = Math.max(10, Math.min(120, viewer.camera.fov));
      viewer.camera.updateProjectionMatrix();
    });
    
    // Window resize
    window.addEventListener('resize', () => {
      const width = viewer.container.clientWidth;
      const height = viewer.container.clientHeight;
      
      viewer.camera.aspect = width / height;
      viewer.camera.updateProjectionMatrix();
      viewer.renderer.setSize(width, height);
    });
  }

  /**
   * Animation loop
   */
  private animate(viewer: any): void {
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update hotspots
      if (viewer.currentScene && viewer.currentScene.hotspotContainer) {
        this.updateAllHotspots(viewer.currentScene);
      }
      
      viewer.renderer.render(viewer.scene, viewer.camera);
    };
    
    animate();
  }

  /**
   * Update all hotspots in a scene
   */
  private updateAllHotspots(scene: any): void {
    // This would update all hotspots based on current view
    // Implementation depends on how hotspots are stored
  }

  /**
   * Animate to view parameters
   */
  private animateToView(current: ViewParameters, target: ViewParameters): void {
    // Simple linear interpolation for now
    // Can be enhanced with easing functions
    const duration = 1000; // ms
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const yaw = current.yaw + (target.yaw - current.yaw) * progress;
      const pitch = current.pitch + (target.pitch - current.pitch) * progress;
      const fov = current.fov + (target.fov - current.fov) * progress;
      
      this.setViewParameters(this.viewer, { yaw, pitch, fov });
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  /**
   * Destroy scene
   */
  private destroyScene(scene: any): void {
    if (scene.mesh) {
      this.viewer.scene.remove(scene.mesh);
    }
    if (scene.hotspotContainer) {
      scene.hotspotContainer.destroy();
    }
  }

  /**
   * Public API methods
   */
  
  public addScene(sceneData: Scene): any {
    if (!this.viewer) {
      throw new Error('Viewer not initialized');
    }
    
    return this.viewer.createScene({
      id: sceneData.id,
      name: sceneData.name,
      imageUrl: sceneData.imageUrl,
      levels: sceneData.levels,
      initialViewParameters: sceneData.initialViewParameters
    });
  }

  public switchToScene(sceneId: string): void {
    const scene = this.scenes.get(sceneId);
    if (scene && this.viewer) {
      this.viewer.switchScene(scene);
    }
  }

  public lookToView(params: ViewParameters): void {
    if (this.viewer) {
      this.viewer.lookTo(params);
    }
  }

  public createLinkHotspot(scene: any, hotspotData: Hotspot): HTMLElement {
    const element = document.createElement('div');
    element.className = 'hotspot link-hotspot';
    element.innerHTML = `
      <img src="assets/icons/link.png" class="hotspot-icon" />
      <div class="hotspot-tooltip">${hotspotData.title || 'Link'}</div>
    `;
    
    // Add click handler
    element.addEventListener('click', () => {
      if (hotspotData.target) {
        this.switchToScene(hotspotData.target);
      }
    });
    
    scene.hotspotContainer.createHotspot(element, {
      yaw: hotspotData.yaw,
      pitch: hotspotData.pitch,
      rotation: hotspotData.rotation || 0
    });
    
    return element;
  }

  public createInfoHotspot(scene: any, hotspotData: Hotspot): HTMLElement {
    const element = document.createElement('div');
    element.className = 'hotspot info-hotspot';
    element.innerHTML = `
      <div class="hotspot-header">
        <img src="assets/icons/info.png" class="hotspot-icon" />
        <div class="hotspot-title">${hotspotData.title || 'Info'}</div>
        <img src="assets/icons/close.png" class="hotspot-close" />
      </div>
      <div class="hotspot-content" style="display: none;">
        <div class="hotspot-text">${hotspotData.text || ''}</div>
      </div>
    `;
    
    // Add click handler
    element.addEventListener('click', (e) => {
      e.stopPropagation();
      const content = element.querySelector('.hotspot-content') as HTMLElement;
      content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });
    
    scene.hotspotContainer.createHotspot(element, {
      yaw: hotspotData.yaw,
      pitch: hotspotData.pitch
    });
    
    return element;
  }

  public destroy(): void {
    if (this.viewer) {
      this.viewer.scenes.forEach((scene: any) => scene.destroy());
      this.viewer.renderer.dispose();
      if (this.viewer.container) {
        this.viewer.container.innerHTML = '';
      }
      this.viewer = null;
    }
  }
}
