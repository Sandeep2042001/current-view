# Measurement Tool Implementation Guide

## Overview
The measurement tool allows users to measure distances in 360° panoramas by clicking two points (A and B) and getting the distance in inches, feet, or meters.

## Files Created

### 1. Measurement Service (`web/src/app/services/measurement.service.ts`)
✅ **Status**: Implemented

**Features**:
- Toggle measurement mode on/off
- Add measurement points by clicking
- Calculate distances between points
- Calibration system for accurate measurements
- Export/import measurements
- Multiple unit support (inches, feet, meters)

**Key Methods**:
```typescript
toggleMeasurementMode()     // Enable/disable measurement mode
addPoint(x, y, roomId, z?)  // Add a measurement point
calibrateScale(roomId, pixelDistance, realWorldMeters)  // Calibrate scale
formatDistance(measurement) // Format distance for display
```

### 2. Measurement Tool Component (`web/src/app/components/measurement-tool/measurement-tool.component.ts`)
✅ **Status**: Implemented

**Features**:
- Floating UI panel with measurement toggle button
- Visual feedback when in measurement mode
- List of all measurements with delete option
- Calibration interface
- Export measurements to JSON

## How to Integrate with Viewer

### Step 1: Add to Viewer Template
Add the measurement tool component to your viewer HTML:

```html
<!-- In viewer.component.html, add near the top -->
<app-measurement-tool></app-measurement-tool>
```

### Step 2: Handle Click Events in Viewer
Add click handler to capture measurement points:

```typescript
// In viewer.component.ts

import { MeasurementService } from '../../services/measurement.service';

constructor(
  // ... existing services
  private measurementService: MeasurementService
) {}

// Add click event listener to canvas
ngAfterViewInit() {
  // ... existing init code
  
  this.viewerCanvas.nativeElement.addEventListener('click', (event) => {
    if (this.measurementService.isMeasurementMode()) {
      const rect = this.viewerCanvas.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      this.measurementService.addPoint(x, y, this.currentRoomId);
    }
  });
}
```

### Step 3: Import Required Modules
```typescript
// In viewer.component.ts imports
import { MeasurementToolComponent } from '../measurement-tool/measurement-tool.component';

// In @Component decorator
@Component({
  // ...
  imports: [
    // ... existing imports
    MeasurementToolComponent
  ]
})
```

## How It Works

### 1. User Flow
1. User clicks "Measure" button to enable measurement mode
2. Click first point (A) on the panorama
3. Click second point (B) on the panorama
4. Distance is automatically calculated and displayed
5. Measurement is added to the list

### 2. Distance Calculation

**2D Mode (Current)**:
```
distance_pixels = sqrt((x2-x1)² + (y2-y1)²)
distance_meters = distance_pixels / scale_factor
distance_inches = distance_meters * 39.3701
```

**Default Scale Factor**: 512 pixels/meter (assumes 4m room width, 2048px image)

### 3. Calibration Process
To get accurate measurements:

1. Measure a known distance (e.g., door width = 32 inches)
2. Click "Calibrate Scale" button
3. Enter the real-world measurement
4. System calculates: `scale_factor = pixel_distance / real_world_distance`
5. All future measurements use this calibrated scale

## Limitations & Future Enhancements

### Current Limitations
1. **2D Only**: Measures pixel distance, not true 3D distance
2. **No Depth**: Assumes all points are on same depth plane
3. **Manual Calibration**: Requires user to calibrate for accuracy

### Future Enhancements (From Architecture Document)

#### Phase 1: Basic 3D (Recommended Next)
- Integrate with Stage 3 depth estimation
- Get Z coordinate from depth map
- Calculate true 3D Euclidean distance
- Accuracy: ±5-10cm

#### Phase 2: Advanced 3D (Full Framework)
- Full Stage 3 implementation (360MonoDepth)
- Neural SDF surface reconstruction
- RANSAC plane fitting for walls/floors
- Metric measurements: < 1cm error
- Automatic room dimension detection

#### Phase 3: AI-Enhanced
- Automatic edge/corner detection
- Snap-to-edge functionality
- Room layout extraction
- BIM export capabilities

## Integration Checklist

- [x] Create MeasurementService
- [x] Create MeasurementToolComponent
- [ ] Add component to viewer template
- [ ] Add click event handler to viewer
- [ ] Import component in viewer
- [ ] Test basic 2D measurements
- [ ] Add calibration testing
- [ ] Document calibration process for users

## Usage Example

```typescript
// Enable measurement mode
measurementService.setMeasurementMode(true);

// Add points (from click events)
measurementService.addPoint(100, 200, 'room-id-123');
measurementService.addPoint(500, 600, 'room-id-123');

// Calibrate (door width = 0.9m, measured 450 pixels)
measurementService.calibrateScale('room-id-123', 450, 0.9);

// Export measurements
const json = measurementService.exportMeasurements('room-id-123');
```

## Notes
- Measurements are stored in-memory (not persisted to database yet)
- Each room can have its own scale factor
- Default scale assumes average room dimensions
- For production, consider adding measurement persistence to backend

## Quick Start Commands

```bash
# The service and component are already created
# Just need to integrate with viewer

# 1. Add to viewer component imports
# 2. Add to viewer template
# 3. Add click handler
# 4. Test!
```

