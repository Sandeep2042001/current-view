import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../services/auth.service';

interface RoomNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation_y: number;
  is_starting_room: boolean;
  panorama_url?: string;
}

interface Connection {
  id: string;
  source_room_id: string;
  target_room_id: string;
  label?: string;
}

@Component({
  selector: 'app-floor-plan-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="floor-plan-editor">
      <!-- Header -->
      <div class="editor-header">
        <div class="header-left">
          <button (click)="goBack()" class="back-btn">
            <i class="material-icons">arrow_back</i>
          </button>
          <h1>Floor Plan Editor</h1>
          <span class="project-name">{{ projectName }}</span>
        </div>
        
        <div class="header-right">
          <button (click)="autoGenerateHotspots()" class="action-btn primary">
            <i class="material-icons">auto_fix_high</i>
            Auto-Generate Hotspots
          </button>
          <button (click)="saveLayout()" class="action-btn success" [disabled]="!hasChanges">
            <i class="material-icons">save</i>
            Save Layout
          </button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="tool-group">
          <button 
            class="tool-btn"
            [class.active]="currentTool === 'select'"
            (click)="setTool('select')"
            title="Select & Move">
            <i class="material-icons">pan_tool</i>
          </button>
          <button 
            class="tool-btn"
            [class.active]="currentTool === 'connect'"
            (click)="setTool('connect')"
            title="Connect Rooms">
            <i class="material-icons">timeline</i>
          </button>
        </div>

        <div class="tool-group" *ngIf="selectedRoom">
          <span class="tool-label">Selected: {{ selectedRoom.name }}</span>
          <button (click)="setAsStartingRoom()" class="tool-btn" title="Set as Starting Room">
            <i class="material-icons">home</i>
          </button>
          <button (click)="rotateRoom(-15)" class="tool-btn" title="Rotate Left">
            <i class="material-icons">rotate_left</i>
          </button>
          <button (click)="rotateRoom(15)" class="tool-btn" title="Rotate Right">
            <i class="material-icons">rotate_right</i>
          </button>
        </div>

        <div class="tool-group">
          <button (click)="zoomIn()" class="tool-btn">
            <i class="material-icons">zoom_in</i>
          </button>
          <span class="zoom-level">{{ (zoom * 100).toFixed(0) }}%</span>
          <button (click)="zoomOut()" class="tool-btn">
            <i class="material-icons">zoom_out</i>
          </button>
          <button (click)="resetView()" class="tool-btn">
            <i class="material-icons">center_focus_strong</i>
          </button>
        </div>
      </div>

      <!-- Canvas Container -->
      <div class="canvas-container" #canvasContainer>
        <canvas 
          #canvas
          (mousedown)="onMouseDown($event)"
          (mousemove)="onMouseMove($event)"
          (mouseup)="onMouseUp($event)"
          (wheel)="onWheel($event)">
        </canvas>
      </div>

      <!-- Room List -->
      <div class="room-list-panel">
        <h3>Rooms ({{ rooms.length }})</h3>
        <div class="room-items">
          <div 
            *ngFor="let room of rooms"
            class="room-item"
            [class.selected]="selectedRoom?.id === room.id"
            [class.starting]="room.is_starting_room"
            (click)="selectRoomById(room.id)">
            <i class="material-icons" *ngIf="room.is_starting_room">home</i>
            <i class="material-icons" *ngIf="!room.is_starting_room">meeting_room</i>
            <span>{{ room.name }}</span>
          </div>
        </div>
      </div>

      <!-- Connection List -->
      <div class="connection-list-panel">
        <h3>Hotspots ({{ connections.length }})</h3>
        <div class="connection-items">
          <div 
            *ngFor="let conn of connections"
            class="connection-item">
            <div class="connection-info">
              <i class="material-icons">arrow_forward</i>
              <span>{{ getRoomName(conn.source_room_id) }} → {{ getRoomName(conn.target_room_id) }}</span>
            </div>
            <button (click)="deleteConnection(conn.id)" class="delete-btn">
              <i class="material-icons">delete</i>
            </button>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions">
        <p *ngIf="currentTool === 'select'">
          <i class="material-icons">info</i>
          Drag rooms to reposition them. Click to select.
        </p>
        <p *ngIf="currentTool === 'connect'">
          <i class="material-icons">info</i>
          Click first room, then click second room to create a hotspot connection.
        </p>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading">
        <div class="spinner"></div>
        <p>{{ loadingMessage }}</p>
      </div>
    </div>
  `,
  styleUrls: ['./floor-plan-editor.component.scss']
})
export class FloorPlanEditorComponent implements OnInit, AfterViewInit {
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;

  projectId: string = '';
  projectName: string = '';
  rooms: RoomNode[] = [];
  connections: Connection[] = [];
  
  private ctx!: CanvasRenderingContext2D;
  private isDragging = false;
  private draggedRoom: RoomNode | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  
  selectedRoom: RoomNode | null = null;
  currentTool: 'select' | 'connect' = 'select';
  connectingFrom: RoomNode | null = null;
  
  zoom = 1;
  panX = 0;
  panY = 0;
  
  loading = false;
  loadingMessage = '';
  hasChanges = false;

  private readonly ROOM_WIDTH = 80;
  private readonly ROOM_HEIGHT = 80;
  private readonly GRID_SIZE = 20;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.projectId = params['projectId'];
      this.loadProjectData();
    });
  }

  ngAfterViewInit() {
    this.initCanvas();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private initCanvas() {
    const canvasEl = this.canvas.nativeElement;
    this.ctx = canvasEl.getContext('2d')!;
    this.draw();
  }

  private resizeCanvas() {
    const container = this.canvasContainer.nativeElement;
    const canvasEl = this.canvas.nativeElement;
    
    canvasEl.width = container.clientWidth;
    canvasEl.height = container.clientHeight;
    
    this.draw();
  }

  private async loadProjectData() {
    try {
      this.loading = true;
      this.loadingMessage = 'Loading project data...';

      const token = this.authService.getToken();
      
      // Load tour data
      const response = await fetch(
        `http://localhost:3000/api/virtual-tour/projects/${this.projectId}/tour-data`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) throw new Error('Failed to load project data');

      const data = await response.json();
      this.projectName = data.project.name;

      // Convert rooms to nodes
      this.rooms = data.rooms.map((room: any, index: number) => ({
        id: room.id,
        name: room.name,
        x: room.initial_coordinates_x || (index * 150 + 100),
        y: room.initial_coordinates_z || 200,
        width: this.ROOM_WIDTH,
        height: this.ROOM_HEIGHT,
        rotation_y: room.rotation_y || 0,
        is_starting_room: room.is_starting_room || false,
        panorama_url: room.panorama_url
      }));

      // Load connections (hotspots)
      this.connections = data.rooms.flatMap((room: any) =>
        (room.hotspots || []).map((hotspot: any) => ({
          id: hotspot.id,
          source_room_id: hotspot.source_room_id,
          target_room_id: hotspot.target_room_id,
          label: hotspot.label
        }))
      );

      this.loading = false;
      this.draw();

    } catch (error) {
      console.error('Error loading project data:', error);
      this.toastr.error('Failed to load project data');
      this.loading = false;
    }
  }

  private draw() {
    if (!this.ctx) return;

    const canvasEl = this.canvas.nativeElement;
    this.ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // Save context state
    this.ctx.save();
    
    // Apply zoom and pan
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);

    // Draw grid
    this.drawGrid();

    // Draw connections
    this.drawConnections();

    // Draw rooms
    this.rooms.forEach(room => this.drawRoom(room));

    // Draw connecting line if in connect mode
    if (this.currentTool === 'connect' && this.connectingFrom) {
      this.drawConnectingLine();
    }

    // Restore context state
    this.ctx.restore();
  }

  private drawGrid() {
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 0.5;

    const canvasEl = this.canvas.nativeElement;
    const gridSize = this.GRID_SIZE;

    // Vertical lines
    for (let x = 0; x < canvasEl.width / this.zoom; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, canvasEl.height / this.zoom);
      this.ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < canvasEl.height / this.zoom; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(canvasEl.width / this.zoom, y);
      this.ctx.stroke();
    }
  }

  private drawRoom(room: RoomNode) {
    const isSelected = this.selectedRoom?.id === room.id;
    const isStarting = room.is_starting_room;

    // Draw room rectangle
    this.ctx.fillStyle = isStarting ? '#4CAF50' : (isSelected ? '#2196F3' : '#555');
    this.ctx.fillRect(room.x, room.y, room.width, room.height);

    // Draw border
    this.ctx.strokeStyle = isSelected ? '#fff' : '#888';
    this.ctx.lineWidth = isSelected ? 3 : 1;
    this.ctx.strokeRect(room.x, room.y, room.width, room.height);

    // Draw rotation indicator
    const centerX = room.x + room.width / 2;
    const centerY = room.y + room.height / 2;
    const angle = room.rotation_y * Math.PI / 180;
    const arrowLength = 30;

    this.ctx.strokeStyle = '#FFC107';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.lineTo(
      centerX + Math.cos(angle) * arrowLength,
      centerY + Math.sin(angle) * arrowLength
    );
    this.ctx.stroke();

    // Draw room name
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(room.name, centerX, room.y + room.height + 5);
  }

  private drawConnections() {
    this.connections.forEach(conn => {
      const sourceRoom = this.rooms.find(r => r.id === conn.source_room_id);
      const targetRoom = this.rooms.find(r => r.id === conn.target_room_id);

      if (sourceRoom && targetRoom) {
        const sx = sourceRoom.x + sourceRoom.width / 2;
        const sy = sourceRoom.y + sourceRoom.height / 2;
        const tx = targetRoom.x + targetRoom.width / 2;
        const ty = targetRoom.y + targetRoom.height / 2;

        // Draw arrow
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(sx, sy);
        this.ctx.lineTo(tx, ty);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw arrowhead
        const angle = Math.atan2(ty - sy, tx - sx);
        const headLength = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(tx, ty);
        this.ctx.lineTo(
          tx - headLength * Math.cos(angle - Math.PI / 6),
          ty - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(tx, ty);
        this.ctx.lineTo(
          tx - headLength * Math.cos(angle + Math.PI / 6),
          ty - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
      }
    });
  }

  private drawConnectingLine() {
    // This would draw a line from connectingFrom to mouse position
    // Implementation depends on tracking mouse position
  }

  onMouseDown(event: MouseEvent) {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.panX) / this.zoom;
    const y = (event.clientY - rect.top - this.panY) / this.zoom;

    const clickedRoom = this.findRoomAt(x, y);

    if (this.currentTool === 'select') {
      if (clickedRoom) {
        this.selectedRoom = clickedRoom;
        this.isDragging = true;
        this.draggedRoom = clickedRoom;
        this.dragOffsetX = x - clickedRoom.x;
        this.dragOffsetY = y - clickedRoom.y;
      } else {
        this.selectedRoom = null;
      }
      this.draw();
    } else if (this.currentTool === 'connect') {
      if (clickedRoom) {
        if (!this.connectingFrom) {
          this.connectingFrom = clickedRoom;
          this.toastr.info(`Select target room for ${clickedRoom.name}`);
        } else if (this.connectingFrom.id !== clickedRoom.id) {
          this.createConnection(this.connectingFrom, clickedRoom);
          this.connectingFrom = null;
        }
      }
    }
  }

  onMouseMove(event: MouseEvent) {
    if (this.isDragging && this.draggedRoom) {
      const rect = this.canvas.nativeElement.getBoundingClientRect();
      const x = (event.clientX - rect.left - this.panX) / this.zoom;
      const y = (event.clientY - rect.top - this.panY) / this.zoom;

      // Snap to grid
      this.draggedRoom.x = Math.round((x - this.dragOffsetX) / this.GRID_SIZE) * this.GRID_SIZE;
      this.draggedRoom.y = Math.round((y - this.dragOffsetY) / this.GRID_SIZE) * this.GRID_SIZE;

      this.hasChanges = true;
      this.draw();
    }
  }

  onMouseUp(event: MouseEvent) {
    this.isDragging = false;
    this.draggedRoom = null;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.5, Math.min(2, this.zoom * delta));
    this.draw();
  }

  private findRoomAt(x: number, y: number): RoomNode | null {
    return this.rooms.find(room =>
      x >= room.x && x <= room.x + room.width &&
      y >= room.y && y <= room.y + room.height
    ) || null;
  }

  selectRoomById(roomId: string) {
    this.selectedRoom = this.rooms.find(r => r.id === roomId) || null;
    this.draw();
  }

  setTool(tool: 'select' | 'connect') {
    this.currentTool = tool;
    this.connectingFrom = null;
  }

  rotateRoom(degrees: number) {
    if (this.selectedRoom) {
      this.selectedRoom.rotation_y = (this.selectedRoom.rotation_y + degrees) % 360;
      this.hasChanges = true;
      this.draw();
    }
  }

  setAsStartingRoom() {
    if (this.selectedRoom) {
      this.rooms.forEach(r => r.is_starting_room = false);
      this.selectedRoom.is_starting_room = true;
      this.hasChanges = true;
      this.draw();
      this.toastr.success(`${this.selectedRoom.name} set as starting room`);
    }
  }

  zoomIn() {
    this.zoom = Math.min(2, this.zoom * 1.2);
    this.draw();
  }

  zoomOut() {
    this.zoom = Math.max(0.5, this.zoom / 1.2);
    this.draw();
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.draw();
  }

  async createConnection(sourceRoom: RoomNode, targetRoom: RoomNode) {
    try {
      const token = this.authService.getToken();
      
      // Calculate hotspot position (3 units in front of source room)
      const angle = sourceRoom.rotation_y * Math.PI / 180;
      const hotspotData = {
        target_room_id: targetRoom.id,
        coordinates_x: Math.cos(angle) * 3,
        coordinates_y: 0,
        coordinates_z: Math.sin(angle) * 3,
        rotation_y: targetRoom.rotation_y,
        label: `Go to ${targetRoom.name}`,
        icon: 'arrow_forward',
        color: '#00ff00'
      };

      const response = await fetch(
        `http://localhost:3000/api/virtual-tour/rooms/${sourceRoom.id}/hotspots`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(hotspotData)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create connection');
      }

      const newHotspot = await response.json();
      this.connections.push({
        id: newHotspot.id,
        source_room_id: sourceRoom.id,
        target_room_id: targetRoom.id,
        label: newHotspot.label
      });

      this.draw();
      this.toastr.success('Hotspot created successfully');

    } catch (error: any) {
      console.error('Error creating connection:', error);
      this.toastr.error(error.message || 'Failed to create connection');
    }
  }

  async deleteConnection(connectionId: string) {
    if (confirm('Delete this hotspot connection?')) {
      try {
        const token = this.authService.getToken();
        const response = await fetch(
          `http://localhost:3000/api/virtual-tour/hotspots/${connectionId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.ok) throw new Error('Failed to delete connection');

        this.connections = this.connections.filter(c => c.id !== connectionId);
        this.draw();
        this.toastr.success('Hotspot deleted');

      } catch (error) {
        console.error('Error deleting connection:', error);
        this.toastr.error('Failed to delete hotspot');
      }
    }
  }

  async autoGenerateHotspots() {
    if (confirm('Auto-generate hotspots between adjacent rooms? This will create connections based on room positions.')) {
      try {
        this.loading = true;
        this.loadingMessage = 'Generating hotspots...';

        const token = this.authService.getToken();
        const response = await fetch(
          `http://localhost:3000/api/virtual-tour/projects/${this.projectId}/auto-generate-hotspots`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) throw new Error('Failed to generate hotspots');

        const result = await response.json();
        this.toastr.success(`Created ${result.created_count} hotspots`);
        
        // Reload data
        await this.loadProjectData();

      } catch (error) {
        console.error('Error generating hotspots:', error);
        this.toastr.error('Failed to generate hotspots');
      } finally {
        this.loading = false;
      }
    }
  }

  async saveLayout() {
    try {
      this.loading = true;
      this.loadingMessage = 'Saving layout...';

      const token = this.authService.getToken();
      const roomUpdates = this.rooms.map(room => ({
        id: room.id,
        initial_coordinates_x: room.x,
        initial_coordinates_y: 0,
        initial_coordinates_z: room.y,
        rotation_y: room.rotation_y,
        is_starting_room: room.is_starting_room
      }));

      const response = await fetch(
        `http://localhost:3000/api/virtual-tour/projects/${this.projectId}/rooms/bulk-update`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rooms: roomUpdates })
        }
      );

      if (!response.ok) throw new Error('Failed to save layout');

      this.hasChanges = false;
      this.toastr.success('Layout saved successfully');

    } catch (error) {
      console.error('Error saving layout:', error);
      this.toastr.error('Failed to save layout');
    } finally {
      this.loading = false;
    }
  }

  getRoomName(roomId: string): string {
    return this.rooms.find(r => r.id === roomId)?.name || 'Unknown';
  }

  goBack() {
    this.router.navigate(['/projects']);
  }
}
