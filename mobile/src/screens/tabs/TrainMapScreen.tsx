import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Platform, PermissionsAndroid, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { Crosshair } from 'lucide-react-native';
import { api } from '../../api/client';

interface StationFeature {
  geometry: { coordinates: [number, number] };
  properties: { code: string; name: string; city: string; is_major: boolean };
}

export default function TrainMapScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [stations, setStations] = useState<StationFeature[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'getting' | 'ok' | 'error'>('idle');

  useEffect(() => { loadStations(); }, []);

  const loadStations = async () => {
    try {
      const res = await api.get('/stations/geojson', { params: { major_only: true } });
      setStations(res.data.features || []);
    } catch (e) {
      console.log('Station load error', e);
    } finally {
      setLoading(false);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        { title: 'Location Permission', message: 'RailGram needs location for train tracking', buttonPositive: 'Allow', buttonNegative: 'Deny' }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const getMyLocation = async () => {
    setGpsStatus('getting');
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Location permission is required');
      setGpsStatus('error');
      return;
    }
    Geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        setGpsStatus('ok');
        mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 1000);
      },
      () => {
        setGpsStatus('error');
        Alert.alert('GPS Error', 'Could not get location. Please enable GPS.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6B35" size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: 22.5, longitude: 80, latitudeDelta: 15, longitudeDelta: 15 }}
        mapType="standard"
      >
        {stations.map((s) => (
          <Marker
            key={s.properties.code}
            coordinate={{ latitude: s.geometry.coordinates[1], longitude: s.geometry.coordinates[0] }}
            title={s.properties.name}
            description={s.properties.city}
            pinColor={s.properties.is_major ? '#FF6B35' : '#888'}
          />
        ))}
        {userLocation && (
          <>
            <Marker coordinate={{ latitude: userLocation.lat, longitude: userLocation.lon }} title="You are here" pinColor="#4CAF50" />
            <Circle center={{ latitude: userLocation.lat, longitude: userLocation.lon }} radius={5000} fillColor="rgba(76,175,80,0.1)" strokeColor="rgba(76,175,80,0.4)" />
          </>
        )}
      </MapView>

      {/* Top overlay with safe area */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.overlayTitle}>Train Map</Text>
        <Text style={styles.overlaySub}>{stations.length} stations loaded</Text>
      </View>

      {/* GPS button */}
      <TouchableOpacity style={[styles.gpsBtn, { bottom: insets.bottom + 24 }]} onPress={getMyLocation}>
        <Crosshair size={20} color="#fff" strokeWidth={2} />
        <Text style={styles.gpsBtnText}>
          {gpsStatus === 'getting' ? 'Locating...' : gpsStatus === 'ok' ? 'Located' : 'My Location'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  map: { flex: 1 },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,10,10,0.8)',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  overlayTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  overlaySub: { color: '#888', fontSize: 12, marginTop: 2 },
  gpsBtn: {
    position: 'absolute', right: 16,
    backgroundColor: '#FF6B35', borderRadius: 24,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6,
    elevation: 5,
  },
  gpsBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
