/**
 * NearbyUsersPanel Component
 *
 * Displays a list of nearby users discovered via BLE beacons.
 * Used in the P2P Send Money flow for proximity-based recipient selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import ProfileAvatar from './ProfileAvatar';
import {
  initializeBle,
  startScanning,
  stopScanning,
  lookupBeaconTokens,
  beaconResultsToNearbyUsers,
  getBeaconRssiMap,
  getProximityDescription,
  type NearbyUser,
  type DiscoveredBeacon,
} from '../services/bleDiscovery';

interface NearbyUsersPanelProps {
  /** Called when user selects a nearby recipient */
  onSelectUser: (user: NearbyUser) => void;
  /** Whether the panel is currently visible/active */
  isActive: boolean;
  /** Optional minimum RSSI for filtering (default -80) */
  minRssi?: number;
}

type PanelState = 'initializing' | 'scanning' | 'empty' | 'error';

const MERCHANT_CATEGORY_EMOJI: Record<string, string> = {
  FOOD_AND_BEVERAGE: '\u2615', // Coffee
  RETAIL: '\uD83D\uDECD', // Shopping bags
  SERVICES: '\uD83D\uDEE0', // Wrench
  ENTERTAINMENT: '\uD83C\uDFAC', // Movie
  HEALTH_AND_WELLNESS: '\uD83D\uDC8A', // Pill
  TRANSPORTATION: '\uD83D\uDE97', // Car
  OTHER: '\uD83D\uDCBC', // Briefcase
};

export const NearbyUsersPanel: React.FC<NearbyUsersPanelProps> = ({
  onSelectUser,
  isActive,
  minRssi = -80,
}) => {
  const [state, setState] = useState<PanelState>('initializing');
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle beacon discovery and lookup
  const handleBeaconsFound = useCallback(async (beacons: DiscoveredBeacon[]) => {
    if (beacons.length === 0) {
      setNearbyUsers([]);
      setState('empty');
      return;
    }

    // Get tokens for lookup
    const tokens = beacons.map((b) => b.token);

    // Lookup user info from TransferSim
    const response = await lookupBeaconTokens(tokens);
    if (!response) {
      console.warn('[NearbyUsersPanel] Lookup failed');
      return;
    }

    // Convert to NearbyUser objects with RSSI data
    const rssiMap = getBeaconRssiMap();
    const users = beaconResultsToNearbyUsers(response.results, rssiMap);

    setNearbyUsers(users);
    setState(users.length > 0 ? 'scanning' : 'empty');
  }, []);

  // Start/stop scanning based on active state
  useEffect(() => {
    if (!isActive) {
      stopScanning();
      return;
    }

    let mounted = true;

    const startDiscovery = async () => {
      setState('initializing');
      setErrorMessage('');

      // Initialize BLE
      const initialized = await initializeBle();
      if (!initialized) {
        if (mounted) {
          setState('error');
          setErrorMessage('Bluetooth is not available. Please enable Bluetooth and try again.');
        }
        return;
      }

      // Start BLE scanning for iBeacons
      const started = await startScanning(handleBeaconsFound, { minRssi });
      if (!started && mounted) {
        setState('error');
        setErrorMessage('Failed to start scanning for nearby users.');
      } else if (mounted) {
        setState('scanning');
      }
    };

    startDiscovery();

    return () => {
      mounted = false;
      stopScanning();
    };
  }, [isActive, minRssi, handleBeaconsFound]);

  // Manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Restart BLE scanning
    stopScanning();
    const started = await startScanning(handleBeaconsFound, { minRssi });
    if (!started) {
      setState('error');
      setErrorMessage('Failed to refresh. Please try again.');
    }
    setIsRefreshing(false);
  }, [handleBeaconsFound, minRssi]);

  // Render individual user row
  const renderUserRow = useCallback(({ item }: { item: NearbyUser }) => {
    const categoryEmoji = item.merchantCategory
      ? MERCHANT_CATEGORY_EMOJI[item.merchantCategory] || MERCHANT_CATEGORY_EMOJI.OTHER
      : null;

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => onSelectUser(item)}
        activeOpacity={0.7}
      >
        <ProfileAvatar
          imageUrl={item.isMerchant ? item.merchantLogoUrl || item.profileImageUrl : item.profileImageUrl}
          displayName={item.isMerchant && item.merchantName ? item.merchantName : item.displayName}
          size="medium"
          initialsColor={item.initialsColor}
          variant={item.isMerchant ? 'merchant' : 'user'}
        />

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            {item.isMerchant && categoryEmoji && (
              <Text style={styles.categoryEmoji}>{categoryEmoji}</Text>
            )}
            <Text style={styles.userName} numberOfLines={1}>
              {item.isMerchant && item.merchantName ? item.merchantName : item.displayName}
            </Text>
          </View>

          <Text style={styles.userSubtitle} numberOfLines={1}>
            {item.bankName || (item.recipientAlias ? `@${item.recipientAlias}` : 'Unknown')}
          </Text>

          {item.metadata?.amount && (
            <Text style={styles.requestedAmount}>
              Requesting ${item.metadata.amount.toFixed(2)}
            </Text>
          )}
        </View>

        <View style={styles.proximityInfo}>
          <Text style={styles.proximityDistance}>
            {item.distance < 1 ? `${Math.round(item.distance * 100)}cm` : `${item.distance.toFixed(1)}m`}
          </Text>
          <Text style={styles.proximityLabel}>{getProximityDescription(item.distance)}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [onSelectUser]);

  // Render content based on state
  const renderContent = () => {
    switch (state) {
      case 'initializing':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.statusText}>Initializing Bluetooth...</Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.errorIcon}>!</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        );

      case 'empty':
        return (
          <View style={styles.centerContent}>
            <Text style={styles.emptyIcon}>?</Text>
            <Text style={styles.emptyTitle}>No one nearby</Text>
            <Text style={styles.emptySubtitle}>
              Ask your recipient to open "Receive Money" and enable nearby discovery.
            </Text>
          </View>
        );

      case 'scanning':
        return (
          <FlatList
            data={nearbyUsers}
            renderItem={renderUserRow}
            keyExtractor={(item) => item.token}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.centerContent}>
                <ActivityIndicator size="small" color="#1976D2" />
                <Text style={styles.statusText}>Scanning for nearby users...</Text>
              </View>
            }
          />
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nearby</Text>
        {state === 'scanning' && (
          <View style={styles.scanningIndicator}>
            <View style={styles.scanningDot} />
            <Text style={styles.scanningText}>Scanning</Text>
          </View>
        )}
      </View>

      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  scanningText: {
    fontSize: 13,
    color: '#6b7280',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  statusText: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 48,
    color: '#ef4444',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1976D2',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyIcon: {
    fontSize: 48,
    color: '#9ca3af',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingVertical: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  userSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  requestedAmount: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
    marginTop: 4,
  },
  proximityInfo: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  proximityDistance: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  proximityLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
});

export default NearbyUsersPanel;
