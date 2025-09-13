import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Vibration,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { accelerometer, gyroscope, magnetometer, SensorTypes } from 'react-native-sensors';
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
  
  // Sensor state
  const [sensorData, setSensorData] = useState({
    gyroscope: { x: 0, y: 0, z: 0 },
    accelerometer: { x: 0, y: 0, z: 0 },
    magnetometer: { x: 0, y: 0, z: 0 },
    compass: 0,
  });
  const [isLevelStable, setIsLevelStable] = useState(false);
  const [compassHeading, setCompassHeading] = useState(0);

  // Initialize sensors
  useEffect(() => {
    const requestSensorPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
        } catch (err) {
          console.warn('Location permission denied');
        }
      }
    };

    requestSensorPermissions();

    // Subscribe to sensors
    const gyroSubscription = gyroscope.subscribe(({ x, y, z, timestamp }) => {
      setSensorData(prev => ({
        ...prev,
        gyroscope: { x, y, z }
      }));
    });

    const accelSubscription = accelerometer.subscribe(({ x, y, z, timestamp }) => {
      setSensorData(prev => ({
        ...prev,
        accelerometer: { x, y, z }
      }));
      
      // Check if device is level (for stability indication)
      const isStable = Math.abs(x) < 0.5 && Math.abs(y) < 0.5;
      setIsLevelStable(isStable);
    });

    const magnetSubscription = magnetometer.subscribe(({ x, y, z, timestamp }) => {
      setSensorData(prev => ({
        ...prev,
        magnetometer: { x, y, z }
      }));
      
      // Calculate compass heading
      const heading = Math.atan2(y, x) * (180 / Math.PI);
      const normalizedHeading = heading < 0 ? heading + 360 : heading;
      setCompassHeading(normalizedHeading);
      setSensorData(prev => ({
        ...prev,
        compass: normalizedHeading
      }));
    });

    return () => {
      gyroSubscription.unsubscribe();
      accelSubscription.unsubscribe();
      magnetSubscription.unsubscribe();
    };
  }, []);

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
      
      // Include sensor metadata with the image
      const metadata = {
        timestamp: Date.now(),
        gyroscope: sensorData.gyroscope,
        accelerometer: sensorData.accelerometer,
        magnetometer: sensorData.magnetometer,
        compass: sensorData.compass,
        isLevelStable: isLevelStable,
        captureIndex: capturedCount + 1,
        roomId: room.id,
        deviceOrientation: 'portrait' // Could be enhanced with actual orientation detection
      };
      
      console.log('Photo captured with metadata:', {
        uri: data.uri,
        metadata
      });
      
      // TODO: Upload image with metadata to backend
      // await uploadImageWithMetadata(data.uri, metadata);
      
      setCapturedCount(prev => prev + 1);
      Vibration.vibrate(100);
      
      Alert.alert(
        'Photo Captured',
        `Image ${capturedCount + 1} captured with sensor data`,
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
            
            {/* Sensor Feedback */}
            <View style={styles.sensorFeedback}>
              <View style={[styles.levelIndicator, isLevelStable && styles.levelStable]}>
                <Icon name="straighten" size={16} color={isLevelStable ? '#4CAF50' : '#FF9800'} />
                <Text style={[styles.sensorText, { color: isLevelStable ? '#4CAF50' : '#FF9800' }]}>
                  {isLevelStable ? 'Level' : 'Not Level'}
                </Text>
              </View>
              
              <View style={styles.compassIndicator}>
                <Icon name="explore" size={16} color="#fff" />
                <Text style={styles.sensorText}>
                  {Math.round(compassHeading)}°
                </Text>
              </View>
              
              <View style={styles.stabilityIndicator}>
                <Icon name="speed" size={16} color="#fff" />
                <Text style={styles.sensorText}>
                  Stability: {Math.abs(sensorData.gyroscope.x + sensorData.gyroscope.y + sensorData.gyroscope.z) < 0.1 ? 'Good' : 'Moving'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.instructionText}>
              Keep device level and stable for best results
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
  sensorFeedback: {
    marginVertical: 20,
    alignItems: 'center',
  },
  levelIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  levelStable: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
  },
  compassIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  stabilityIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sensorText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
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
