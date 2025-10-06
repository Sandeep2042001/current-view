import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface RoomData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  connections: string[]; // IDs of connected rooms
  isActive: boolean;
  isVisited: boolean;
  thumbnail?: string;
  floorArea?: number;
}

export interface MinimapConfig {
  width: number;
  height: number;
  scale: number;
  showRoomLabels: boolean;
  showConnections: boolean;
  showFloorAreas: boolean;
  backgroundColor: string;
  gridSize: number;
}

@Component({
  selector: 'app-minimap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="minimap-container" [style.width.px]="config.width" [style.height.px]="config.height">
      <!-- Minimap Header -->
      <div class="minimap-header">
        <h3>Floor Plan</h3>
        <div class="minimap-controls">
          <button class="control-btn" (click)="toggleLabels()" [class.active]="config.showRoomLabels" title="Toggle Labels">
            <i class="material-icons">label</i>
          </button>
          <button class="control-btn" (click)="toggleConnections()" [class.active]="config.showConnections" title="Toggle Connections">
            <i class="material-icons">account_tree</i>
          </button>
          <button class="control-btn" (click)="toggleFloorAreas()" [class.active]="config.showFloorAreas" title="Toggle Floor Areas">
            <i class="material-icons">crop_square</i>
          </button>
          <button class="control-btn" (click)="resetView()" title="Reset View">
            <i class="material-icons">refresh</i>
          </button>
        </div>
      </div>

      <!-- Minimap Canvas -->
      <div class="minimap-content">
        <canvas 
          #minimapCanvas 
          class="minimap-canvas"
          [width]="config.width"
          [height]="config.height"
          (click)="onCanvasClick($event)"
          (mousemove)="onCanvasMouseMove($event)"
          (mouseleave)="onCanvasMouseLeave()">
        </canvas>
        
        <!-- Room Info Overlay -->
        <div class="room-info-overlay" *ngIf="hoveredRoom" [style.left.px]="tooltipX" [style.top.px]="tooltipY">
          <div class="room-info-card">
            <div class="room-header">
              <h4>{{ hoveredRoom.name }}</h4>
              <div class="room-status" [class.active]="hoveredRoom.isActive" [class.visited]="hoveredRoom.isVisited">
                <i class="material-icons">{{ getRoomStatusIcon(hoveredRoom) }}</i>
              </div>
            </div>
            <div class="room-details" *ngIf="config.showFloorAreas && hoveredRoom.floorArea">
              <div class="detail-item">
                <span class="label">Area:</span>
                <span class="value">{{ hoveredRoom.floorArea }}m²</span>
              </div>
            </div>
            <div class="room-actions">
              <button class="action-btn" (click)="navigateToRoom(hoveredRoom.id)" *ngIf="!hoveredRoom.isActive">
                <i class="material-icons">directions</i>
                Go to Room
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Minimap Legend -->
      <div class="minimap-legend">
        <div class="legend-item">
          <div class="legend-color active"></div>
          <span>Current Room</span>
        </div>
        <div class="legend-item">
          <div class="legend-color visited"></div>
          <span>Visited</span>
        </div>
        <div class="legend-item">
          <div class="legend-color unvisited"></div>
          <span>Unvisited</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./minimap.component.scss']
})
export class MinimapComponent implements OnInit, OnChanges {
  @ViewChild('minimapCanvas') minimapCanvas!: ElementRef<HTMLCanvasElement>;

  @Input() rooms: RoomData[] = [];
  @Input() currentRoomId: string = '';
  @Input() config: MinimapConfig = {
    width: 400,
    height: 300,
    scale: 1.0,
    showRoomLabels: true,
    showConnections: true,
    showFloorAreas: true,
    backgroundColor: '#f8f9fa',
    gridSize: 20
  };

  @Output() roomSelected = new EventEmitter<string>();
  @Output() configChanged = new EventEmitter<MinimapConfig>();

  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrame: number | null = null;
  private isDragging = false;
  private dragStart = { x: 0, y: 0 };
  private viewOffset = { x: 0, y: 0 };
  private zoomLevel = 1.0;

  hoveredRoom: RoomData | null = null;
  tooltipX = 0;
  tooltipY = 0;

  ngOnInit() {
    this.initializeCanvas();
    this.drawMinimap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['rooms'] || changes['currentRoomId'] || changes['config']) {
      this.drawMinimap();
    }
  }

  private initializeCanvas() {
    if (this.minimapCanvas) {
      this.ctx = this.minimapCanvas.nativeElement.getContext('2d');
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
      }
    }
  }

  private drawMinimap() {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.config.width, this.config.height);

    // Draw background
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.config.width, this.config.height);

    // Apply transformations
    this.ctx.save();
    this.ctx.translate(this.config.width / 2 + this.viewOffset.x, this.config.height / 2 + this.viewOffset.y);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);

    // Draw grid
    this.drawGrid();

    // Draw connections
    if (this.config.showConnections) {
      this.drawConnections();
    }

    // Draw rooms
    this.drawRooms();

    // Draw room labels
    if (this.config.showRoomLabels) {
      this.drawRoomLabels();
    }

    this.ctx.restore();

    // Draw UI elements (not affected by transformations)
    this.drawUIElements();
  }

  private drawGrid() {
    if (!this.ctx) return;

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.lineWidth = 1;

    const gridSize = this.config.gridSize;
    const halfWidth = this.config.width / 2;
    const halfHeight = this.config.height / 2;

    // Vertical lines
    for (let x = -halfWidth; x <= halfWidth; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, -halfHeight);
      this.ctx.lineTo(x, halfHeight);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = -halfHeight; y <= halfHeight; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(-halfWidth, y);
      this.ctx.lineTo(halfWidth, y);
      this.ctx.stroke();
    }
  }

  private drawConnections() {
    if (!this.ctx) return;

    this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.6)';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 5]);

    this.rooms.forEach(room => {
      room.connections.forEach(connectionId => {
        const connectedRoom = this.rooms.find(r => r.id === connectionId);
        if (connectedRoom) {
          this.ctx!.beginPath();
          this.ctx!.moveTo(room.position.x, room.position.z);
          this.ctx!.lineTo(connectedRoom.position.x, connectedRoom.position.z);
          this.ctx!.stroke();
        }
      });
    });

    this.ctx.setLineDash([]);
  }

  private drawRooms() {
    if (!this.ctx) return;

    this.rooms.forEach(room => {
      this.drawRoom(room);
    });
  }

  private drawRoom(room: RoomData) {
    if (!this.ctx) return;

    const x = room.position.x - room.dimensions.width / 2;
    const z = room.position.z - room.dimensions.depth / 2;
    const width = room.dimensions.width;
    const depth = room.dimensions.depth;

    // Determine room color based on status
    let fillColor: string;
    let strokeColor: string;
    let strokeWidth: number;

    if (room.isActive) {
      fillColor = 'rgba(76, 175, 80, 0.8)';
      strokeColor = '#4CAF50';
      strokeWidth = 3;
    } else if (room.isVisited) {
      fillColor = 'rgba(33, 150, 243, 0.6)';
      strokeColor = '#2196F3';
      strokeWidth = 2;
    } else {
      fillColor = 'rgba(158, 158, 158, 0.4)';
      strokeColor = '#9E9E9E';
      strokeWidth = 1;
    }

    // Draw room rectangle
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, z, width, depth);

    // Draw room border
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = strokeWidth;
    this.ctx.strokeRect(x, z, width, depth);

    // Draw floor area if enabled
    if (this.config.showFloorAreas && room.floorArea) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      this.ctx.font = '10px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        `${room.floorArea}m²`,
        room.position.x,
        room.position.z + 4
      );
    }

    // Draw room center point
    this.ctx.fillStyle = strokeColor;
    this.ctx.beginPath();
    this.ctx.arc(room.position.x, room.position.z, 3, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private drawRoomLabels() {
    if (!this.ctx) return;

    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.rooms.forEach(room => {
      // Only draw labels for active or hovered rooms to avoid clutter
      if (room.isActive || room === this.hoveredRoom) {
        this.ctx!.fillText(
          room.name,
          room.position.x,
          room.position.z - room.dimensions.depth / 2 - 15
        );
      }
    });
  }

  private drawUIElements() {
    if (!this.ctx) return;

    // Draw zoom indicator
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 100, 30);
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Zoom: ${Math.round(this.zoomLevel * 100)}%`, 15, 28);
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.ctx) return;

    const rect = this.minimapCanvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const worldX = (x - this.config.width / 2 - this.viewOffset.x) / this.zoomLevel;
    const worldY = (y - this.config.height / 2 - this.viewOffset.y) / this.zoomLevel;

    // Find clicked room
    const clickedRoom = this.rooms.find(room => {
      const dx = Math.abs(room.position.x - worldX);
      const dz = Math.abs(room.position.z - worldY);
      return dx < room.dimensions.width / 2 && dz < room.dimensions.depth / 2;
    });

    if (clickedRoom && clickedRoom.id !== this.currentRoomId) {
      this.roomSelected.emit(clickedRoom.id);
    }
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.ctx) return;

    const rect = this.minimapCanvas.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const worldX = (x - this.config.width / 2 - this.viewOffset.x) / this.zoomLevel;
    const worldY = (y - this.config.height / 2 - this.viewOffset.y) / this.zoomLevel;

    // Find hovered room
    const hoveredRoom = this.rooms.find(room => {
      const dx = Math.abs(room.position.x - worldX);
      const dz = Math.abs(room.position.z - worldY);
      return dx < room.dimensions.width / 2 && dz < room.dimensions.depth / 2;
    });

    if (hoveredRoom !== this.hoveredRoom) {
      this.hoveredRoom = hoveredRoom;
      this.tooltipX = x + 10;
      this.tooltipY = y - 10;
      this.drawMinimap();
    }
  }

  onCanvasMouseLeave() {
    if (this.hoveredRoom) {
      this.hoveredRoom = null;
      this.drawMinimap();
    }
  }

  navigateToRoom(roomId: string) {
    this.roomSelected.emit(roomId);
  }

  toggleLabels() {
    this.config.showRoomLabels = !this.config.showRoomLabels;
    this.configChanged.emit(this.config);
    this.drawMinimap();
  }

  toggleConnections() {
    this.config.showConnections = !this.config.showConnections;
    this.configChanged.emit(this.config);
    this.drawMinimap();
  }

  toggleFloorAreas() {
    this.config.showFloorAreas = !this.config.showFloorAreas;
    this.configChanged.emit(this.config);
    this.drawMinimap();
  }

  resetView() {
    this.viewOffset = { x: 0, y: 0 };
    this.zoomLevel = 1.0;
    this.drawMinimap();
  }

  getRoomStatusIcon(room: RoomData): string {
    if (room.isActive) return 'radio_button_checked';
    if (room.isVisited) return 'radio_button_checked';
    return 'radio_button_unchecked';
  }
}
