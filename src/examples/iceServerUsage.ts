/**
 * ICE Server Configuration Usage Examples
 *
 * This file demonstrates how to use the ICE server configuration
 * in different scenarios for WebRTC connections.
 */

import {
  createRTCConfiguration,
  getRTCIceServers,
  fetchDynamicIceServers,
  STATIC_ICE_SERVERS
} from '../config/iceServers';

// Example 1: Basic usage with UltraFastVideoChatService
export async function basicUsageExample() {
  // The UltraFastVideoChatService automatically uses the optimized ICE servers
  // No additional configuration needed - it's handled internally
  console.log('UltraFastVideoChatService automatically uses optimized ICE servers');
}

// Example 2: Manual RTCPeerConnection creation with optimized ICE servers
export async function manualPeerConnectionExample() {
  try {
    // Get optimized ICE server configuration
    const config = await createRTCConfiguration(true);

    // Create peer connection with optimized settings
    const peerConnection = new RTCPeerConnection(config);

    console.log('Created peer connection with optimized ICE servers:', config.iceServers);

    return peerConnection;
  } catch (error) {
    console.error('Failed to create peer connection:', error);
    throw error;
  }
}

// Example 3: Using only static ICE servers (faster initialization)
export async function staticIceServersExample() {
  try {
    // Use static configuration for faster initialization
    const config = await createRTCConfiguration(false);

    const peerConnection = new RTCPeerConnection(config);

    console.log('Created peer connection with static ICE servers');

    return peerConnection;
  } catch (error) {
    console.error('Failed to create peer connection with static servers:', error);
    throw error;
  }
}

// Example 4: Fetching dynamic credentials manually
export async function dynamicCredentialsExample() {
  try {
    // Fetch fresh credentials from Metered TURN service
    const dynamicServers = await fetchDynamicIceServers();

    console.log('Fetched dynamic ICE servers:', dynamicServers);

    // Use the dynamic servers
    const peerConnection = new RTCPeerConnection({
      iceServers: dynamicServers,
      iceCandidatePoolSize: 20,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    });

    return peerConnection;
  } catch (error) {
    console.error('Failed to fetch dynamic credentials:', error);
    throw error;
  }
}

// Example 5: Fallback configuration
export async function fallbackConfigurationExample() {
  try {
    // Try dynamic first, fallback to static
    const config = await createRTCConfiguration(true);

    const peerConnection = new RTCPeerConnection(config);

    console.log('Using fallback configuration with', config.iceServers?.length, 'ICE servers');

    return peerConnection;
  } catch (error) {
    console.error('All ICE server configurations failed:', error);
    throw error;
  }
}

// Example 6: Custom ICE server configuration
export function customIceServersExample() {
  // Use only the most reliable servers for specific use cases
  const customConfig: RTCConfiguration = {
    iceServers: [
      // Primary STUN server
      { urls: 'stun:stun.relay.metered.ca:80' },
      // Primary TURN server
      {
        urls: 'turn:global.relay.metered.ca:80',
        username: '4b80f5cd2e329778469772fc',
        credential: '7lymmbrPhjKfZ7gX'
      }
    ],
    iceCandidatePoolSize: 10, // Smaller pool for faster initialization
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  const peerConnection = new RTCPeerConnection(customConfig);

  console.log('Created peer connection with custom ICE configuration');

  return peerConnection;
}

// Example 7: Testing ICE server connectivity
export async function testIceServerConnectivity() {
  const config = await createRTCConfiguration(true);
  const peerConnection = new RTCPeerConnection(config);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      peerConnection.close();
      reject(new Error('ICE gathering timeout'));
    }, 10000); // 10 second timeout

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate found:', event.candidate.candidate);
      } else {
        console.log('ICE gathering complete');
        clearTimeout(timeout);
        peerConnection.close();
        resolve('ICE gathering successful');
      }
    };

    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', peerConnection.iceGatheringState);
    };

    // Start ICE gathering
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .catch(reject);
  });
}
