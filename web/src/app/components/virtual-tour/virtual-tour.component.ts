import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MarzipanoViewerComponent, Scene, Hotspot as MarzipanoHotspot } from '../marzipano-viewer/marzipano-viewer.component';
import { AuthService } from '../../services/auth.service';

export interface Room {
  id: string;
  name: string;
  description?: string;
  panorama_url: string;
  hotspots: RoomHotspot[];
  metadata?: any;
}

export interface RoomHotspot {
  id: string;
  type: 'navigation' | 'info';
  position: { x: number; y: number; z: number };
  title?: string;
  description?: string;
  target_room_id?: string;
  is_auto_generated?: boolean;
}

export interface TourData {
  project: {
    id: string;
    name: string;
    description: string;
  };
  rooms: Room[];
  starting_room_id: string | null;
  total_rooms: number;
  total_hotspots: number;
}

@Component({
  selector: 'app-virtual-tour',
  standalone: true,
  imports: [CommonModule, MarzipanoViewerComponent],
  template: `
    <div class="virtual-tour-container">
      <!-- Tour Header -->
      <div class="tour-header">
        <div class="tour-info">
          <h1>{{ tourData?.project?.name }}</h1>
          <p *ngIf="tourData?.project?.description">{{ tourData?.project?.description }}</p>
        </div>
        
        <div class="tour-controls">
          <button class="control-btn" (click)="toggleFullscreen()" title="Fullscreen">
            <i class="material-icons">{{ isFullscreen ? 'fullscreen_exit' : 'fullscreen' }}</i>
          </button>
          <button class="control-btn" (click)="goBack()" title="Exit Tour">
            <i class="material-icons">close</i>
          </button>
        </div>
      </div>

      <!-- Marzipano Viewer -->
      <div class="viewer-wrapper">
        <app-marzipano-viewer
          #marzipanoViewer
          [scenes]="scenes"
          [currentSceneId]="currentSceneId"
          [showControls]="true"
          [autorotate]="false"
          (sceneChange)="onSceneChange($event)"
          (hotspotClick)="onHotspotClick($event)">
        </app-marzipano-viewer>
      </div>

      <!-- Room Navigation -->
      <div class="room-navigation" *ngIf="tourData && tourData.rooms.length > 1">
        <button class="nav-btn" (click)="previousRoom()" [disabled]="!hasPreviousRoom()">
          <i class="material-icons">chevron_left</i>
        </button>
        
        <div class="room-info">
          <span class="room-name">{{ currentRoom?.name }}</span>
          <span class="room-counter">{{ currentRoomIndex + 1 }} / {{ tourData.rooms.length }}</span>
        </div>
        
        <button class="nav-btn" (click)="nextRoom()" [disabled]="!hasNextRoom()">
          <i class="material-icons">chevron_right</i>
        </button>
      </div>

      <!-- Minimap (Optional) -->
      <div class="minimap" *ngIf="showMinimap && tourData">
        <div class="minimap-header">
          <h3>Tour Map</h3>
          <button (click)="showMinimap = false" class="close-btn">
            <i class="material-icons">close</i>
          </button>
        </div>
        <div class="minimap-content">
          <div class="room-list">
            <div 
              *ngFor="let room of tourData.rooms; let i = index"
              class="room-item"
              [class.active]="room.id === currentRoom?.id"
              (click)="navigateToRoom(room.id)">
              <i class="material-icons">panorama</i>
              <span>{{ room.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <button class="minimap-toggle" (click)="showMinimap = !showMinimap" *ngIf="!showMinimap">
        <i class="material-icons">map</i>
      </button>

      <!-- Loading State -->
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner"></div>
        <p>Loading virtual tour...</p>
      </div>

      <!-- Error State -->
      <div class="error-overlay" *ngIf="error">
        <i class="material-icons">error_outline</i>
        <h2>Unable to Load Tour</h2>
        <p>{{ error }}</p>
        <button (click)="retryLoad()" class="retry-btn">Try Again</button>
      </div>
    </div>
  `,
  styleUrls: ['./virtual-tour.component.scss']
})
export class VirtualTourComponent implements OnInit {
  @ViewChild('marzipanoViewer') marzipanoViewer!: MarzipanoViewerComponent;

  projectId: string = '';
  tourData: TourData | null = null;
  scenes: Scene[] = [];
  currentSceneId: string = '';
  currentRoom: Room | null = null;
  currentRoomIndex: number = 0;
  currentHotspots: RoomHotspot[] = [];
  
  loading = false;
  error: string | null = null;
  isFullscreen = false;
  showMinimap = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['projectId'];
      this.loadTourData();
    });
  }

  private async loadTourData() {
    try {
      this.loading = true;
      this.error = null;

      const token = this.authService.getToken();
      const response = await fetch(
        `http://localhost:3000/api/virtual-tour/projects/${this.projectId}/tour-data`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load tour data');
      }

      this.tourData = await response.json();

      // Convert rooms to Marzipano scenes
      if (this.tourData && this.tourData.rooms) {
        this.scenes = this.convertRoomsToScenes(this.tourData.rooms);
      }

      // Set starting room
      if (this.tourData) {
        const startingRoom = this.tourData.rooms.find(r => r.id === this.tourData!.starting_room_id);
        this.currentRoom = startingRoom || this.tourData.rooms[0];
        this.currentSceneId = this.currentRoom?.id || '';
        this.currentRoomIndex = this.tourData.rooms.findIndex(r => r.id === this.currentRoom!.id);
        this.currentHotspots = this.currentRoom?.hotspots || [];
        
        console.log('✅ Tour loaded:', this.tourData.total_rooms, 'rooms,', this.tourData.total_hotspots, 'hotspots');
        console.log('🖼️ Current room panorama URL:', this.currentRoom?.panorama_url);
        console.log('📊 Tour data:', this.tourData);
        console.log('🎬 Scenes converted:', this.scenes.length);
      }

      this.loading = false;

    } catch (error) {
      console.error('Error loading tour data:', error);
      this.error = error instanceof Error ? error.message : 'Failed to load tour';
      this.loading = false;
    }
  }

  /**
   * Convert rooms to Marzipano scenes
   */
  private convertRoomsToScenes(rooms: Room[]): Scene[] {
    return rooms.map(room => {
      // Convert 3D hotspots to Marzipano-style hotspots
      const linkHotspots: MarzipanoHotspot[] = room.hotspots
        .filter((h: RoomHotspot) => h.type === 'navigation')
        .map((h: RoomHotspot) => ({
          id: h.id,
          type: 'link' as const,
          yaw: this.positionToYaw(h.position),
          pitch: this.positionToPitch(h.position),
          title: h.title || `Go to ${h.target_room_id}`,
          target: h.target_room_id
        }));

      const infoHotspots: MarzipanoHotspot[] = room.hotspots
        .filter((h: RoomHotspot) => h.type === 'info')
        .map((h: RoomHotspot) => ({
          id: h.id,
          type: 'info' as const,
          yaw: this.positionToYaw(h.position),
          pitch: this.positionToPitch(h.position),
          title: h.title || 'Information',
          text: h.description || ''
        }));

      return {
        id: room.id,
        name: room.name,
        imageUrl: room.panorama_url,
        levels: [
          { width: 2048, tileSize: 512 },
          { width: 1024, tileSize: 512 },
          { width: 512, tileSize: 256 }
        ],
        initialViewParameters: {
          yaw: 0,
          pitch: 0,
          fov: Math.PI / 2
        },
        linkHotspots,
        infoHotspots
      };
    });
  }

  /**
   * Convert 3D position to yaw angle
   */
  private positionToYaw(position: { x: number; y: number; z: number }): number {
    return Math.atan2(position.x, position.z);
  }

  /**
   * Convert 3D position to pitch angle
   */
  private positionToPitch(position: { x: number; y: number; z: number }): number {
    const distance = Math.sqrt(position.x * position.x + position.z * position.z);
    return Math.atan2(position.y, distance);
  }

  /**
   * Handle scene change from Marzipano viewer
   */
  onSceneChange(sceneId: string) {
    console.log('Scene changed to:', sceneId);
    this.currentSceneId = sceneId;
    this.currentRoom = this.tourData?.rooms.find(r => r.id === sceneId) || null;
    if (this.currentRoom) {
      this.currentRoomIndex = this.tourData!.rooms.findIndex(r => r.id === this.currentRoom!.id);
      this.currentHotspots = this.currentRoom.hotspots || [];
    }
  }

  onHotspotClick(hotspot: MarzipanoHotspot) {
    console.log('Hotspot clicked:', hotspot);
    this.navigateToRoom(hotspot.target);
    this.toastr.info(`Moving to ${hotspot.title || 'next room'}`);
  }

  navigateToRoom(roomId: string | undefined) {
    if (!roomId || !this.tourData) return;

    const roomIndex = this.tourData.rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) {
      this.toastr.error('Room not found');
      return;
    }

    this.currentRoomIndex = roomIndex;
    this.currentRoom = this.tourData.rooms[roomIndex];
    this.currentSceneId = roomId;
    this.currentHotspots = this.currentRoom.hotspots || [];

    console.log('📍 Navigated to room:', this.currentRoom.name);
    this.toastr.info(`Entering ${this.currentRoom.name}`);
  }

  previousRoom() {
    if (this.hasPreviousRoom()) {
      const prevRoom = this.tourData!.rooms[this.currentRoomIndex - 1];
      this.navigateToRoom(prevRoom.id);
    }
  }

  nextRoom() {
    if (this.hasNextRoom()) {
      const nextRoom = this.tourData!.rooms[this.currentRoomIndex + 1];
      this.navigateToRoom(nextRoom.id);
    }
  }

  hasPreviousRoom(): boolean {
    return this.currentRoomIndex > 0;
  }

  hasNextRoom(): boolean {
    return this.tourData ? this.currentRoomIndex < this.tourData.rooms.length - 1 : false;
  }

  toggleFullscreen() {
    const elem = document.documentElement;
    
    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => {
        this.isFullscreen = true;
      });
    } else {
      document.exitFullscreen().then(() => {
        this.isFullscreen = false;
      });
    }
  }

  goBack() {
    this.router.navigate(['/projects']);
  }

  retryLoad() {
    this.loadTourData();
  }
}
