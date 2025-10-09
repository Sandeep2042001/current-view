#!/usr/bin/env python3
"""
Stage 1: Sensor Rectification & Spherical Projection
Converts dual-fisheye images into undistorted equirectangular panoramas.
Implements high-precision lens distortion correction using Kannala-Brandt model.
"""

import cv2
import numpy as np
import json
import os
from typing import Dict, Tuple, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FisheyeRectifier:
    """
    Handles fisheye camera calibration and rectification to equirectangular format.
    Implements inverse mapping with pre-computed lookup tables for performance.
    """
    
    def __init__(self, calibration_file: Optional[str] = None):
        """
        Initialize rectifier with optional calibration file.
        
        Args:
            calibration_file: Path to calibration.json with camera intrinsics
        """
        self.calibration_data = None
        self.remap_cache = {}  # Cache for pre-computed remap tables
        
        if calibration_file and os.path.exists(calibration_file):
            self.load_calibration(calibration_file)
    
    def calibrate_camera(self, 
                        image_folder: str, 
                        checkerboard_dims: Tuple[int, int],
                        square_size: float,
                        output_file: str = 'calibration.json') -> Dict:
        """
        Calibrate fisheye camera using checkerboard pattern images.
        
        Args:
            image_folder: Directory containing checkerboard calibration images
            checkerboard_dims: (rows, cols) of internal checkerboard corners
            square_size: Physical size of checkerboard square in mm
            output_file: Path to save calibration results
            
        Returns:
            Dictionary with calibration parameters
        """
        logger.info(f"Starting camera calibration from {image_folder}")
        
        # Termination criteria for corner refinement
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)
        
        # Prepare object points (0,0,0), (1,0,0), (2,0,0) ... scaled by square_size
        objp = np.zeros((checkerboard_dims[0] * checkerboard_dims[1], 3), np.float32)
        objp[:, :2] = np.mgrid[0:checkerboard_dims[0], 
                               0:checkerboard_dims[1]].T.reshape(-1, 2)
        objp *= square_size
        
        # Arrays to store object points and image points
        objpoints = []  # 3D points in real world space
        imgpoints = []  # 2D points in image plane
        
        # Process all images in folder
        image_files = [f for f in os.listdir(image_folder) 
                      if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        img_shape = None
        for fname in image_files:
            img_path = os.path.join(image_folder, fname)
            img = cv2.imread(img_path)
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            if img_shape is None:
                img_shape = gray.shape[::-1]
            
            # Find checkerboard corners
            ret, corners = cv2.findChessboardCorners(gray, checkerboard_dims, None)
            
            if ret:
                objpoints.append(objp)
                
                # Refine corner positions
                corners_refined = cv2.cornerSubPix(gray, corners, (11, 11), 
                                                   (-1, -1), criteria)
                imgpoints.append(corners_refined)
                
                logger.info(f"✓ Found corners in {fname}")
            else:
                logger.warning(f"✗ Could not find corners in {fname}")
        
        if len(objpoints) < 10:
            raise ValueError(f"Insufficient valid calibration images: {len(objpoints)}. Need at least 10.")
        
        logger.info(f"Calibrating with {len(objpoints)} valid images...")
        
        # Calibrate fisheye camera
        K = np.zeros((3, 3))
        D = np.zeros((4, 1))
        rvecs = []
        tvecs = []
        
        calibration_flags = (cv2.fisheye.CALIB_RECOMPUTE_EXTRINSIC +
                            cv2.fisheye.CALIB_CHECK_COND +
                            cv2.fisheye.CALIB_FIX_SKEW)
        
        ret, K, D, rvecs, tvecs = cv2.fisheye.calibrate(
            objpoints, imgpoints, img_shape, K, D,
            None, None, calibration_flags, criteria
        )
        
        # Prepare calibration data
        calibration_data = {
            'camera_matrix': K.tolist(),
            'distortion_coeffs': D.tolist(),
            'image_size': list(img_shape),
            'reprojection_error': float(ret),
            'num_images': len(objpoints),
            'checkerboard_dims': list(checkerboard_dims),
            'square_size': square_size
        }
        
        # Save to file
        with open(output_file, 'w') as f:
            json.dump(calibration_data, f, indent=2)
        
        logger.info(f"✓ Calibration complete! RMS error: {ret:.4f}")
        logger.info(f"✓ Saved calibration to {output_file}")
        
        self.calibration_data = calibration_data
        return calibration_data
    
    def load_calibration(self, calibration_file: str):
        """Load calibration data from JSON file."""
        with open(calibration_file, 'r') as f:
            self.calibration_data = json.load(f)
        logger.info(f"✓ Loaded calibration from {calibration_file}")
    
    def _compute_remap_tables(self, 
                             K: np.ndarray, 
                             D: np.ndarray,
                             input_size: Tuple[int, int],
                             output_size: Tuple[int, int]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Pre-compute remap tables for fisheye to equirectangular conversion.
        This is the performance-critical optimization - compute once, reuse many times.
        
        Args:
            K: Camera intrinsic matrix (3x3)
            D: Distortion coefficients (4x1)
            input_size: (width, height) of fisheye image
            output_size: (width, height) of output equirectangular image
            
        Returns:
            (map_x, map_y) remap tables for cv2.remap()
        """
        logger.info(f"Computing remap tables for {input_size} -> {output_size}")
        
        out_w, out_h = output_size
        
        # Create meshgrid of output pixel coordinates
        out_x, out_y = np.meshgrid(np.arange(out_w), np.arange(out_h))
        
        # Convert to normalized coordinates [0, 1]
        norm_x = out_x / out_w
        norm_y = out_y / out_h
        
        # Convert to spherical coordinates
        # θ (longitude): 0 to 2π, φ (latitude): -π/2 to π/2
        theta = (norm_x - 0.5) * 2 * np.pi  # -π to π
        phi = (0.5 - norm_y) * np.pi  # -π/2 to π/2
        
        # Convert spherical to 3D unit vector
        x = np.cos(phi) * np.sin(theta)
        y = np.sin(phi)
        z = np.cos(phi) * np.cos(theta)
        
        # Stack into points array
        points_3d = np.stack([x, y, z], axis=-1).reshape(-1, 1, 3)
        
        # Project onto fisheye image using cv2.fisheye.projectPoints
        # This handles the Kannala-Brandt distortion model
        rvec = np.zeros(3)
        tvec = np.zeros(3)
        
        points_2d, _ = cv2.fisheye.projectPoints(points_3d, rvec, tvec, K, D)
        points_2d = points_2d.reshape(out_h, out_w, 2)
        
        map_x = points_2d[:, :, 0].astype(np.float32)
        map_y = points_2d[:, :, 1].astype(np.float32)
        
        return map_x, map_y
    
    def rectify_fisheye_to_equirect(self,
                                    fisheye_img: np.ndarray,
                                    output_size: Tuple[int, int] = (2048, 1024),
                                    use_cache: bool = True) -> np.ndarray:
        """
        Convert fisheye image to equirectangular projection.
        
        Args:
            fisheye_img: Input fisheye image
            output_size: (width, height) of output equirectangular image
            use_cache: Whether to use cached remap tables
            
        Returns:
            Undistorted equirectangular image
        """
        if self.calibration_data is None:
            raise ValueError("No calibration data loaded. Run calibrate_camera() first.")
        
        K = np.array(self.calibration_data['camera_matrix'])
        D = np.array(self.calibration_data['distortion_coeffs'])
        
        input_size = (fisheye_img.shape[1], fisheye_img.shape[0])
        cache_key = (input_size, output_size)
        
        # Check cache for pre-computed remap tables
        if use_cache and cache_key in self.remap_cache:
            map_x, map_y = self.remap_cache[cache_key]
        else:
            map_x, map_y = self._compute_remap_tables(K, D, input_size, output_size)
            if use_cache:
                self.remap_cache[cache_key] = (map_x, map_y)
        
        # Apply remapping (this is very fast with pre-computed tables)
        equirect = cv2.remap(fisheye_img, map_x, map_y, 
                            cv2.INTER_LINEAR, 
                            borderMode=cv2.BORDER_CONSTANT)
        
        return equirect
    
    def process_dual_fisheye(self,
                            dual_fisheye_img: np.ndarray,
                            output_size: Tuple[int, int] = (4096, 2048)) -> np.ndarray:
        """
        Process dual-fisheye image (two hemispheres side-by-side) into single equirectangular.
        
        Args:
            dual_fisheye_img: Input dual-fisheye image
            output_size: (width, height) of output equirectangular image
            
        Returns:
            Complete 360° equirectangular panorama
        """
        h, w = dual_fisheye_img.shape[:2]
        
        # Split into two fisheye images (assuming side-by-side layout)
        left_fisheye = dual_fisheye_img[:, :w//2]
        right_fisheye = dual_fisheye_img[:, w//2:]
        
        # Convert each hemisphere
        half_w = output_size[0] // 2
        left_equirect = self.rectify_fisheye_to_equirect(left_fisheye, (half_w, output_size[1]))
        right_equirect = self.rectify_fisheye_to_equirect(right_fisheye, (half_w, output_size[1]))
        
        # Stitch horizontally
        full_equirect = np.hstack([left_equirect, right_equirect])
        
        return full_equirect


def main():
    """Command-line interface for Stage 1 processing."""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Stage 1: Fisheye Rectification')
    parser.add_argument('--calibrate', action='store_true', 
                       help='Run camera calibration')
    parser.add_argument('--calib-images', type=str,
                       help='Folder with checkerboard calibration images')
    parser.add_argument('--checkerboard', type=str, default='9,6',
                       help='Checkerboard dimensions (rows,cols)')
    parser.add_argument('--square-size', type=float, default=25.0,
                       help='Checkerboard square size in mm')
    parser.add_argument('--input', type=str,
                       help='Input fisheye image or folder')
    parser.add_argument('--output', type=str,
                       help='Output equirectangular image or folder')
    parser.add_argument('--calibration', type=str, default='calibration.json',
                       help='Calibration file path')
    parser.add_argument('--dual-fisheye', action='store_true',
                       help='Input is dual-fisheye format')
    parser.add_argument('--size', type=str, default='4096,2048',
                       help='Output size (width,height)')
    
    args = parser.parse_args()
    
    rectifier = FisheyeRectifier()
    
    # Calibration mode
    if args.calibrate:
        if not args.calib_images:
            print("Error: --calib-images required for calibration")
            return 1
        
        checkerboard_dims = tuple(map(int, args.checkerboard.split(',')))
        rectifier.calibrate_camera(
            args.calib_images,
            checkerboard_dims,
            args.square_size,
            args.calibration
        )
        return 0
    
    # Rectification mode
    if not args.input or not args.output:
        print("Error: --input and --output required for rectification")
        return 1
    
    # Load calibration
    if not os.path.exists(args.calibration):
        print(f"Error: Calibration file not found: {args.calibration}")
        print("Run with --calibrate first to create calibration file")
        return 1
    
    rectifier.load_calibration(args.calibration)
    output_size = tuple(map(int, args.size.split(',')))
    
    # Process single image or batch
    if os.path.isfile(args.input):
        # Single image
        img = cv2.imread(args.input)
        if args.dual_fisheye:
            result = rectifier.process_dual_fisheye(img, output_size)
        else:
            result = rectifier.rectify_fisheye_to_equirect(img, output_size)
        
        cv2.imwrite(args.output, result)
        logger.info(f"✓ Saved rectified image to {args.output}")
    else:
        # Batch processing
        os.makedirs(args.output, exist_ok=True)
        image_files = [f for f in os.listdir(args.input) 
                      if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        for fname in image_files:
            img_path = os.path.join(args.input, fname)
            img = cv2.imread(img_path)
            
            if args.dual_fisheye:
                result = rectifier.process_dual_fisheye(img, output_size)
            else:
                result = rectifier.rectify_fisheye_to_equirect(img, output_size)
            
            out_path = os.path.join(args.output, fname)
            cv2.imwrite(out_path, result)
            logger.info(f"✓ Processed {fname}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

