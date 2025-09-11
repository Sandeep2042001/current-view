import axios from 'axios';
import { User } from '../types/User';

const API_BASE_URL = 'http://localhost:3000/api';

export class AuthService {
  static async login(email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });

      return {
        user: response.data.user,
        token: response.data.token
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }

  static async register(
    email: string, 
    password: string, 
    firstName: string, 
    lastName: string
  ): Promise<{ user: User; token: string }> {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        firstName,
        lastName
      });

      return {
        user: response.data.user,
        token: response.data.token
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  }

  static async verifyToken(token: string): Promise<User> {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      return response.data.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Token verification failed');
    }
  }
}
