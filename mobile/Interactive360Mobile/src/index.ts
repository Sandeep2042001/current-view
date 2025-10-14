// Mobile app barrel exports for cleaner imports
// Usage: import { LoginScreen, CameraScreen, AuthService } from './src';

// Screen Components
export { default as LoginScreen } from './screens/LoginScreen';
export { default as RegisterScreen } from './screens/RegisterScreen';
export { default as ProjectsScreen } from './screens/ProjectsScreen';
export { default as ProjectDetailScreen } from './screens/ProjectDetailScreen';
export { default as RoomCaptureScreen } from './screens/RoomCaptureScreen';
export { default as CameraScreen } from './screens/CameraScreen';
export { default as SettingsScreen } from './screens/SettingsScreen';

// Services
export { default as AuthService } from './services/AuthService';
export { default as StorageService } from './services/StorageService';

// Types
export type { User } from './types/User';

// Screen Groups for Navigation
export const AuthScreens = {
  LoginScreen: () => require('./screens/LoginScreen').default,
  RegisterScreen: () => require('./screens/RegisterScreen').default,
} as const;

export const ProjectScreens = {
  ProjectsScreen: () => require('./screens/ProjectsScreen').default,
  ProjectDetailScreen: () => require('./screens/ProjectDetailScreen').default,
} as const;

export const CaptureScreens = {
  RoomCaptureScreen: () => require('./screens/RoomCaptureScreen').default,
  CameraScreen: () => require('./screens/CameraScreen').default,
} as const;

export const UtilityScreens = {
  SettingsScreen: () => require('./screens/SettingsScreen').default,
} as const;

// Service Groups
export const CoreServices = {
  AuthService: () => require('./services/AuthService').default,
  StorageService: () => require('./services/StorageService').default,
} as const;

// All screens array for navigation setup
export const ALL_SCREENS = [
  'LoginScreen',
  'RegisterScreen', 
  'ProjectsScreen',
  'ProjectDetailScreen',
  'RoomCaptureScreen',
  'CameraScreen',
  'SettingsScreen'
] as const;

// Screen metadata for navigation and routing
export const SCREEN_METADATA = {
  LoginScreen: {
    category: 'Auth',
    title: 'Login',
    description: 'User authentication login',
    requiresAuth: false,
    gestureEnabled: true
  },
  RegisterScreen: {
    category: 'Auth', 
    title: 'Register',
    description: 'User registration',
    requiresAuth: false,
    gestureEnabled: true
  },
  ProjectsScreen: {
    category: 'Main',
    title: 'Projects',
    description: 'Project listing and management',
    requiresAuth: true,
    gestureEnabled: true
  },
  ProjectDetailScreen: {
    category: 'Main',
    title: 'Project Details',
    description: 'Detailed project view and room management',
    requiresAuth: true,
    gestureEnabled: true
  },
  RoomCaptureScreen: {
    category: 'Capture',
    title: 'Room Capture',
    description: '360° image capture management',
    requiresAuth: true,
    gestureEnabled: false
  },
  CameraScreen: {
    category: 'Capture',
    title: 'Camera',
    description: '360° camera interface with sensor feedback',
    requiresAuth: true,
    gestureEnabled: false
  },
  SettingsScreen: {
    category: 'Utility',
    title: 'Settings',
    description: 'Application settings and preferences',
    requiresAuth: true,
    gestureEnabled: true
  }
} as const;

// Navigation configurations
export const NAVIGATION_CONFIG = {
  authStack: ['LoginScreen', 'RegisterScreen'],
  mainStack: ['ProjectsScreen', 'ProjectDetailScreen', 'SettingsScreen'],
  captureStack: ['RoomCaptureScreen', 'CameraScreen'],
  modal: []
} as const;

// Screen transitions and animations
export const SCREEN_TRANSITIONS = {
  default: {
    gestureDirection: 'horizontal',
    transitionSpec: {
      open: { animation: 'timing', config: { duration: 300 } },
      close: { animation: 'timing', config: { duration: 300 } }
    }
  },
  camera: {
    gestureDirection: 'vertical',
    transitionSpec: {
      open: { animation: 'timing', config: { duration: 200 } },
      close: { animation: 'timing', config: { duration: 200 } }
    }
  }
} as const;

// Export types for TypeScript support
export type ScreenName = typeof ALL_SCREENS[number];
export type ScreenCategory = 'Auth' | 'Main' | 'Capture' | 'Utility';
export type NavigationStack = keyof typeof NAVIGATION_CONFIG;

// Utility functions for screen management
export const getScreensByCategory = (category: ScreenCategory) => {
  return Object.entries(SCREEN_METADATA)
    .filter(([_, meta]) => meta.category === category)
    .map(([name, _]) => name as ScreenName);
};

export const getAuthRequiredScreens = () => {
  return Object.entries(SCREEN_METADATA)
    .filter(([_, meta]) => meta.requiresAuth)
    .map(([name, _]) => name as ScreenName);
};

export const getPublicScreens = () => {
  return Object.entries(SCREEN_METADATA)
    .filter(([_, meta]) => !meta.requiresAuth)
    .map(([name, _]) => name as ScreenName);
};

// App configuration constants
export const APP_CONFIG = {
  name: 'Interactive 360° Platform',
  version: '1.0.0',
  buildNumber: 1,
  apiUrl: 'http://localhost:3000/api',
  supportedOrientations: ['portrait', 'landscape'],
  cameraPermissions: ['camera', 'microphone', 'location'],
  storageKeys: {
    authToken: '@interactive360:authToken',
    userProfile: '@interactive360:userProfile',
    settings: '@interactive360:settings',
    offlineData: '@interactive360:offlineData'
  }
} as const;

// Default export for main app component setup
export { default as App } from '../App';

// Re-export platform-specific utilities
export * from './utils/platform';
export * from './utils/permissions';
export * from './utils/sensors';
