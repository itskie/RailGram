import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'auth_token';

let _token: string | null = null;

export const storage = {
  setToken: async (t: string) => {
    _token = t;
    await AsyncStorage.setItem(TOKEN_KEY, t);
  },
  getToken: () => _token,
  clearToken: async () => {
    _token = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
  loadToken: async (): Promise<string | null> => {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    _token = t;
    return t;
  },
};

export const BASE_URL = 'https://railgram.in/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      _token = null;
      AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
    }
    return Promise.reject(error);
  }
);
