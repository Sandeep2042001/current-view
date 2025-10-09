import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EnhancedMarzipanoService, MarzipanoScene } from '../../services/enhanced-marzipano.service';

@Component({
  selector: 'app-enhanced-marzipano-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './enhanced-marzipano-viewer.component.html',
  styleUrls: ['./enhanced-marzipano-viewer.component.scss']
})
export class EnhancedMarzipanoViewerComponent implements OnInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) viewerContainer!: ElementRef;

  @Input() scenes: MarzipanoScene[] = [];
  @Input() currentSceneId: string = '';
  @Input() enableVR: boolean = false;
  @Input() enableAutorotate: boolean = false;
  @Input() autorotateSpeed: number = 0.03;

  @Output() sceneChange = new EventEmitter<string>();
  @Output() hotspotClick = new EventEmitter<any>();
  @Output() viewerReady = new EventEmitter<any>();

  private viewer: any = null;
  public isInitialized = false;

  constructor(private marzipanoService: EnhancedMarzipanoService) {}

  ngOnInit(): void {
    this.initializeViewer();
  }

  ngOnDestroy(): void {
    this.destroyViewer();
  }

  private async initializeViewer(): Promise<void> {
    try {
      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Initialize Marzipano viewer
      this.viewer = this.marzipanoService.initializeViewer(
        this.viewerContainer.nativeElement,
        {
          controls: {
            mouseViewMode: 'fullscreen'
          }
        }
      );

      // Create scenes
      this.createScenes();

      // Set initial scene
      if (this.currentSceneId && this.scenes.length > 0) {
        this.switchToScene(this.currentSceneId);
      } else if (this.scenes.length > 0) {
        this.switchToScene(this.scenes[0].id);
      }

      // Configure autorotation
      if (this.enableAutorotate) {
        this.startAutorotate();
      }

      // Configure VR
      if (this.enableVR) {
        this.enableVRMode();
      }

      this.isInitialized = true;
      this.viewerReady.emit(this.viewer);

    } catch (error) {
      console.error('Failed to initialize Marzipano viewer:', error);
    }
  }

  private createScenes(): void {
    this.scenes.forEach(sceneData => {
      try {
        this.marzipanoService.createScene(sceneData);
      } catch (error) {
        console.error(`Failed to create scene ${sceneData.id}:`, error);
      }
    });
  }

  public switchToScene(sceneId: string): void {
    if (!this.isInitialized) {
      console.warn('Viewer not initialized yet');
      return;
    }

    try {
      this.marzipanoService.switchToScene(sceneId);
      this.currentSceneId = sceneId;
      this.sceneChange.emit(sceneId);
    } catch (error) {
      console.error(`Failed to switch to scene ${sceneId}:`, error);
    }
  }

  public startAutorotate(): void {
    if (!this.isInitialized) return;

    this.marzipanoService.startAutorotate({
      yawSpeed: this.autorotateSpeed
    });
  }

  public stopAutorotate(): void {
    if (!this.isInitialized) return;

    this.marzipanoService.stopAutorotate();
  }

  public enableVRMode(): void {
    if (!this.isInitialized) return;

    this.marzipanoService.enableVR();
  }

  public disableVRMode(): void {
    if (!this.isInitialized) return;

    this.marzipanoService.disableVR();
  }

  public toggleAutorotate(): void {
    if (this.enableAutorotate) {
      this.stopAutorotate();
    } else {
      this.startAutorotate();
    }
    this.enableAutorotate = !this.enableAutorotate;
  }

  public toggleVR(): void {
    if (this.enableVR) {
      this.disableVRMode();
    } else {
      this.enableVRMode();
    }
    this.enableVR = !this.enableVR;
  }

  public getCurrentScene(): any {
    return this.marzipanoService.getCurrentScene();
  }

  public getViewer(): any {
    return this.marzipanoService.getViewer();
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  private destroyViewer(): void {
    if (this.viewer) {
      this.marzipanoService.destroy();
      this.viewer = null;
      this.isInitialized = false;
    }
  }
}
