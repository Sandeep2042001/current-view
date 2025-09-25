import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SettingsScreenProps {
  navigation: any;
  onLogout: () => void;
}

export default function SettingsScreen({ navigation, onLogout }: SettingsScreenProps) {
  const [notifications, setNotifications] = useState(true);
  const [autoUpload, setAutoUpload] = useState(false);
  const [highQuality, setHighQuality] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const clearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear all cached data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement cache clearing
            Alert.alert('Success', 'Cache cleared successfully');
          },
        },
      ]
    );
  };

  const exportData = () => {
    Alert.alert('Export Data', 'Data export feature coming soon');
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.iconContainer}>
          <Icon name={icon} size={24} color="#2196F3" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {rightComponent || <Icon name="chevron-right" size={24} color="#ccc" />}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        
        {renderSettingItem(
          'notifications',
          'Push Notifications',
          'Receive notifications about processing status',
          undefined,
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#ccc', true: '#2196F3' }}
            thumbColor="#fff"
          />
        )}

        {renderSettingItem(
          'cloud-upload',
          'Auto Upload',
          'Automatically upload images when connected to Wi-Fi',
          undefined,
          <Switch
            value={autoUpload}
            onValueChange={setAutoUpload}
            trackColor={{ false: '#ccc', true: '#2196F3' }}
            thumbColor="#fff"
          />
        )}

        {renderSettingItem(
          'high-quality',
          'High Quality Images',
          'Capture images at maximum quality',
          undefined,
          <Switch
            value={highQuality}
            onValueChange={setHighQuality}
            trackColor={{ false: '#ccc', true: '#2196F3' }}
            thumbColor="#fff"
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage</Text>
        
        {renderSettingItem(
          'storage',
          'Clear Cache',
          'Free up storage space',
          clearCache
        )}

        {renderSettingItem(
          'download',
          'Export Data',
          'Export your projects and data',
          exportData
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        {renderSettingItem(
          'person',
          'Profile',
          'Manage your account information',
          () => Alert.alert('Profile', 'Profile management coming soon')
        )}

        {renderSettingItem(
          'security',
          'Privacy & Security',
          'Manage your privacy settings',
          () => Alert.alert('Privacy', 'Privacy settings coming soon')
        )}

        {renderSettingItem(
          'help',
          'Help & Support',
          'Get help and contact support',
          () => Alert.alert('Help', 'Help & support coming soon')
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        
        {renderSettingItem(
          'info',
          'App Version',
          '1.0.0',
          () => Alert.alert('Version', 'Interactive 360° Platform v1.0.0')
        )}

        {renderSettingItem(
          'description',
          'Terms of Service',
          'Read our terms and conditions',
          () => Alert.alert('Terms', 'Terms of service coming soon')
        )}

        {renderSettingItem(
          'privacy-tip',
          'Privacy Policy',
          'Read our privacy policy',
          () => Alert.alert('Privacy Policy', 'Privacy policy coming soon')
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={24} color="#F44336" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 15,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 20,
    marginBottom: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  logoutText: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
