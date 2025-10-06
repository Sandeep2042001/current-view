import { Injectable, NgZone } from '@angular/core';

export interface ViewParameters {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface Hotspot {
  id: string;
  yaw: number;
  pitch: number;
  type: 'link' | 'info';
  title: string;
  text?: string;
  target?: string; // For link hotspots
  element?: HTMLElement;
  roomLabel?: string;
  distance?: number;
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
  roomInfo?: {
    dimensions?: { width: number; height: number; depth: number };
    floorArea?: number;
    volume?: number;
    features?: string[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedMarzipanoViewerService {
  private viewer: any = null;
  private scenes: Map<string, any> = new Map();
  private currentScene: any = null;
  private isTransitioning = false;
  private transitionDuration = 1500; // milliseconds
  private autoRotateEnabled = false;
  private autoRotateSpeed = 0.02; // radians per frame
  private autoRotateInterval: any = null;

  constructor(private ngZone: NgZone) {}

  /**
   * Initialize enhanced viewer with smooth transitions
   */
  initializeViewer(container: HTMLElement, scenes: Scene[], initialSceneId: string): void {
    this.ngZone.runOutsideAngular(() => {
      // Create viewer with enhanced options
      const viewerOptions = {
        controls: {
          mouseViewMode: 'drag',
          scrollZoom: true,
          dragSpeed: 0.7,
          scrollSpeed: 0.1,
          friction: 0.8,
          enableKeyboard: true
        },
        stage: {
          preserveDrawingBuffer: true,
          antialias: true
        }
      };

      this.viewer = new (window as any).Marzipano.Viewer(container, viewerOptions);
      
      // Create scenes
      this.createScenes(scenes);
      
      // Set initial scene
      if (initialSceneId && this.scenes.has(initialSceneId)) {
        this.switchToScene(initialSceneId);
      }

      // Setup enhanced event listeners
      this.setupEventListeners();
    });
  }

  /**
   * Create scenes with enhanced features
   */
  private createScenes(scenes: Scene[]): void {
    scenes.forEach(sceneData => {
      const scene = this.createScene(sceneData);
      this.scenes.set(sceneData.id, scene);
    });
  }

  /**
   * Create individual scene with enhanced features
   */
  private createScene(sceneData: Scene): any {
    const source = (window as any).Marzipano.ImageUrlSource.fromString(sceneData.imageUrl);
    
    // Create geometry with multiple levels for better performance
    const geometry = new (window as any).Marzipano.EquirectGeometry(sceneData.levels);
    
    // Create view with enhanced controls
    const limiter = (window as any).Marzipano.RectilinearView.limit.traditional(
      sceneData.levels[0].width, 
      100 * Math.PI / 180, 
      120 * Math.PI / 180
    );
    
    const view = new (window as any).Marzipano.RectilinearView(
      sceneData.initialViewParameters, 
      limiter
    );

    // Create scene
    const scene = this.viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Add enhanced hotspots
    this.addEnhancedHotspots(scene, sceneData);

    return scene;
  }

  /**
   * Add enhanced hotspots with smooth animations
   */
  private addEnhancedHotspots(scene: any, sceneData: Scene): void {
    // Add link hotspots
    sceneData.linkHotspots.forEach(hotspotData => {
      const element = this.createEnhancedLinkHotspot(hotspotData, sceneData);
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspotData.yaw,
        pitch: hotspotData.pitch
      });
    });

    // Add info hotspots
    sceneData.infoHotspots.forEach(hotspotData => {
      const element = this.createEnhancedInfoHotspot(hotspotData, sceneData);
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspotData.yaw,
        pitch: hotspotData.pitch
      });
    });
  }

  /**
   * Create enhanced link hotspot with animations
   */
  private createEnhancedLinkHotspot(hotspotData: Hotspot, sceneData: Scene): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-hotspot link-hotspot';
    wrapper.innerHTML = `
      <div class="hotspot-icon">
        <i class="material-icons">arrow_forward</i>
        <div class="pulse-ring"></div>
      </div>
      <div class="hotspot-tooltip">
        <div class="tooltip-title">${hotspotData.title}</div>
        ${hotspotData.roomLabel ? `<div class="room-label">${hotspotData.roomLabel}</div>` : ''}
        ${hotspotData.distance ? `<div class="distance">${hotspotData.distance}m away</div>` : ''}
        <div class="tooltip-arrow">Click to enter</div>
      </div>
    `;

    // Add click handler with smooth transition
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hotspotData.target && !this.isTransitioning) {
        this.switchToSceneWithTransition(hotspotData.target);
      }
    });

    // Add hover effects
    wrapper.addEventListener('mouseenter', () => {
      wrapper.classList.add('hover');
    });

    wrapper.addEventListener('mouseleave', () => {
      wrapper.classList.remove('hover');
    });

    return wrapper;
  }

  /**
   * Create enhanced info hotspot with rich content
   */
  private createEnhancedInfoHotspot(hotspotData: Hotspot, sceneData: Scene): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-hotspot info-hotspot';
    wrapper.innerHTML = `
      <div class="hotspot-icon">
        <i class="material-icons">info</i>
        <div class="info-glow"></div>
      </div>
      <div class="hotspot-tooltip">
        <div class="tooltip-title">${hotspotData.title}</div>
        <div class="tooltip-content">${hotspotData.text || ''}</div>
        <div class="tooltip-arrow">Click for details</div>
      </div>
      <div class="info-panel" style="display: none;">
        <div class="info-header">
          <h3>${hotspotData.title}</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="info-body">
          <p>${hotspotData.text || ''}</p>
          ${sceneData.roomInfo ? this.createRoomInfoContent(sceneData.roomInfo) : ''}
        </div>
      </div>
    `;

    // Add click handler for info panel
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      const infoPanel = wrapper.querySelector('.info-panel') as HTMLElement;
      const isVisible = infoPanel.style.display !== 'none';
      
      if (isVisible) {
        infoPanel.style.display = 'none';
        wrapper.classList.remove('active');
      } else {
        infoPanel.style.display = 'block';
        wrapper.classList.add('active');
      }
    });

    // Close button handler
    const closeBtn = wrapper.querySelector('.close-btn');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const infoPanel = wrapper.querySelector('.info-panel') as HTMLElement;
      infoPanel.style.display = 'none';
      wrapper.classList.remove('active');
    });

    return wrapper;
  }

  /**
   * Create room information content
   */
  private createRoomInfoContent(roomInfo: any): string {
    let content = '<div class="room-info">';
    
    if (roomInfo.dimensions) {
      content += `
        <div class="info-section">
          <h4>Dimensions</h4>
          <p>${roomInfo.dimensions.width}m × ${roomInfo.dimensions.depth}m × ${roomInfo.dimensions.height}m</p>
        </div>
      `;
    }
    
    if (roomInfo.floorArea) {
      content += `
        <div class="info-section">
          <h4>Floor Area</h4>
          <p>${roomInfo.floorArea}m²</p>
        </div>
      `;
    }
    
    if (roomInfo.volume) {
      content += `
        <div class="info-section">
          <h4>Volume</h4>
          <p>${roomInfo.volume}m³</p>
        </div>
      `;
    }
    
    if (roomInfo.features && roomInfo.features.length > 0) {
      content += `
        <div class="info-section">
          <h4>Features</h4>
          <ul>
            ${roomInfo.features.map(feature => `<li>${feature}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    content += '</div>';
    return content;
  }

  /**
   * Switch to scene with smooth transition
   */
  switchToSceneWithTransition(sceneId: string): void {
    if (this.isTransitioning || !this.scenes.has(sceneId)) {
      return;
    }

    this.isTransitioning = true;
    const targetScene = this.scenes.get(sceneId);

    // Get current view parameters
    const currentView = this.currentScene?.view().parameters();
    
    // Calculate transition parameters
    const transitionParams = this.calculateTransitionParameters(currentView, sceneId);

    // Start transition
    this.startTransition(targetScene, transitionParams);
  }

  /**
   * Calculate smooth transition parameters
   */
  private calculateTransitionParameters(currentView: ViewParameters, targetSceneId: string): ViewParameters {
    // In a real implementation, you'd calculate optimal viewing angle
    // For now, use a default view that looks forward
    return {
      yaw: 0,
      pitch: 0,
      fov: Math.PI / 2
    };
  }

  /**
   * Start smooth transition to target scene
   */
  private startTransition(targetScene: any, targetView: ViewParameters): void {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.transitionDuration, 1);
      
      // Easing function for smooth transition
      const easeProgress = this.easeInOutCubic(progress);
      
      if (progress < 1) {
        // Continue transition
        requestAnimationFrame(animate);
      } else {
        // Complete transition
        this.isTransitioning = false;
        this.currentScene = targetScene;
        this.viewer.switchScene(targetScene);
        this.viewer.lookTo(targetView);
      }
    };
    
    // Start animation
    requestAnimationFrame(animate);
  }

  /**
   * Easing function for smooth transitions
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Switch to scene immediately (without transition)
   */
  switchToScene(sceneId: string): void {
    if (this.scenes.has(sceneId)) {
      this.currentScene = this.scenes.get(sceneId);
      this.viewer.switchScene(this.currentScene);
    }
  }

  /**
   * Look to specific view parameters
   */
  lookTo(params: ViewParameters): void {
    if (this.currentScene) {
      this.currentScene.view().lookTo(params);
    }
  }

  /**
   * Get current view parameters
   */
  getCurrentView(): ViewParameters {
    if (this.currentScene) {
      return this.currentScene.view().parameters();
    }
    return { yaw: 0, pitch: 0, fov: Math.PI / 2 };
  }

  /**
   * Enable/disable auto-rotation
   */
  setAutoRotate(enabled: boolean): void {
    this.autoRotateEnabled = enabled;
    
    if (enabled) {
      this.startAutoRotate();
    } else {
      this.stopAutoRotate();
    }
  }

  /**
   * Start auto-rotation
   */
  private startAutoRotate(): void {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
    }
    
    this.autoRotateInterval = setInterval(() => {
      if (this.currentScene && !this.isTransitioning) {
        const currentView = this.getCurrentView();
        const newYaw = currentView.yaw + this.autoRotateSpeed;
        
        this.lookTo({
          yaw: newYaw,
          pitch: currentView.pitch,
          fov: currentView.fov
        });
      }
    }, 16); // ~60fps
  }

  /**
   * Stop auto-rotation
   */
  private stopAutoRotate(): void {
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
      this.autoRotateInterval = null;
    }
  }

  /**
   * Setup enhanced event listeners
   */
  private setupEventListeners(): void {
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (this.currentScene) {
        const currentView = this.getCurrentView();
        const speed = 0.1;
        
        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            this.lookTo({
              yaw: currentView.yaw - speed,
              pitch: currentView.pitch,
              fov: currentView.fov
            });
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.lookTo({
              yaw: currentView.yaw + speed,
              pitch: currentView.pitch,
              fov: currentView.fov
            });
            break;
          case 'ArrowUp':
            e.preventDefault();
            this.lookTo({
              yaw: currentView.yaw,
              pitch: Math.max(currentView.pitch - speed, -Math.PI / 2),
              fov: currentView.fov
            });
            break;
          case 'ArrowDown':
            e.preventDefault();
            this.lookTo({
              yaw: currentView.yaw,
              pitch: Math.min(currentView.pitch + speed, Math.PI / 2),
              fov: currentView.fov
            });
            break;
        }
      }
    });
  }

  /**
   * Get current scene
   */
  getCurrentScene(): any {
    return this.currentScene;
  }

  /**
   * Get all scenes
   */
  getScenes(): Map<string, any> {
    return this.scenes;
  }

  /**
   * Update scene data
   */
  updateScene(sceneId: string, sceneData: Scene): void {
    if (this.scenes.has(sceneId)) {
      const scene = this.createScene(sceneData);
      this.scenes.set(sceneId, scene);
      
      // If this is the current scene, switch to the updated version
      if (this.currentScene && this.currentScene.id === sceneId) {
        this.currentScene = scene;
        this.viewer.switchScene(scene);
      }
    }
  }

  /**
   * Add new scene
   */
  addScene(sceneData: Scene): void {
    const scene = this.createScene(sceneData);
    this.scenes.set(sceneData.id, scene);
  }

  /**
   * Remove scene
   */
  removeScene(sceneId: string): void {
    if (this.scenes.has(sceneId)) {
      this.scenes.delete(sceneId);
      
      // If this was the current scene, switch to first available scene
      if (this.currentScene && this.currentScene.id === sceneId) {
        const firstScene = this.scenes.values().next().value;
        if (firstScene) {
          this.switchToScene(firstScene.id);
        }
      }
    }
  }

  /**
   * Destroy viewer and cleanup
   */
  destroy(): void {
    this.stopAutoRotate();
    
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    
    this.scenes.clear();
    this.currentScene = null;
  }
}
