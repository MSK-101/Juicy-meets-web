/**
 * ICE Server Configuration for WebRTC
 *
 * This file contains the configuration for STUN and TURN servers
 * used for WebRTC peer connections. It includes both static credentials
 * and dynamic credential fetching from Metered TURN service.
 */

export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface MeteredCredentials {
  username: string;
  password: string;
  apiKey: string;
}

// Metered TURN credentials
const METERED_CREDENTIALS: MeteredCredentials = {
  username: '4b80f5cd2e329778469772fc',
  password: '7lymmbrPhjKfZ7gX',
  apiKey: '84cbdd69dd97bfd9b5e39a66a2c08e985766'
};

// Static ICE servers configuration (updated to provided Metered TURN/STUN endpoints)
export const STATIC_ICE_SERVERS: ICEServerConfig[] = [
  // Primary STUN server
  {
    urls: 'stun:stun.relay.metered.ca:80'
  },
  // TURN server (UDP)
  {
    urls: 'turn:asia.relay.metered.ca:80',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  },
  // TURN server (TCP over 80)
  {
    urls: 'turn:asia.relay.metered.ca:80?transport=tcp',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  },
  // TURN server (UDP over 443)
  {
    urls: 'turn:asia.relay.metered.ca:443',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  },
  // TURN server (TLS over 443 TCP)
  {
    urls: 'turns:asia.relay.metered.ca:443?transport=tcp',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  }
];

// Fallback ICE servers (Google STUN servers)
export const FALLBACK_ICE_SERVERS: ICEServerConfig[] = [
  {
    urls: 'stun:stun.l.google.com:19302'
  },
  {
    urls: 'stun:stun1.l.google.com:19302'
  }
];

/**
 * Fetches dynamic ICE server credentials from Metered TURN service
 * @returns Promise<ICEServerConfig[]> - Array of ICE server configurations
 */
export async function fetchDynamicIceServers(): Promise<ICEServerConfig[]> {
  try {
    const response = await fetch(
      `https://juicymeets.metered.live/api/v1/turn/credentials?apiKey=${METERED_CREDENTIALS.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch TURN credentials: ${response.status}`);
    }

    const iceServers = await response.json();
    return iceServers;
  } catch (error) {
    console.warn('Failed to fetch dynamic ICE servers, using static configuration:', error);
    return STATIC_ICE_SERVERS;
  }
}

/**
 * Gets the optimal ICE server configuration
 * Uses dynamic credentials if available, falls back to static configuration
 * @returns Promise<ICEServerConfig[]> - Optimized ICE server configuration (max 4 servers)
 */
export async function getOptimalIceServers(): Promise<ICEServerConfig[]> {
  try {
    // Try to fetch dynamic credentials first
    const dynamicServers = await fetchDynamicIceServers();

    // If we got dynamic servers, use them (they're usually more up-to-date)
    if (dynamicServers && dynamicServers.length > 0) {
      // Limit to 5 servers to match provided configuration
      return dynamicServers.slice(0, 5);
    }

    // Fallback to static configuration (already optimized to 4 servers)
    return STATIC_ICE_SERVERS;
  } catch (error) {
    console.warn('Using fallback ICE servers due to error:', error);
    // Use only the most essential servers to stay under 5 limit
    return [
      STATIC_ICE_SERVERS[0], // Primary STUN
      STATIC_ICE_SERVERS[1], // Primary TURN UDP
      STATIC_ICE_SERVERS[2], // TURN TCP
      FALLBACK_ICE_SERVERS[0] // Google STUN as backup
    ];
  }
}

/**
 * Gets ICE servers for RTCPeerConnection configuration
 * @param useDynamic - Whether to try fetching dynamic credentials first
 * @returns Promise<RTCIceServer[]> - ICE servers ready for RTCPeerConnection (max 4 servers)
 */
export async function getRTCIceServers(useDynamic: boolean = true): Promise<RTCIceServer[]> {
  const iceServers = useDynamic
    ? await getOptimalIceServers()
    : STATIC_ICE_SERVERS;

  // Ensure we include up to 5 servers as provided
  const limitedServers = iceServers.slice(0, 5);

  return limitedServers.map(server => ({
    urls: server.urls,
    username: server.username,
    credential: server.credential
  }));
}

/**
 * Creates RTCPeerConnection configuration with optimized ICE servers
 * @param useDynamic - Whether to use dynamic ICE server fetching
 * @returns Promise<RTCConfiguration> - Complete RTC configuration
 */
export async function createRTCConfiguration(useDynamic: boolean = true): Promise<RTCConfiguration> {
  const iceServers = await getRTCIceServers(useDynamic);

  return {
    iceServers,
    iceCandidatePoolSize: 20, // Higher pool for faster connections
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };
}

// Export credentials for manual use if needed
export { METERED_CREDENTIALS };
