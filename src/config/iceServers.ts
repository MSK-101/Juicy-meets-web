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
  username: 'f5d9e26eb60bffec4d4d10f5',
  password: 'CCROG7MUTtQk3yCD',
  apiKey: '21dc0219183a663c3536512f5f87fdf25323'
};

// Static ICE servers configuration (optimized for Pakistan with India & Singapore)
export const STATIC_ICE_SERVERS: ICEServerConfig[] = [
  // Primary STUN server (India - closest to Pakistan)
  {
    urls: 'stun:stun.relay.metered.ca:80'
  },
  // TURN server (UDP) - India relay (primary, ~1000-1500km from Pakistan)
  {
    urls: 'turn:in.relay.metered.ca:80',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  },
  // TURN server (TCP) - India relay (for restrictive networks/firewalls)
  {
    urls: 'turn:in.relay.metered.ca:80?transport=tcp',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  },
  // TURN server (TLS) - India relay (most secure, encrypted)
  {
    urls: 'turns:in.relay.metered.ca:443?transport=tcp',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  }
];

// Singapore servers as backup (good for Pakistan, ~4000km away)
export const SINGAPORE_ICE_SERVERS: ICEServerConfig[] = [
  {
    urls: 'turn:sg.relay.metered.ca:80',
    username: METERED_CREDENTIALS.username,
    credential: METERED_CREDENTIALS.password
  },
  {
    urls: 'turn:sg.relay.metered.ca:80?transport=tcp',
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
 * Gets the optimal ICE server configuration for Pakistan
 * Uses dynamic credentials if available, falls back to India + Singapore mix
 * @returns Promise<ICEServerConfig[]> - Optimized ICE server configuration (max 4 servers)
 */
export async function getOptimalIceServers(): Promise<ICEServerConfig[]> {
  try {
    // Try to fetch dynamic credentials first (Metered auto-routes to best region)
    const dynamicServers = await fetchDynamicIceServers();

    // If we got dynamic servers, use them (they're usually more up-to-date)
    if (dynamicServers && dynamicServers.length > 0) {
      // Limit to 4 servers to avoid slowing down ICE discovery
      return dynamicServers.slice(0, 4);
    }

    // Fallback to static configuration (India primary for Pakistan)
    return STATIC_ICE_SERVERS;
  } catch (error) {
    console.warn('Using fallback ICE servers due to error:', error);
    // OPTIMIZED FOR PAKISTAN: Mix India (primary) with Singapore (backup)
    return [
      STATIC_ICE_SERVERS[0], // STUN (India)
      STATIC_ICE_SERVERS[1], // TURN UDP (India) - fastest for Pakistan
      STATIC_ICE_SERVERS[2], // TURN TCP (India) - for firewalls
      STATIC_ICE_SERVERS[3]  // TURN TLS (India) - most secure
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

  // Ensure we never exceed 4 servers to avoid discovery slowdown
  const limitedServers = iceServers.slice(0, 4);

  return limitedServers.map(server => ({
    urls: server.urls,
    username: server.username,
    credential: server.credential
  }));
}

/**
 * Creates RTCPeerConnection configuration with optimized ICE servers
 * OPTIMIZED FOR PAKISTAN: Uses India relay for lowest latency
 * @param useDynamic - Whether to use dynamic ICE server fetching
 * @returns Promise<RTCConfiguration> - Complete RTC configuration
 */
export async function createRTCConfiguration(useDynamic: boolean = true): Promise<RTCConfiguration> {
  const iceServers = await getRTCIceServers(useDynamic);

  return {
    iceServers,
    iceCandidatePoolSize: 20, // Pre-gather 20 ICE candidates for faster connection (optimal for Pakistan-India routing)
    iceTransportPolicy: 'all', // Try all connection types (UDP, TCP, relay)
    bundlePolicy: 'max-bundle', // Bundle all media into single connection for efficiency
    rtcpMuxPolicy: 'require' // Multiplex RTP/RTCP on same port
  };
}

/**
 * Test function to measure latency to different TURN servers
 * Useful for finding the fastest server for your location
 */
export async function testServerLatency(serverUrl: string): Promise<number> {
  const startTime = performance.now();
  try {
    await fetch(serverUrl.replace('turn:', 'https://').replace('turns:', 'https://').split('?')[0], {
      mode: 'no-cors',
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    // Expected to fail, we're just measuring DNS/network latency
  }
  return performance.now() - startTime;
}

// Export credentials for manual use if needed
export { METERED_CREDENTIALS };
