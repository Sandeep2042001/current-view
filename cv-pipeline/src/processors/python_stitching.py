#!/usr/bin/env python3
"""
Python-based OpenCV stitching processor for high-quality panorama creation.
This provides an alternative to the Node.js implementation.
"""

import cv2
import numpy as np
import json
import sys
import os
import tempfile
from typing import List, Dict, Tuple, Optional

class PythonStitchingProcessor:
    def __init__(self):
        self.detector = cv2.ORB_create(nfeatures=1000)
        self.matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        
    def process_stitching_job(self, job_data: Dict) -> Dict:
        """
        Process a stitching job using Python OpenCV.
        
        Args:
            job_data: Dictionary containing room_id and image_ids
            
        Returns:
            Dictionary with stitching results
        """
        try:
            room_id = job_data['room_id']
            image_ids = job_data['image_ids']
            
            print(f"🚀 PYTHON OPENCV STITCHING: Room {room_id} - {len(image_ids)} images")
            
            if len(image_ids) < 2:
                raise ValueError("At least 2 images required for stitching")
            
            # Load images (this would be replaced with actual image loading from MinIO)
            images = self.load_images_from_ids(image_ids)
            
            # Perform quality checks
            quality_results = self.perform_quality_checks(images)
            acceptable_images = [img for img, quality in zip(images, quality_results) 
                               if quality['overall_quality'] > 60]
            
            if len(acceptable_images) < 2:
                raise ValueError("Insufficient high-quality images for stitching")
            
            print(f"📊 Quality check: {len(acceptable_images)}/{len(images)} images passed")
            
            # Extract features
            features = self.extract_features(acceptable_images)
            print(f"🔍 Extracted features for {len(features)} images")
            
            # Match features
            matches = self.match_features(features)
            print(f"🔗 Found {len(matches)} feature matches")
            
            # Calculate homographies
            homographies = self.calculate_homographies(features, matches)
            print(f"📐 Calculated {len(homographies)} homographies")
            
            # Stitch images
            stitched_result = self.stitch_images_opencv(acceptable_images, homographies)
            print(f"🎯 Stitching completed with quality: {stitched_result['quality']:.2f}")
            
            # Save stitched image
            output_path = self.save_stitched_image(stitched_result, room_id)
            
            return {
                'success': True,
                'stitched_image_path': output_path,
                'quality_score': stitched_result['quality'],
                'processed_images': len(acceptable_images),
                'feature_matches': len(matches),
                'homographies_calculated': len(homographies),
                'total_keypoints': sum(len(f['keypoints']) for f in features),
                'stitching_method': 'python_opencv'
            }
            
        except Exception as e:
            print(f"❌ PYTHON STITCHING FAILED: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def load_images_from_ids(self, image_ids: List[str]) -> List[np.ndarray]:
        """
        Load images from storage (placeholder implementation).
        In production, this would load from MinIO.
        """
        # Placeholder - in production, load from MinIO using image_ids
        images = []
        for i, img_id in enumerate(image_ids):
            # Create a sample image for testing
            # In production: load from MinIO using img_id
            img = np.random.randint(0, 255, (2048, 4096, 3), dtype=np.uint8)
            images.append(img)
        
        return images
    
    def perform_quality_checks(self, images: List[np.ndarray]) -> List[Dict]:
        """Perform quality analysis on images."""
        quality_results = []
        
        for img in images:
            # Convert to grayscale for analysis
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Blur detection using Laplacian variance
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            blur_score = min(100, max(0, laplacian_var / 50))
            
            # Exposure analysis
            mean_brightness = np.mean(gray)
            exposure_score = 100 - abs(mean_brightness - 128) / 1.28
            
            # Contrast analysis
            contrast_score = gray.std() / 2.55
            
            # Overall quality
            overall_quality = (blur_score + exposure_score + contrast_score) / 3
            
            quality_results.append({
                'blur_score': blur_score,
                'exposure_score': exposure_score,
                'contrast_score': contrast_score,
                'overall_quality': overall_quality,
                'is_acceptable': overall_quality > 60
            })
        
        return quality_results
    
    def extract_features(self, images: List[np.ndarray]) -> List[Dict]:
        """Extract ORB features from images."""
        features = []
        
        for i, img in enumerate(images):
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Detect keypoints and compute descriptors
            keypoints, descriptors = self.detector.detectAndCompute(gray, None)
            
            features.append({
                'image_id': i,
                'image': img,
                'gray': gray,
                'keypoints': keypoints,
                'descriptors': descriptors
            })
        
        return features
    
    def match_features(self, features: List[Dict]) -> List[Dict]:
        """Match features between consecutive images."""
        matches = []
        
        for i in range(len(features) - 1):
            feature1 = features[i]
            feature2 = features[i + 1]
            
            if feature1['descriptors'] is None or feature2['descriptors'] is None:
                continue
            
            # Match descriptors
            knn_matches = self.matcher.knnMatch(
                feature1['descriptors'], 
                feature2['descriptors'], 
                k=2
            )
            
            # Apply Lowe's ratio test
            good_matches = []
            for match_pair in knn_matches:
                if len(match_pair) == 2:
                    m, n = match_pair
                    if m.distance < 0.75 * n.distance:
                        good_matches.append(m)
            
            # Only proceed if we have enough good matches
            if len(good_matches) >= 10:
                matches.append({
                    'image1_id': feature1['image_id'],
                    'image2_id': feature2['image_id'],
                    'matches': good_matches,
                    'feature1': feature1,
                    'feature2': feature2,
                    'confidence': len(good_matches) / min(len(feature1['keypoints']), len(feature2['keypoints']))
                })
        
        return matches
    
    def calculate_homographies(self, features: List[Dict], matches: List[Dict]) -> List[Dict]:
        """Calculate homography matrices from feature matches."""
        homographies = []
        
        for match in matches:
            # Extract matched keypoints
            src_points = np.float32([features[match['image1_id']]['keypoints'][m.queryIdx].pt 
                                   for m in match['matches']]).reshape(-1, 1, 2)
            dst_points = np.float32([features[match['image2_id']]['keypoints'][m.trainIdx].pt 
                                   for m in match['matches']]).reshape(-1, 1, 2)
            
            # Calculate homography using RANSAC
            homography, mask = cv2.findHomography(src_points, dst_points, cv2.RANSAC, 5.0)
            
            if homography is not None:
                inliers = np.sum(mask)
                homographies.append({
                    'image1_id': match['image1_id'],
                    'image2_id': match['image2_id'],
                    'matrix': homography,
                    'confidence': match['confidence'],
                    'inliers': inliers
                })
        
        return homographies
    
    def stitch_images_opencv(self, images: List[np.ndarray], homographies: List[Dict]) -> Dict:
        """Stitch images using OpenCV."""
        try:
            if len(homographies) == 0:
                raise ValueError("No valid homographies found for stitching")
            
            # Start with the first image
            panorama = images[0].copy()
            
            # Transform and blend each subsequent image
            for i in range(1, len(images)):
                homography = homographies[i-1] if i-1 < len(homographies) else None
                
                if homography:
                    # Warp the current image
                    h, w = panorama.shape[:2]
                    warped = cv2.warpPerspective(images[i], homography['matrix'], (w, h))
                    
                    # Create a mask for blending
                    mask = np.zeros((h, w), dtype=np.uint8)
                    mask.fill(255)
                    
                    # Simple blending (in production, use advanced techniques)
                    panorama = cv2.addWeighted(panorama, 0.5, warped, 0.5, 0)
            
            # Calculate stitching quality
            quality = self.calculate_stitching_quality(panorama, len(images))
            
            return {
                'image': panorama,
                'quality': quality
            }
            
        except Exception as e:
            raise ValueError(f"Failed to stitch images: {str(e)}")
    
    def calculate_stitching_quality(self, panorama: np.ndarray, num_images: int) -> float:
        """Calculate stitching quality metrics."""
        gray = cv2.cvtColor(panorama, cv2.COLOR_BGR2GRAY)
        
        # Calculate sharpness
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        sharpness = min(1.0, laplacian_var / 100)
        
        # Base quality
        base_quality = sharpness * 0.8
        
        # Bonus for multiple images
        image_bonus = min(0.2, num_images * 0.05)
        
        return min(0.95, base_quality + image_bonus)
    
    def save_stitched_image(self, stitched_result: Dict, room_id: str) -> str:
        """Save stitched image to temporary file."""
        # In production, this would save to MinIO
        temp_dir = tempfile.gettempdir()
        filename = f"panorama_{room_id}_{int(time.time())}.jpg"
        filepath = os.path.join(temp_dir, filename)
        
        cv2.imwrite(filepath, stitched_result['image'])
        
        return filepath

def main():
    """Main function for command-line usage."""
    if len(sys.argv) != 2:
        print("Usage: python python_stitching.py <job_data_json>")
        sys.exit(1)
    
    try:
        job_data = json.loads(sys.argv[1])
        processor = PythonStitchingProcessor()
        result = processor.process_stitching_job(job_data)
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    import time
    main()
