#!/usr/bin/env python3
"""
Stage 2: Multi-View Geometric Registration (Spherical SfM)
Computes 6-DoF camera poses and sparse 3D point cloud using deep learning feature matching.
Implements SuperPoint + SuperGlue for robust indoor feature correspondence.
"""

import cv2
import numpy as np
import json
import os
from typing import List, Dict, Tuple, Optional
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SuperPointSuperGlueM atcher:
    """
    Deep learning-based feature matcher using SuperPoint and SuperGlue.
    Provides robust matching for challenging indoor environments.
    """
    
    def __init__(self, device='cuda'):
        """
        Initialize SuperPoint and SuperGlue models.
        
        Args:
            device: 'cuda' or 'cpu'
        """
        self.device = device
        self.superpoint = None
        self.superglue = None
        
        try:
            import torch
            self.torch_available = True
            self._load_models()
        except ImportError:
            logger.warning("PyTorch not available. Falling back to SIFT.")
            self.torch_available = False
            self.sift = cv2.SIFT_create(nfeatures=8000)
    
    def _load_models(self):
        """Load pre-trained SuperPoint and SuperGlue models."""
        try:
            # Try to import from local SuperGlue implementation
            from models.superpoint import SuperPoint
            from models.superglue import SuperGlue
            
            import torch
            
            # SuperPoint config
            sp_config = {
                'descriptor_dim': 256,
                'nms_radius': 4,
                'keypoint_threshold': 0.005,
                'max_keypoints': 2048,
                'remove_borders': 4,
            }
            
            # SuperGlue config
            sg_config = {
                'descriptor_dim': 256,
                'weights': 'outdoor',  # or 'indoor'
                'keypoint_encoder': [32, 64, 128, 256],
                'GNN_layers': ['self', 'cross'] * 9,
                'sinkhorn_iterations': 20,
                'match_threshold': 0.2,
            }
            
            self.superpoint = SuperPoint(sp_config).eval().to(self.device)
            self.superglue = SuperGlue(sg_config).eval().to(self.device)
            
            logger.info("✓ SuperPoint + SuperGlue models loaded successfully")
            
        except (ImportError, FileNotFoundError) as e:
            logger.warning(f"Could not load SuperPoint/SuperGlue models: {e}")
            logger.warning("Falling back to SIFT feature matching")
            self.torch_available = False
            self.sift = cv2.SIFT_create(nfeatures=8000)
    
    def extract_features(self, image: np.ndarray) -> Dict:
        """
        Extract keypoints and descriptors from image.
        
        Args:
            image: Input image (grayscale or BGR)
            
        Returns:
            Dictionary with 'keypoints' and 'descriptors'
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        if self.torch_available and self.superpoint is not None:
            return self._extract_superpoint(gray)
        else:
            return self._extract_sift(gray)
    
    def _extract_superpoint(self, gray: np.ndarray) -> Dict:
        """Extract features using SuperPoint."""
        import torch
        
        # Prepare image tensor
        img_tensor = torch.from_numpy(gray / 255.0).float()[None, None].to(self.device)
        
        # Extract features
        with torch.no_grad():
            pred = self.superpoint({'image': img_tensor})
        
        keypoints = pred['keypoints'][0].cpu().numpy()
        descriptors = pred['descriptors'][0].cpu().numpy().T
        scores = pred['scores'][0].cpu().numpy()
        
        return {
            'keypoints': keypoints,
            'descriptors': descriptors,
            'scores': scores
        }
    
    def _extract_sift(self, gray: np.ndarray) -> Dict:
        """Extract features using SIFT (fallback)."""
        keypoints, descriptors = self.sift.detectAndCompute(gray, None)
        
        if keypoints is None or len(keypoints) == 0:
            return {
                'keypoints': np.array([]),
                'descriptors': np.array([]),
                'scores': np.array([])
            }
        
        # Convert to numpy arrays
        kp_array = np.array([kp.pt for kp in keypoints])
        scores = np.array([kp.response for kp in keypoints])
        
        return {
            'keypoints': kp_array,
            'descriptors': descriptors,
            'scores': scores
        }
    
    def match_features(self, features0: Dict, features1: Dict) -> Tuple[np.ndarray, np.ndarray]:
        """
        Match features between two images.
        
        Args:
            features0: Features from first image
            features1: Features from second image
            
        Returns:
            (matches, confidence) where matches is Nx2 array of matched indices
        """
        if self.torch_available and self.superglue is not None:
            return self._match_superglue(features0, features1)
        else:
            return self._match_sift(features0, features1)
    
    def _match_superglue(self, features0: Dict, features1: Dict) -> Tuple[np.ndarray, np.ndarray]:
        """Match features using SuperGlue."""
        import torch
        
        # Prepare data for SuperGlue
        data = {
            'keypoints0': torch.from_numpy(features0['keypoints'])[None].to(self.device),
            'keypoints1': torch.from_numpy(features1['keypoints'])[None].to(self.device),
            'descriptors0': torch.from_numpy(features0['descriptors'].T)[None].to(self.device),
            'descriptors1': torch.from_numpy(features1['descriptors'].T)[None].to(self.device),
            'scores0': torch.from_numpy(features0['scores'])[None].to(self.device),
            'scores1': torch.from_numpy(features1['scores'])[None].to(self.device),
            'image0': {'shape': [1, 1, 480, 640]},  # Dummy shape
            'image1': {'shape': [1, 1, 480, 640]},
        }
        
        # Match
        with torch.no_grad():
            pred = self.superglue(data)
        
        matches = pred['matches0'][0].cpu().numpy()
        confidence = pred['matching_scores0'][0].cpu().numpy()
        
        # Filter valid matches
        valid = matches > -1
        matches_array = np.column_stack([
            np.where(valid)[0],
            matches[valid]
        ])
        confidence_array = confidence[valid]
        
        return matches_array, confidence_array
    
    def _match_sift(self, features0: Dict, features1: Dict) -> Tuple[np.ndarray, np.ndarray]:
        """Match features using SIFT + FLANN (fallback)."""
        desc0 = features0['descriptors']
        desc1 = features1['descriptors']
        
        if desc0 is None or desc1 is None or len(desc0) == 0 or len(desc1) == 0:
            return np.array([]), np.array([])
        
        # FLANN matcher
        FLANN_INDEX_KDTREE = 1
        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
        search_params = dict(checks=50)
        flann = cv2.FlannBasedMatcher(index_params, search_params)
        
        # Match with kNN
        matches = flann.knnMatch(desc0, desc1, k=2)
        
        # Lowe's ratio test
        good_matches = []
        confidence = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.75 * n.distance:
                    good_matches.append([m.queryIdx, m.trainIdx])
                    confidence.append(1.0 - m.distance / 256.0)  # Normalize
        
        if len(good_matches) == 0:
            return np.array([]), np.array([])
        
        return np.array(good_matches), np.array(confidence)


class SphericalSfM:
    """
    Structure from Motion pipeline optimized for 360° equirectangular images.
    """
    
    def __init__(self, matcher: SuperPointSuperGlueMatcher):
        """
        Initialize SfM pipeline.
        
        Args:
            matcher: Feature matcher instance
        """
        self.matcher = matcher
        self.cameras = []
        self.points_3d = []
        self.point_colors = []
    
    def process_image_sequence(self, 
                               image_paths: List[str],
                               output_dir: str) -> Dict:
        """
        Process sequence of equirectangular images to compute camera poses.
        
        Args:
            image_paths: List of paths to equirectangular images
            output_dir: Directory to save reconstruction results
            
        Returns:
            Dictionary with poses and sparse point cloud
        """
        logger.info(f"Processing {len(image_paths)} images for SfM reconstruction")
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Step 1: Extract features from all images
        all_features = []
        all_images = []
        
        for img_path in image_paths:
            img = cv2.imread(img_path)
            all_images.append(img)
            
            features = self.matcher.extract_features(img)
            all_features.append(features)
            logger.info(f"✓ Extracted {len(features['keypoints'])} features from {Path(img_path).name}")
        
        # Step 2: Match features between consecutive images
        all_matches = []
        for i in range(len(all_features) - 1):
            matches, confidence = self.matcher.match_features(
                all_features[i], 
                all_features[i + 1]
            )
            all_matches.append((matches, confidence))
            logger.info(f"✓ Matched {len(matches)} features between image {i} and {i+1}")
        
        # Step 3: Incremental reconstruction
        # For now, we'll use a simplified approach with essential matrix estimation
        # In production, integrate with COLMAP or OpenMVG
        
        poses = self._estimate_poses_sequential(all_features, all_matches, all_images)
        sparse_cloud = self._triangulate_points(all_features, all_matches, poses)
        
        # Step 4: Save results
        self._save_reconstruction(poses, sparse_cloud, output_dir)
        
        return {
            'poses': poses,
            'sparse_cloud': sparse_cloud,
            'num_cameras': len(poses),
            'num_points': len(sparse_cloud['points'])
        }
    
    def _estimate_poses_sequential(self, features, matches, images):
        """Estimate camera poses using sequential approach."""
        poses = []
        
        # First camera at origin
        poses.append({
            'R': np.eye(3),
            't': np.zeros(3),
            'image_idx': 0
        })
        
        # Estimate subsequent poses
        for i in range(len(matches)):
            match_data, confidence = matches[i]
            
            if len(match_data) < 8:
                logger.warning(f"Insufficient matches ({len(match_data)}) for pose estimation")
                # Use identity relative pose as fallback
                R = np.eye(3)
                t = np.array([0, 0, 1])  # Move forward
            else:
                # Extract matched points
                pts0 = features[i]['keypoints'][match_data[:, 0]]
                pts1 = features[i + 1]['keypoints'][match_data[:, 1]]
                
                # For equirectangular images, convert to normalized 3D rays
                rays0 = self._pixels_to_rays(pts0, images[i].shape[:2])
                rays1 = self._pixels_to_rays(pts1, images[i + 1].shape[:2])
                
                # Estimate essential matrix
                E, mask = cv2.findEssentialMat(rays0, rays1, np.eye(3), cv2.RANSAC, 0.999, 0.01)
                
                if E is not None:
                    # Recover pose
                    _, R, t, mask = cv2.recoverPose(E, rays0, rays1, np.eye(3), mask=mask)
                else:
                    R = np.eye(3)
                    t = np.array([[0], [0], [1]])
                
                t = t.flatten()
            
            # Accumulate transformation
            prev_R = poses[-1]['R']
            prev_t = poses[-1]['t']
            
            new_R = R @ prev_R
            new_t = prev_t + prev_R @ t
            
            poses.append({
                'R': new_R,
                't': new_t,
                'image_idx': i + 1
            })
        
        return poses
    
    def _pixels_to_rays(self, pixels: np.ndarray, image_shape: Tuple[int, int]) -> np.ndarray:
        """
        Convert pixel coordinates in equirectangular image to 3D unit rays.
        
        Args:
            pixels: Nx2 array of (x, y) pixel coordinates
            image_shape: (height, width) of image
            
        Returns:
            Nx3 array of unit direction vectors
        """
        h, w = image_shape
        
        # Normalize to [0, 1]
        u = pixels[:, 0] / w
        v = pixels[:, 1] / h
        
        # Convert to spherical angles
        theta = (u - 0.5) * 2 * np.pi  # longitude: -π to π
        phi = (0.5 - v) * np.pi  # latitude: -π/2 to π/2
        
        # Convert to 3D unit vectors
        x = np.cos(phi) * np.sin(theta)
        y = np.sin(phi)
        z = np.cos(phi) * np.cos(theta)
        
        rays = np.column_stack([x, y, z])
        
        # Normalize
        rays = rays / np.linalg.norm(rays, axis=1, keepdims=True)
        
        return rays
    
    def _triangulate_points(self, features, matches, poses):
        """Triangulate 3D points from matches and poses."""
        points_3d = []
        colors = []
        
        # For simplicity, triangulate points from first two views
        if len(matches) > 0 and len(poses) >= 2:
            match_data, _ = matches[0]
            
            if len(match_data) > 0:
                pts0 = features[0]['keypoints'][match_data[:, 0]]
                pts1 = features[1]['keypoints'][match_data[:, 1]]
                
                # Create projection matrices
                P0 = np.hstack([poses[0]['R'], poses[0]['t'].reshape(-1, 1)])
                P1 = np.hstack([poses[1]['R'], poses[1]['t'].reshape(-1, 1)])
                
                # Triangulate
                points_4d = cv2.triangulatePoints(P0, P1, pts0.T, pts1.T)
                points_3d = (points_4d[:3] / points_4d[3]).T
                
                # Assign random colors for now
                colors = np.random.randint(0, 255, (len(points_3d), 3))
        
        return {
            'points': np.array(points_3d) if len(points_3d) > 0 else np.array([]),
            'colors': np.array(colors) if len(colors) > 0 else np.array([])
        }
    
    def _save_reconstruction(self, poses, sparse_cloud, output_dir):
        """Save reconstruction results."""
        # Save poses as JSON
        poses_serializable = []
        for pose in poses:
            poses_serializable.append({
                'R': pose['R'].tolist(),
                't': pose['t'].tolist(),
                'image_idx': int(pose['image_idx'])
            })
        
        with open(os.path.join(output_dir, 'poses.json'), 'w') as f:
            json.dump(poses_serializable, f, indent=2)
        
        # Save sparse point cloud as PLY
        if len(sparse_cloud['points']) > 0:
            self._save_ply(
                os.path.join(output_dir, 'sparse_cloud.ply'),
                sparse_cloud['points'],
                sparse_cloud['colors']
            )
        
        logger.info(f"✓ Saved reconstruction to {output_dir}")
    
    def _save_ply(self, filepath, points, colors):
        """Save point cloud in PLY format."""
        with open(filepath, 'w') as f:
            f.write('ply\n')
            f.write('format ascii 1.0\n')
            f.write(f'element vertex {len(points)}\n')
            f.write('property float x\n')
            f.write('property float y\n')
            f.write('property float z\n')
            f.write('property uchar red\n')
            f.write('property uchar green\n')
            f.write('property uchar blue\n')
            f.write('end_header\n')
            
            for pt, col in zip(points, colors):
                f.write(f'{pt[0]} {pt[1]} {pt[2]} {int(col[0])} {int(col[1])} {int(col[2])}\n')


def main():
    """Command-line interface for Stage 2 processing."""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Stage 2: Spherical SfM')
    parser.add_argument('--input', type=str, required=True,
                       help='Folder with equirectangular images')
    parser.add_argument('--output', type=str, required=True,
                       help='Output directory for reconstruction')
    parser.add_argument('--device', type=str, default='cuda',
                       help='Device for deep learning (cuda/cpu)')
    
    args = parser.parse_args()
    
    # Initialize matcher and SfM pipeline
    matcher = SuperPointSuperGlueMatcher(device=args.device)
    sfm = SphericalSfM(matcher)
    
    # Get image files
    image_files = sorted([
        os.path.join(args.input, f) 
        for f in os.listdir(args.input) 
        if f.lower().endswith(('.png', '.jpg', '.jpeg'))
    ])
    
    if len(image_files) < 2:
        print(f"Error: Need at least 2 images, found {len(image_files)}")
        return 1
    
    # Process
    result = sfm.process_image_sequence(image_files, args.output)
    
    logger.info(f"✓ Reconstruction complete:")
    logger.info(f"  - Cameras: {result['num_cameras']}")
    logger.info(f"  - 3D Points: {result['num_points']}")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())

