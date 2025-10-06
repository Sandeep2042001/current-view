import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarzipanoViewerService, Scene, Hotspot, ViewParameters } from '../../services/marzipano-viewer.service';

// Re-export interfaces for other components
export { Scene, Hotspot, ViewParameters };

@Component({
  selector: 'app-marzipano-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marzipano-viewer.component.html',
  styleUrls: ['./marzipano-viewer.component.scss']
})
export class MarzipanoViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) viewerContainer!: ElementRef;
  
  @Input() scenes: Scene[] = [];
  @Input() currentSceneId: string = '';
  @Input() showControls: boolean = true;
  @Input() autorotate: boolean = false;
  @Input() autorotateSpeed: number = 0.03;
  
  @Output() sceneChange = new EventEmitter<string>();
  @Output() viewChange = new EventEmitter<ViewParameters>();
  @Output() hotspotClick = new EventEmitter<Hotspot>();
  
  public viewer: any = null;
  private loadedScenes: Map<string, any> = new Map();
  private currentView: ViewParameters = { yaw: 0, pitch: 0, fov: Math.PI / 2 };
  private autorotateInterval: any = null;
  public showSceneList: boolean = false;
  public isFullscreen: boolean = false;
  public errorMessage: string = '';

  constructor(
    private marzipanoViewerService: MarzipanoViewerService
  ) { }

  ngOnInit(): void {
    // Initialize any required setup
  }

  ngAfterViewInit(): void {
    this.initializeViewer();
    this.loadScenes();
  }

  ngOnDestroy(): void {
    this.stopAutorotate();
    if (this.viewer) {
      this.marzipanoViewerService.destroy();
    }
  }

  /**
   * Initialize the Marzipano viewer
   */
  private initializeViewer(): void {
    try {
      this.marzipanoViewerService.initialize(this.viewerContainer.nativeElement);
      this.viewer = this.marzipanoViewerService;
      
      console.log('Marzipano viewer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Marzipano viewer:', error);
    }
  }

  /**
   * Load all scenes into the viewer
   */
  private loadScenes(): void {
    if (!this.viewer || !this.scenes.length) return;

    this.scenes.forEach(sceneData => {
      try {
        const scene = this.viewer.addScene(sceneData);
        this.loadedScenes.set(sceneData.id, scene);
        
        // Create hotspots for this scene
        this.createSceneHotspots(scene, sceneData);
        
        console.log(`Scene loaded: ${sceneData.name}`);
      } catch (error) {
        console.error(`Failed to load scene ${sceneData.name}:`, error);
      }
    });

    // Switch to current scene if specified
    if (this.currentSceneId) {
      this.switchToScene(this.currentSceneId);
    } else if (this.scenes.length > 0) {
      this.switchToScene(this.scenes[0].id);
    }
  }

  /**
   * Create hotspots for a scene
   */
  private createSceneHotspots(scene: any, sceneData: Scene): void {
    // Create link hotspots
    sceneData.linkHotspots.forEach(hotspotData => {
      this.viewer.createLinkHotspot(scene, hotspotData);
    });

    // Create info hotspots
    sceneData.infoHotspots.forEach(hotspotData => {
      this.viewer.createInfoHotspot(scene, hotspotData);
    });
  }

  /**
   * Switch to a different scene
   */
  switchToScene(sceneId: string): void {
    if (!this.viewer) return;

    const scene = this.loadedScenes.get(sceneId);
    if (scene) {
      this.viewer.switchToScene(sceneId);
      this.currentSceneId = sceneId;
      this.sceneChange.emit(sceneId);
      
      // Set autorotate if enabled
      if (this.autorotate) {
        this.startAutorotate();
      }
      
      console.log(`Switched to scene: ${sceneId}`);
    }
  }

  /**
   * Look to specific view parameters
   */
  lookTo(params: ViewParameters): void {
    if (this.viewer) {
      this.viewer.lookToView(params);
      this.currentView = params;
      this.viewChange.emit(params);
    }
  }

  /**
   * Start autorotation
   */
  startAutorotate(): void {
    this.stopAutorotate();
    
    if (this.autorotate && this.viewer) {
      this.autorotateInterval = setInterval(() => {
        this.currentView.yaw += this.autorotateSpeed;
        this.lookTo(this.currentView);
      }, 16); // ~60fps
    }
  }

  /**
   * Stop autorotation
   */
  stopAutorotate(): void {
    if (this.autorotateInterval) {
      clearInterval(this.autorotateInterval);
      this.autorotateInterval = null;
    }
  }

  /**
   * Toggle autorotation
   */
  toggleAutorotate(): void {
    this.autorotate = !this.autorotate;
    
    if (this.autorotate) {
      this.startAutorotate();
    } else {
      this.stopAutorotate();
    }
  }

  /**
   * Reset view to initial parameters
   */
  resetView(): void {
    if (this.viewer && this.currentSceneId) {
      const sceneData = this.scenes.find(s => s.id === this.currentSceneId);
      if (sceneData) {
        this.lookTo(sceneData.initialViewParameters);
      }
    }
  }

  /**
   * Navigate to previous scene
   */
  previousScene(): void {
    if (!this.scenes.length) return;
    
    const currentIndex = this.scenes.findIndex(s => s.id === this.currentSceneId);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : this.scenes.length - 1;
    
    this.switchToScene(this.scenes[previousIndex].id);
  }

  /**
   * Navigate to next scene
   */
  nextScene(): void {
    if (!this.scenes.length) return;
    
    const currentIndex = this.scenes.findIndex(s => s.id === this.currentSceneId);
    const nextIndex = currentIndex < this.scenes.length - 1 ? currentIndex + 1 : 0;
    
    this.switchToScene(this.scenes[nextIndex].id);
  }

  /**
   * Handle hotspot click
   */
  onHotspotClick(hotspot: Hotspot): void {
    this.hotspotClick.emit(hotspot);
    
    if (hotspot.type === 'link' && hotspot.target) {
      this.switchToScene(hotspot.target);
    }
  }

  /**
   * Get current scene data
   */
  getCurrentScene(): Scene | undefined {
    return this.scenes.find(s => s.id === this.currentSceneId);
  }

  /**
   * Get scene by ID
   */
  getScene(sceneId: string): Scene | undefined {
    return this.scenes.find(s => s.id === sceneId);
  }

  /**
   * Check if scene exists
   */
  hasScene(sceneId: string): boolean {
    return this.scenes.some(s => s.id === sceneId);
  }

  /**
   * Get total number of scenes
   */
  getSceneCount(): number {
    return this.scenes.length;
  }

  /**
   * Get current scene index
   */
  getCurrentSceneIndex(): number {
    return this.scenes.findIndex(s => s.id === this.currentSceneId);
  }

  /**
   * Update scene data
   */
  updateScene(sceneData: Scene): void {
    const index = this.scenes.findIndex(s => s.id === sceneData.id);
    if (index >= 0) {
      this.scenes[index] = sceneData;
      
      // Reload the scene if it's currently loaded
      if (this.loadedScenes.has(sceneData.id)) {
        this.loadScenes();
      }
    }
  }

  /**
   * Add new scene
   */
  addScene(sceneData: Scene): void {
    this.scenes.push(sceneData);
    
    if (this.viewer) {
      const scene = this.viewer.addScene(sceneData);
      this.loadedScenes.set(sceneData.id, scene);
      this.createSceneHotspots(scene, sceneData);
    }
  }

  /**
   * Remove scene
   */
  removeScene(sceneId: string): void {
    const index = this.scenes.findIndex(s => s.id === sceneId);
    if (index >= 0) {
      this.scenes.splice(index, 1);
      
      if (this.loadedScenes.has(sceneId)) {
        const scene = this.loadedScenes.get(sceneId);
        if (scene) {
          scene.destroy();
        }
        this.loadedScenes.delete(sceneId);
      }
      
      // Switch to another scene if current scene was removed
      if (this.currentSceneId === sceneId && this.scenes.length > 0) {
        this.switchToScene(this.scenes[0].id);
      }
    }
  }

  /**
   * Refresh viewer
   */
  refresh(): void {
    if (this.viewer) {
      this.marzipanoViewerService.destroy();
      this.loadedScenes.clear();
      this.initializeViewer();
      this.loadScenes();
    }
  }

  /**
   * Handle window resize
   */
  onResize(): void {
    // The viewer service handles resize automatically
  }

  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      this.viewerContainer.nativeElement.requestFullscreen();
      this.isFullscreen = true;
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
    }
  }
}
