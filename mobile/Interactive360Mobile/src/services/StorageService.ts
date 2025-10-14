import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

export class StorageService {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'user_data';

  static async setToken(token: string): Promise<void> {
    try {
      await Keychain.setInternetCredentials('interactive360', 'token', token);
    } catch (error) {
      console.error('Failed to store token:', error);
      // Fallback to AsyncStorage
      await AsyncStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  static async getToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials('interactive360');
      if (credentials && credentials.password) {
        return credentials.password;
      }
    } catch (error) {
      console.error('Failed to get token from keychain:', error);
    }

    // Fallback to AsyncStorage
    try {
      return await AsyncStorage.getItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to get token from storage:', error);
      return null;
    }
  }

  static async removeToken(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials('interactive360');
    } catch (error) {
      console.error('Failed to remove token from keychain:', error);
    }

    try {
      await AsyncStorage.removeItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to remove token from storage:', error);
    }
  }

  static async setUser(user: any): Promise<void> {
    try {
      await AsyncStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Failed to store user data:', error);
    }
  }

  static async getUser(): Promise<any | null> {
    try {
      const userData = await AsyncStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await this.removeToken();
      await AsyncStorage.removeItem(this.USER_KEY);
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
}
