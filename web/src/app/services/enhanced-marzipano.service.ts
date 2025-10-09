import { Injectable } from '@angular/core';
import * as Marzipano from 'marzipano';

export interface MarzipanoScene {
  id: string;
  name: string;
  panoramaUrl: string;
  initialViewParameters: {
    yaw: number;
    pitch: number;
    fov: number;
  };
  linkHotspots: MarzipanoHotspot[];
  infoHotspots: MarzipanoInfoHotspot[];
}

export interface MarzipanoHotspot {
  id: string;
  yaw: number;
  pitch: number;
  target: string;
  title: string;
  rotation?: number;
}

export interface MarzipanoInfoHotspot {
  id: string;
  yaw: number;
  pitch: number;
  title: string;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class EnhancedMarzipanoService {
  private viewer: any = null;
  private scenes: Map<string, any> = new Map();
  private currentScene: any = null;

  constructor() {}

  /**
   * Initialize Marzipano viewer with enhanced features
   */
  initializeViewer(containerElement: HTMLElement, options?: any): any {
    const defaultOptions = {
      controls: {
        mouseViewMode: Marzipano.Viewer.ControlType.FULLSCREEN,
        touchAction: 'pan-y zoom-pinch'
      }
    };

    const viewerOptions = { ...defaultOptions, ...options };
    this.viewer = new Marzipano.Viewer(containerElement, viewerOptions);

    // Register default controls
    Marzipano.registerDefaultControls(this.viewer);

    return this.viewer;
  }

  /**
   * Create a scene with multi-resolution support
   */
  createScene(sceneData: MarzipanoScene): any {
    if (!this.viewer) {
      throw new Error('Viewer not initialized. Call initializeViewer() first.');
    }

    // Create multi-resolution source
    const source = Marzipano.ImageUrlSource.fromString(
      sceneData.panoramaUrl,
      {
        cubeMapPreviewUrl: sceneData.panoramaUrl.replace('.jpg', '_preview.jpg'),
        cubeMapPreviewFaceOrder: 'pyzxnr'
      }
    );

    // Create equirectangular geometry with multiple levels
    const geometry = new Marzipano.EquirectGeometry([
      { tileSize: 256, size: 256, fallbackOnly: true },
      { tileSize: 512, size: 512 },
      { tileSize: 1024, size: 1024 },
      { tileSize: 2048, size: 2048 }
    ]);

    // Create view with limiter
    const limiter = Marzipano.RectilinearView.limit.traditional(
      4096, 
      100 * Math.PI / 180, 
      120 * Math.PI / 180
    );
    const view = new Marzipano.RectilinearView(
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

    // Add hotspots
    this.addHotspotsToScene(scene, sceneData);

    // Store scene
    this.scenes.set(sceneData.id, {
      data: sceneData,
      scene: scene,
      view: view
    });

    return scene;
  }

  /**
   * Add hotspots to scene
   */
  private addHotspotsToScene(scene: any, sceneData: MarzipanoScene): void {
    // Add link hotspots
    sceneData.linkHotspots.forEach(hotspot => {
      const element = this.createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch
      });
    });

    // Add info hotspots
    sceneData.infoHotspots.forEach(hotspot => {
      const element = this.createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch
      });
    });
  }

  /**
   * Create link hotspot element
   */
  private createLinkHotspotElement(hotspot: MarzipanoHotspot): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'link-hotspot');
    wrapper.setAttribute('data-hotspot-id', hotspot.id);

    // Create icon
    const icon = document.createElement('div');
    icon.classList.add('link-hotspot-icon');
    icon.innerHTML = '→';
    
    // Set rotation if specified
    if (hotspot.rotation) {
      icon.style.transform = `rotate(${hotspot.rotation}rad)`;
    }

    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip', 'link-hotspot-tooltip');
    tooltip.textContent = hotspot.title;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    // Add click handler
    wrapper.addEventListener('click', (event) => {
      event.stopPropagation();
      this.switchToScene(hotspot.target);
    });

    return wrapper;
  }

  /**
   * Create info hotspot element
   */
  private createInfoHotspotElement(hotspot: MarzipanoInfoHotspot): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'info-hotspot');
    wrapper.setAttribute('data-hotspot-id', hotspot.id);

    // Create header
    const header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    const icon = document.createElement('div');
    icon.classList.add('info-hotspot-icon');
    icon.innerHTML = 'ℹ';

    const title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.textContent = hotspot.title;

    const close = document.createElement('div');
    close.classList.add('info-hotspot-close');
    close.innerHTML = '×';

    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(close);

    // Create content
    const content = document.createElement('div');
    content.classList.add('info-hotspot-content');
    content.textContent = hotspot.text;

    wrapper.appendChild(header);
    wrapper.appendChild(content);

    // Add click handlers
    header.addEventListener('click', () => {
      wrapper.classList.toggle('visible');
    });

    close.addEventListener('click', (event) => {
      event.stopPropagation();
      wrapper.classList.remove('visible');
    });

    return wrapper;
  }

  /**
   * Switch to a specific scene
   */
  switchToScene(sceneId: string): void {
    const sceneData = this.scenes.get(sceneId);
    if (!sceneData) {
      console.error(`Scene ${sceneId} not found`);
      return;
    }

    // Reset view parameters
    sceneData.view.setParameters(sceneData.data.initialViewParameters);
    
    // Switch scene
    sceneData.scene.switchTo();
    this.currentScene = sceneData;

    // Emit scene change event
    this.viewer.dispatchEvent('scenechange', { sceneId });
  }

  /**
   * Get current scene
   */
  getCurrentScene(): any {
    return this.currentScene;
  }

  /**
   * Start autorotation
   */
  startAutorotate(options?: any): void {
    const defaultOptions = {
      yawSpeed: 0.03,
      targetPitch: 0,
      targetFov: Math.PI / 2
    };

    const autorotateOptions = { ...defaultOptions, ...options };
    const autorotate = Marzipano.autorotate(autorotateOptions);
    
    this.viewer.startMovement(autorotate);
    this.viewer.setIdleMovement(3000, autorotate);
  }

  /**
   * Stop autorotation
   */
  stopAutorotate(): void {
    this.viewer.stopMovement();
    this.viewer.setIdleMovement(Infinity);
  }

  /**
   * Enable VR mode (WebXR)
   */
  enableVR(): void {
    if (this.viewer && this.viewer.vr && this.viewer.vr.isSupported()) {
      this.viewer.vr.start();
    }
  }

  /**
   * Disable VR mode
   */
  disableVR(): void {
    if (this.viewer && this.viewer.vr) {
      this.viewer.vr.stop();
    }
  }

  /**
   * Get viewer instance
   */
  getViewer(): any {
    return this.viewer;
  }

  /**
   * Destroy viewer and cleanup
   */
  destroy(): void {
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
    this.scenes.clear();
    this.currentScene = null;
  }
}
