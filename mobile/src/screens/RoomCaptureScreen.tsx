import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Room } from '../types/User';

interface RoomCaptureScreenProps {
  navigation: any;
  route: {
    params: {
      room: Room;
    };
  };
}

const { width } = Dimensions.get('window');

export default function RoomCaptureScreen({ navigation, route }: RoomCaptureScreenProps) {
  const { room } = route.params;
  const [capturedImages, setCapturedImages] = useState<any[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    loadCapturedImages();
  }, []);

  const loadCapturedImages = async () => {
    try {
      // TODO: Implement API call to fetch captured images
      // For now, using mock data
      const mockImages = [
        { id: '1', filename: 'image1.jpg', timestamp: new Date().toISOString() },
        { id: '2', filename: 'image2.jpg', timestamp: new Date().toISOString() },
      ];
      setCapturedImages(mockImages);
    } catch (error) {
      Alert.alert('Error', 'Failed to load captured images');
    }
  };

  const startCapture = () => {
    navigation.navigate('Camera', { room });
  };

  const uploadImages = async () => {
    if (capturedImages.length === 0) {
      Alert.alert('No Images', 'Please capture some images first');
      return;
    }

    try {
      // TODO: Implement image upload
      Alert.alert('Upload Started', 'Images are being uploaded...');
    } catch (error) {
      Alert.alert('Upload Failed', 'Failed to upload images');
    }
  };

  const processImages = async () => {
    if (capturedImages.length < 2) {
      Alert.alert('Insufficient Images', 'At least 2 images are required for processing');
      return;
    }

    try {
      // TODO: Implement image processing
      Alert.alert('Processing Started', 'Images are being processed...');
    } catch (error) {
      Alert.alert('Processing Failed', 'Failed to process images');
    }
  };

  const deleteImage = (imageId: string) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setCapturedImages(prev => prev.filter(img => img.id !== imageId));
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roomName}>{room.name}</Text>
        <Text style={styles.roomDescription}>{room.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capture 360° Images</Text>
        <Text style={styles.sectionDescription}>
          Capture multiple 360° images from different positions in the room.
          Make sure there's sufficient overlap between images for better stitching.
        </Text>

        <TouchableOpacity style={styles.captureButton} onPress={startCapture}>
          <Icon name="camera-alt" size={32} color="#fff" />
          <Text style={styles.captureButtonText}>Start Capture</Text>
        </TouchableOpacity>
      </View>

      {capturedImages.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Captured Images ({capturedImages.length})</Text>
          
          <View style={styles.imageGrid}>
            {capturedImages.map((image, index) => (
              <View key={image.id} style={styles.imageCard}>
                <View style={styles.imagePlaceholder}>
                  <Icon name="image" size={32} color="#ccc" />
                </View>
                <Text style={styles.imageName}>Image {index + 1}</Text>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteImage(image.id)}
                >
                  <Icon name="delete" size={16} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.uploadButton} onPress={uploadImages}>
              <Icon name="cloud-upload" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Upload Images</Text>
            </TouchableOpacity>

            {capturedImages.length >= 2 && (
              <TouchableOpacity style={styles.processButton} onPress={processImages}>
                <Icon name="build" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Process Images</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capture Tips</Text>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.tipText}>Ensure good lighting conditions</Text>
          </View>
          <View style={styles.tipItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.tipText}>Capture from different heights and angles</Text>
          </View>
          <View style={styles.tipItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.tipText}>Maintain 30-50% overlap between images</Text>
          </View>
          <View style={styles.tipItem}>
            <Icon name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.tipText}>Keep the camera steady during capture</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  roomName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  roomDescription: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  captureButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  imageCard: {
    width: (width - 70) / 2,
    marginBottom: 15,
    position: 'relative',
  },
  imagePlaceholder: {
    height: 120,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  imageName: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  deleteButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  processButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  tipsList: {
    marginTop: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});
