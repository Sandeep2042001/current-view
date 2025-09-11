import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Vibration,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Room } from '../types/User';

interface CameraScreenProps {
  navigation: any;
  route: {
    params: {
      room: Room;
    };
  };
}

const { width, height } = Dimensions.get('window');

export default function CameraScreen({ navigation, route }: CameraScreenProps) {
  const { room } = route.params;
  const cameraRef = useRef<RNCamera>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const [flashMode, setFlashMode] = useState('off');
  const [cameraType, setCameraType] = useState('back');

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const options = {
        quality: 0.8,
        base64: false,
        skipProcessing: false,
        orientation: 'portrait',
        fixOrientation: true,
        forceUpOrientation: true,
      };

      const data = await cameraRef.current.takePictureAsync(options);
      
      // TODO: Save image with metadata (gyro, compass, etc.)
      console.log('Photo captured:', data.uri);
      
      setCapturedCount(prev => prev + 1);
      Vibration.vibrate(100);
      
      Alert.alert(
        'Photo Captured',
        `Image ${capturedCount + 1} captured successfully`,
        [
          { text: 'Continue', onPress: () => {} },
          { text: 'Finish', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleFlash = () => {
    setFlashMode(prev => prev === 'off' ? 'on' : 'off');
  };

  const toggleCamera = () => {
    setCameraType(prev => prev === 'back' ? 'front' : 'back');
  };

  const finishCapture = () => {
    Alert.alert(
      'Finish Capture',
      `You have captured ${capturedCount} images. Are you sure you want to finish?`,
      [
        { text: 'Continue Capturing', style: 'cancel' },
        { text: 'Finish', onPress: () => navigation.goBack() },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={cameraType}
        flashMode={flashMode}
        captureAudio={false}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => navigation.goBack()}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.captureCount}>Images: {capturedCount}</Text>
            </View>

            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              <Icon name={flashMode === 'on' ? 'flash-on' : 'flash-off'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.centerGuide}>
            <View style={styles.guideCircle}>
              <Text style={styles.guideText}>360°</Text>
            </View>
            <Text style={styles.instructionText}>
              Position camera at eye level and capture from different angles
            </Text>
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Icon name="flip-camera-android" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.captureButtonDisabled]}
              onPress={capturePhoto}
              disabled={isCapturing}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={finishCapture}>
              <Icon name="check" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </RNCamera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomInfo: {
    alignItems: 'center',
  },
  roomName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  captureCount: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  centerGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  guideCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  guideText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.9,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});
