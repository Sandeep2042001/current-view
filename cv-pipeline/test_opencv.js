#!/usr/bin/env node

/**
 * Test script to verify OpenCV installation and functionality
 */

const cv = require('opencv4nodejs');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing OpenCV installation...\n');

try {
  // Test basic OpenCV functionality
  console.log('📊 OpenCV Version:', cv.version);
  console.log('✅ OpenCV loaded successfully\n');

  // Test image creation and manipulation
  console.log('🖼️  Testing image creation...');
  const testImage = new cv.Mat(100, 100, cv.CV_8UC3, [255, 0, 0]); // Blue image
  console.log('✅ Image created:', testImage.rows, 'x', testImage.cols);

  // Test feature detector
  console.log('🔍 Testing feature detection...');
  const detector = new cv.ORBDetector();
  console.log('✅ ORB detector created');

  // Test grayscale conversion
  const gray = testImage.cvtColor(cv.COLOR_BGR2GRAY);
  console.log('✅ Grayscale conversion successful');

  // Test keypoint detection
  const keypoints = detector.detect(gray);
  console.log('✅ Keypoint detection successful:', keypoints.length, 'keypoints found');

  // Test descriptor computation
  const descriptors = detector.compute(gray, keypoints);
  console.log('✅ Descriptor computation successful');

  // Test matcher
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
  console.log('✅ BF Matcher created');

  // Test homography calculation (with dummy points)
  const srcPoints = new cv.Point2fVector([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ]);
  
  const dstPoints = new cv.Point2fVector([
    { x: 10, y: 10 },
    { x: 110, y: 10 },
    { x: 110, y: 110 },
    { x: 10, y: 110 }
  ]);

  const homographyResult = cv.findHomography(srcPoints, dstPoints, cv.RANSAC, 5.0);
  console.log('✅ Homography calculation successful');

  // Clean up memory
  testImage.release();
  gray.release();
  srcPoints.delete();
  dstPoints.delete();
  if (homographyResult) homographyResult.delete();

  console.log('\n🎉 All OpenCV tests passed!');
  console.log('✅ OpenCV stitching processor is ready to use.');

} catch (error) {
  console.error('\n❌ OpenCV test failed:', error.message);
  console.error('\n📋 Troubleshooting:');
  console.error('1. Make sure OpenCV is properly installed');
  console.error('2. Check that all system dependencies are installed');
  console.error('3. Verify the Docker build completed successfully');
  console.error('4. Try rebuilding the Docker container');
  
  process.exit(1);
}
