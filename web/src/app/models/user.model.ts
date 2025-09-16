export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'super_admin';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'processing' | 'completed' | 'failed';
  settings: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  rooms?: Room[];
  room_count?: number;
}

export interface Room {
  id: string;
  project_id: string;
  name: string;
  description: string;
  position?: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    x: number;
    y: number;
    z: number;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Record<string, any>;
  images?: Image[];
  hotspots?: Hotspot[];
  created_at?: string;
  updated_at?: string;
}

export interface Image {
  id: string;
  room_id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: string;
  storage_path: string;
  metadata?: {
    gyro?: {
      x: number;
      y: number;
      z: number;
    };
    compass?: number;
    timestamp?: number;
  };
  processing_status?: {
    uploaded: boolean;
    processed: boolean;
    stitched: boolean;
  };
  created_at: string;
  updated_at?: string;
}

export interface Hotspot {
  id: string;
  room_id: string;
  target_room_id?: string;
  type: 'navigation' | 'info' | 'measurement';
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation?: {
    x: number;
    y: number;
    z: number;
  };
  title?: string;
  description?: string;
  data?: Record<string, any>;
  is_auto_generated: boolean;
  created_at: string;
  screenPosition?: { x: number; y: number };
  showTooltip?: boolean;
}

export interface Annotation {
  id: string;
  room_id: string;
  type: 'point' | 'polygon' | 'line';
  coordinates: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  title?: string;
  description?: string;
  style?: Record<string, any>;
  created_at: string;
  screenPosition?: { x: number; y: number };
}

export interface Measurement {
  id: string;
  room_id: string;
  type: 'point_to_point' | 'corner' | 'edge';
  points: Array<{
    x: number;
    y: number;
    z: number;
  }>;
  distance?: number;
  unit: string;
  label?: string;
  metadata?: Record<string, any>;
  created_at: string;
  screenPosition?: { x: number; y: number };
}
