#!/usr/bin/env python3
"""
Test script for OpenCV stitching functionality
Tests the advanced stitching processor with sample images
"""

import sys
import os
import cv2
import numpy as np
from pathlib import Path

# Add the processors directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src', 'processors'))

from opencv_stitching import AdvancedOpenCVStitcher, StitchingResult

def create_test_images(output_dir: str, num_images: int = 3) -> list:
    """Create synthetic test images for stitching"""
    print(f"Creating {num_images} test images in {output_dir}")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    image_paths = []
    
    for i in range(num_images):
        # Create a synthetic image with different patterns
        img = np.zeros((400, 600, 3), dtype=np.uint8)
        
        # Add different colored rectangles for each image
        colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255)]
        color = colors[i % len(colors)]
        
        # Fill with base color
        img[:, :] = color
        
        # Add some patterns to make stitching easier
        # Add circles
        cv2.circle(img, (100 + i * 50, 100 + i * 30), 30, (255, 255, 255), -1)
        cv2.circle(img, (500 - i * 40, 300 - i * 20), 25, (0, 0, 0), -1)
        
        # Add rectangles
        cv2.rectangle(img, (200 + i * 20, 200 + i * 15), (300 + i * 20, 250 + i * 15), (255, 255, 255), -1)
        
        # Add text
        cv2.putText(img, f'Image {i+1}', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Add some noise to make it more realistic
        noise = np.random.randint(0, 50, img.shape, dtype=np.uint8)
        img = cv2.add(img, noise)
        
        # Save image
        image_path = os.path.join(output_dir, f'test_image_{i+1}.jpg')
        cv2.imwrite(image_path, img)
        image_paths.append(image_path)
        
        print(f"Created test image: {image_path}")
    
    return image_paths

def test_opencv_stitching():
    """Test the OpenCV stitching functionality"""
    print("🧪 Testing OpenCV Stitching Processor")
    print("=" * 50)
    
    # Create test directory
    test_dir = "test_images"
    output_dir = "test_output"
    
    try:
        # Create test images
        print("\n📸 Step 1: Creating test images...")
        image_paths = create_test_images(test_dir, 3)
        
        # Initialize stitcher
        print("\n🔧 Step 2: Initializing OpenCV stitcher...")
        stitcher = AdvancedOpenCVStitcher()
        
        # Test stitching
        print("\n🎯 Step 3: Running stitching test...")
        output_path = os.path.join(output_dir, "test_panorama.jpg")
        os.makedirs(output_dir, exist_ok=True)
        
        result = stitcher.stitch_images(image_paths, output_path)
        
        # Display results
        print("\n📊 Step 4: Results Analysis")
        print("=" * 30)
        
        if result.success:
            print("✅ SUCCESS: Stitching completed successfully!")
            print(f"📁 Output file: {result.panorama_path}")
            print(f"🎯 Quality Score: {result.quality_score:.1f}%")
            print(f"📈 Processed Images: {result.processed_images}")
            print(f"❌ Rejected Images: {result.rejected_images}")
            
            if result.metadata:
                print(f"🔍 Features Detected: {result.metadata.get('features_detected', 'N/A')}")
                print(f"🔗 Valid Matches: {result.metadata.get('valid_matches', 'N/A')}")
                print(f"📐 Panorama Size: {result.metadata.get('panorama_size', 'N/A')}")
            
            # Verify output file exists and is valid
            if os.path.exists(output_path):
                img = cv2.imread(output_path)
                if img is not None:
                    print(f"✅ Output image verified: {img.shape}")
                else:
                    print("❌ Output image is corrupted")
            else:
                print("❌ Output file not found")
                
        else:
            print("❌ FAILED: Stitching failed!")
            print(f"🚨 Error: {result.error_message}")
        
        # Test quality assessment
        print("\n🔍 Step 5: Testing quality assessment...")
        if image_paths:
            test_img = cv2.imread(image_paths[0])
            if test_img is not None:
                quality = stitcher._assess_image_quality(test_img)
                print(f"📊 Test image quality:")
                print(f"   Blur Score: {quality.blur_score:.1f}%")
                print(f"   Exposure Score: {quality.exposure_score:.1f}%")
                print(f"   Sharpness Score: {quality.sharpness_score:.1f}%")
                print(f"   Contrast Score: {quality.contrast_score:.1f}%")
                print(f"   Overall Score: {quality.overall_score:.1f}%")
                print(f"   Acceptable: {'Yes' if quality.is_acceptable else 'No'}")
        
        print("\n🎉 Test completed!")
        
        return result.success
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup test files
        print("\n🧹 Cleaning up test files...")
        try:
            import shutil
            if os.path.exists(test_dir):
                shutil.rmtree(test_dir)
            if os.path.exists(output_dir):
                shutil.rmtree(output_dir)
            print("✅ Cleanup completed")
        except Exception as e:
            print(f"⚠️ Cleanup failed: {str(e)}")

def test_opencv_availability():
    """Test if OpenCV is properly installed and working"""
    print("🔍 Testing OpenCV availability...")
    
    try:
        # Test basic OpenCV functionality
        print(f"OpenCV Version: {cv2.__version__}")
        
        # Test if SIFT detector works
        detector = cv2.SIFT_create()
        print("✅ SIFT detector created successfully")
        
        # Test if stitcher works
        stitcher = cv2.Stitcher_create()
        print("✅ Stitcher created successfully")
        
        # Test image operations
        test_img = np.zeros((100, 100, 3), dtype=np.uint8)
        gray = cv2.cvtColor(test_img, cv2.COLOR_BGR2GRAY)
        print("✅ Image operations working")
        
        return True
        
    except Exception as e:
        print(f"❌ OpenCV test failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 OpenCV Stitching Test Suite")
    print("=" * 50)
    
    # Test OpenCV availability first
    if not test_opencv_availability():
        print("\n❌ OpenCV is not properly installed. Please install OpenCV first.")
        sys.exit(1)
    
    print("\n✅ OpenCV is working correctly!")
    
    # Run stitching test
    success = test_opencv_stitching()
    
    if success:
        print("\n🎉 All tests passed! OpenCV stitching is working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
        sys.exit(1)
