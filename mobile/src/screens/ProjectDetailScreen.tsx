import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Project, Room } from '../types/User';

interface ProjectDetailScreenProps {
  navigation: any;
  route: {
    params: {
      project: Project;
    };
  };
}

export default function ProjectDetailScreen({ navigation, route }: ProjectDetailScreenProps) {
  const { project } = route.params;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      // TODO: Implement API call to fetch rooms
      // For now, using mock data
      const mockRooms: Room[] = [
        {
          id: '1',
          projectId: project.id,
          name: 'Living Room',
          description: 'Main living area',
          status: 'completed',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          projectId: project.id,
          name: 'Kitchen',
          description: 'Kitchen area',
          status: 'processing',
          position: { x: 5, y: 0, z: 0 },
          rotation: { x: 0, y: 90, z: 0 },
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      setRooms(mockRooms);
    } catch (error) {
      Alert.alert('Error', 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const createNewRoom = () => {
    Alert.prompt(
      'New Room',
      'Enter room name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (name) => {
            if (name && name.trim()) {
              // TODO: Implement room creation
              Alert.alert('Success', 'Room created successfully');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const startCapture = (room: Room) => {
    navigation.navigate('RoomCapture', { room });
  };

  const viewRoom = (room: Room) => {
    // TODO: Navigate to room viewer
    Alert.alert('Room Viewer', `Viewing ${room.name}`);
  };

  const renderRoom = ({ item }: { item: Room }) => (
    <View style={styles.roomCard}>
      <View style={styles.roomHeader}>
        <View>
          <Text style={styles.roomName}>{item.name}</Text>
          <Text style={styles.roomDescription}>{item.description}</Text>
        </View>
        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.roomActions}>
        {item.status === 'completed' ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.viewButton]}
            onPress={() => viewRoom(item)}
          >
            <Icon name="visibility" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>View</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.captureButton]}
            onPress={() => startCapture(item)}
          >
            <Icon name="camera-alt" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Capture</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { backgroundColor: '#4CAF50' };
      case 'processing':
        return { backgroundColor: '#FF9800' };
      case 'failed':
        return { backgroundColor: '#F44336' };
      default:
        return { backgroundColor: '#9E9E9E' };
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.projectName}>{project.name}</Text>
        <Text style={styles.projectDescription}>{project.description}</Text>
        <View style={[styles.statusBadge, getStatusStyle(project.status)]}>
          <Text style={styles.statusText}>{project.status}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          <TouchableOpacity style={styles.addButton} onPress={createNewRoom}>
            <Icon name="add" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Room</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={rooms}
          renderItem={renderRoom}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="room" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No rooms yet</Text>
              <Text style={styles.emptySubtext}>
                Add rooms to start capturing 360° images
              </Text>
            </View>
          }
        />
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
  projectName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  projectDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  roomDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  roomActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  captureButton: {
    backgroundColor: '#4CAF50',
  },
  viewButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
