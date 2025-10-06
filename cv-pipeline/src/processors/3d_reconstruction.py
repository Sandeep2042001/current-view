#!/usr/bin/env python3
"""
3D Reconstruction Processor
Implements Structure from Motion (SfM) and Multi-View Stereo (MVS)
for creating 3D models from multiple images
"""

import cv2
import numpy as np
import json
import sys
import os
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ThreeDReconstructor:
    """
    3D Reconstruction using Structure from Motion (SfM)
    """
    
    def __init__(self):
        self.feature_detector = None
        self.matcher = None
        self.camera_matrix = None
        self.dist_coeffs = None
        
    def reconstruct_from_images(self, image_paths, output_dir):
        """
        Main reconstruction pipeline
        
        Args:
            image_paths: List of paths to input images
            output_dir: Directory to save reconstruction results
            
        Returns:
            dict: Reconstruction results including point cloud and camera poses
        """
        try:
            logger.info(f"Starting 3D reconstruction with {len(image_paths)} images")
            
            # Step 1: Load images
            images = self.load_images(image_paths)
            if len(images) < 2:
                raise ValueError("Need at least 2 images for reconstruction")
            
            # Step 2: Feature detection and matching
            logger.info("Detecting features...")
            features = self.detect_features(images)
            
            logger.info("Matching features...")
            matches = self.match_features(features)
            
            # Step 3: Camera pose estimation (Structure from Motion)
            logger.info("Estimating camera poses...")
            camera_poses, points_3d = self.estimate_camera_poses(images, features, matches)
            
            # Step 4: Dense reconstruction
            logger.info("Performing dense reconstruction...")
            dense_points = self.dense_reconstruction(images, camera_poses)
            
            # Step 5: Mesh generation
            logger.info("Generating 3D mesh...")
            mesh = self.generate_mesh(dense_points)
            
            # Step 6: Texture mapping
            logger.info("Applying textures...")
            textured_mesh = self.apply_textures(mesh, images, camera_poses)
            
            # Step 7: Save results
            logger.info("Saving reconstruction results...")
            output_files = self.save_reconstruction(
                output_dir,
                points_3d,
                dense_points,
                textured_mesh,
                camera_poses
            )
            
            result = {
                'success': True,
                'point_cloud_path': output_files['point_cloud'],
                'mesh_path': output_files['mesh'],
                'camera_poses': camera_poses,
                'statistics': {
                    'num_images': len(images),
                    'num_sparse_points': len(points_3d),
                    'num_dense_points': len(dense_points) if dense_points is not None else 0,
                    'num_cameras': len(camera_poses)
                }
            }
            
            logger.info("3D reconstruction completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error in 3D reconstruction: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def load_images(self, image_paths):
        """Load and validate images"""
        images = []
        for path in image_paths:
            img = cv2.imread(path)
            if img is None:
                logger.warning(f"Failed to load image: {path}")
                continue
            images.append({
                'path': path,
                'data': img,
                'height': img.shape[0],
                'width': img.shape[1]
            })
        return images
    
    def detect_features(self, images):
        """
        Detect SIFT features in all images
        SIFT is best for 3D reconstruction due to scale and rotation invariance
        """
        # Initialize SIFT detector
        sift = cv2.SIFT_create(nfeatures=10000)
        
        features_list = []
        for img_data in images:
            gray = cv2.cvtColor(img_data['data'], cv2.COLOR_BGR2GRAY)
            
            # Detect keypoints and compute descriptors
            keypoints, descriptors = sift.detectAndCompute(gray, None)
            
            features_list.append({
                'image_path': img_data['path'],
                'keypoints': keypoints,
                'descriptors': descriptors,
                'num_features': len(keypoints)
            })
            
            logger.info(f"Detected {len(keypoints)} features in {os.path.basename(img_data['path'])}")
        
        return features_list
    
    def match_features(self, features_list):
        """
        Match features between all image pairs using FLANN matcher
        """
        # FLANN matcher for fast approximate nearest neighbor matching
        FLANN_INDEX_KDTREE = 1
        index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
        search_params = dict(checks=50)
        flann = cv2.FlannBasedMatcher(index_params, search_params)
        
        matches_dict = {}
        
        for i in range(len(features_list)):
            for j in range(i + 1, len(features_list)):
                feat1 = features_list[i]
                feat2 = features_list[j]
                
                if feat1['descriptors'] is None or feat2['descriptors'] is None:
                    continue
                
                # Find matches
                matches = flann.knnMatch(feat1['descriptors'], feat2['descriptors'], k=2)
                
                # Apply ratio test (Lowe's ratio test)
                good_matches = []
                for match_pair in matches:
                    if len(match_pair) == 2:
                        m, n = match_pair
                        if m.distance < 0.7 * n.distance:
                            good_matches.append(m)
                
                if len(good_matches) > 10:
                    matches_dict[(i, j)] = {
                        'matches': good_matches,
                        'num_matches': len(good_matches)
                    }
                    logger.info(f"Matched {len(good_matches)} features between image {i} and {j}")
        
        return matches_dict
    
    def estimate_camera_poses(self, images, features, matches_dict):
        """
        Estimate camera poses using Essential Matrix and triangulation
        This is a simplified SfM implementation
        """
        # Initialize camera matrix (assume typical camera parameters)
        focal_length = max(images[0]['width'], images[0]['height'])
        center = (images[0]['width'] / 2, images[0]['height'] / 2)
        
        self.camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float32)
        
        self.dist_coeffs = np.zeros(5)
        
        camera_poses = []
        points_3d = []
        
        # Start with first two images
        if (0, 1) in matches_dict:
            match_data = matches_dict[(0, 1)]
            matches = match_data['matches']
            
            # Get matched keypoint coordinates
            pts1 = np.float32([features[0]['keypoints'][m.queryIdx].pt for m in matches])
            pts2 = np.float32([features[1]['keypoints'][m.trainIdx].pt for m in matches])
            
            # Estimate Essential Matrix
            E, mask = cv2.findEssentialMat(pts1, pts2, self.camera_matrix, cv2.RANSAC, 0.999, 1.0)
            
            # Recover camera pose
            _, R, t, mask = cv2.recoverPose(E, pts1, pts2, self.camera_matrix)
            
            # First camera at origin
            camera_poses.append({
                'image_index': 0,
                'rotation': np.eye(3).tolist(),
                'translation': np.zeros(3).tolist(),
                'image_path': images[0]['path']
            })
            
            # Second camera with estimated pose
            camera_poses.append({
                'image_index': 1,
                'rotation': R.tolist(),
                'translation': t.flatten().tolist(),
                'image_path': images[1]['path']
            })
            
            # Triangulate points
            proj1 = self.camera_matrix @ np.hstack([np.eye(3), np.zeros((3, 1))])
            proj2 = self.camera_matrix @ np.hstack([R, t])
            
            points_4d = cv2.triangulatePoints(proj1, proj2, pts1.T, pts2.T)
            points_3d = (points_4d[:3] / points_4d[3]).T
            
            logger.info(f"Triangulated {len(points_3d)} 3D points")
        
        return camera_poses, points_3d
    
    def dense_reconstruction(self, images, camera_poses):
        """
        Perform dense reconstruction using stereo matching
        This is a simplified version - production would use PMVS2 or OpenMVS
        """
        if len(images) < 2:
            return None
        
        dense_points = []
        
        # For each consecutive image pair
        for i in range(len(images) - 1):
            img1 = cv2.cvtColor(images[i]['data'], cv2.COLOR_BGR2GRAY)
            img2 = cv2.cvtColor(images[i + 1]['data'], cv2.COLOR_BGR2GRAY)
            
            # Compute stereo disparity
            stereo = cv2.StereoBM_create(numDisparities=16*5, blockSize=15)
            disparity = stereo.compute(img1, img2)
            
            # Convert disparity to depth
            # This is simplified - real implementation would use calibrated cameras
            h, w = disparity.shape
            for y in range(0, h, 10):  # Sample every 10 pixels for efficiency
                for x in range(0, w, 10):
                    d = disparity[y, x]
                    if d > 0:
                        z = (focal_length * baseline) / d if d > 0 else 0
                        point_3d = [x - w/2, y - h/2, z]
                        dense_points.append(point_3d)
        
        logger.info(f"Generated {len(dense_points)} dense points")
        return np.array(dense_points) if dense_points else None
    
    def generate_mesh(self, points_3d):
        """
        Generate 3D mesh from point cloud using Delaunay triangulation
        Production systems would use Poisson reconstruction or Ball Pivoting
        """
        if points_3d is None or len(points_3d) < 4:
            logger.warning("Not enough points for mesh generation")
            return None
        
        # Simple mesh generation using scipy or custom algorithm
        # For now, return the point cloud itself
        # In production, you'd use Open3D or CGAL for proper meshing
        
        mesh = {
            'vertices': points_3d.tolist() if isinstance(points_3d, np.ndarray) else points_3d,
            'faces': [],  # Would be generated by triangulation
            'normals': []
        }
        
        return mesh
    
    def apply_textures(self, mesh, images, camera_poses):
        """
        Apply image textures to the 3D mesh
        """
        if mesh is None:
            return None
        
        # Texture mapping would project images onto mesh surfaces
        # This requires UV mapping and visibility testing
        
        textured_mesh = {
            **mesh,
            'texture_images': [img['path'] for img in images],
            'has_texture': True
        }
        
        return textured_mesh
    
    def save_reconstruction(self, output_dir, points_3d, dense_points, mesh, camera_poses):
        """
        Save reconstruction results in various formats
        """
        os.makedirs(output_dir, exist_ok=True)
        
        output_files = {}
        
        # Save sparse point cloud (PLY format)
        sparse_ply = os.path.join(output_dir, 'sparse_point_cloud.ply')
        self.save_ply(sparse_ply, points_3d)
        output_files['point_cloud'] = sparse_ply
        
        # Save dense point cloud if available
        if dense_points is not None:
            dense_ply = os.path.join(output_dir, 'dense_point_cloud.ply')
            self.save_ply(dense_ply, dense_points)
            output_files['dense_point_cloud'] = dense_ply
        
        # Save mesh
        if mesh is not None:
            mesh_path = os.path.join(output_dir, 'mesh.obj')
            self.save_obj(mesh_path, mesh)
            output_files['mesh'] = mesh_path
        
        # Save camera poses
        poses_path = os.path.join(output_dir, 'camera_poses.json')
        with open(poses_path, 'w') as f:
            json.dump(camera_poses, f, indent=2)
        output_files['camera_poses'] = poses_path
        
        return output_files
    
    def save_ply(self, filepath, points):
        """Save points as PLY file"""
        with open(filepath, 'w') as f:
            f.write('ply\n')
            f.write('format ascii 1.0\n')
            f.write(f'element vertex {len(points)}\n')
            f.write('property float x\n')
            f.write('property float y\n')
            f.write('property float z\n')
            f.write('end_header\n')
            
            for point in points:
                f.write(f'{point[0]} {point[1]} {point[2]}\n')
        
        logger.info(f"Saved {len(points)} points to {filepath}")
    
    def save_obj(self, filepath, mesh):
        """Save mesh as OBJ file"""
        with open(filepath, 'w') as f:
            # Write vertices
            for vertex in mesh['vertices']:
                f.write(f"v {vertex[0]} {vertex[1]} {vertex[2]}\n")
            
            # Write faces (if available)
            for face in mesh.get('faces', []):
                f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")
        
        logger.info(f"Saved mesh to {filepath}")


def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 3:
        print("Usage: python 3d_reconstruction.py <image1> <image2> ... <output_dir>")
        sys.exit(1)
    
    image_paths = sys.argv[1:-1]
    output_dir = sys.argv[-1]
    
    reconstructor = ThreeDReconstructor()
    result = reconstructor.reconstruct_from_images(image_paths, output_dir)
    
    print(json.dumps(result, indent=2))
    
    if result['success']:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()

