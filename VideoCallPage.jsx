import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { WEBHOOK_CONFIG } from '../config/webhooks';

const VideoCallPage = ({ identityPrefix }) => {
  const { roomName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const videoRef = useRef();
  const localVideoRef = useRef();

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');

  // Determine user type and styling
  const isPatient = identityPrefix === 'patient';
  const userType = isPatient ? 'Patient' : 'Practice';
  const themeColor = isPatient ? 'blue' : 'green';

  useEffect(() => {
    const joinRoom = async () => {
      try {
        setIsConnecting(true);
        setConnectionStatus('Connecting to video call...');

        // Parse identity from URL query param or fallback to random
        const queryParams = new URLSearchParams(location.search);
        const queryIdentity = queryParams.get('identity');
        const identity = queryIdentity || `${identityPrefix}_${Math.floor(Math.random() * 10000)}`;

        console.log(`🎥 ${userType} joining room:`, roomName, 'with identity:', identity);

        // Get token from backend
        const response = await fetch(WEBHOOK_CONFIG.VIDEO_TOKEN_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity,
            roomName,
            userType: identityPrefix,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to get video token: ${response.status}`);
        }

        const { token } = await response.json();
        console.log('🔑 Video token received');

        // Import Twilio Video dynamically
        const Video = await import('twilio-video');

        setConnectionStatus('Joining room...');

        // Connect to room
        const connectedRoom = await Video.connect(token, {
          name: roomName,
          audio: isAudioEnabled,
          video: isVideoEnabled,
        });

        console.log('✅ Connected to room:', connectedRoom.name);
        setRoom(connectedRoom);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('Connected');

        // Handle local participant (self)
        const localParticipant = connectedRoom.localParticipant;
        console.log('👤 Local participant:', localParticipant.identity);

        // Attach local video track
        localParticipant.videoTracks.forEach(publication => {
          if (publication.track && localVideoRef.current) {
            const videoElement = publication.track.attach();
            videoElement.style.width = '100%';
            videoElement.style.height = '100%';
            videoElement.style.objectFit = 'cover';
            localVideoRef.current.appendChild(videoElement);
          }
        });

        // Handle existing participants
        connectedRoom.participants.forEach(participant => {
          console.log('👥 Existing participant:', participant.identity);
          handleParticipantConnected(participant);
        });

        // Handle new participants joining
        connectedRoom.on('participantConnected', participant => {
          console.log('👋 Participant joined:', participant.identity);
          handleParticipantConnected(participant);
        });

        // Handle participants leaving
        connectedRoom.on('participantDisconnected', participant => {
          console.log('👋 Participant left:', participant.identity);
          handleParticipantDisconnected(participant);
        });

        // Handle room disconnection
        connectedRoom.on('disconnected', room => {
          console.log('📞 Disconnected from room');
          setIsConnected(false);
          setConnectionStatus('Disconnected');
          // Clean up local tracks
          room.localParticipant.tracks.forEach(publication => {
            if (publication.track) {
              publication.track.stop();
            }
          });
        });
      } catch (error) {
        console.error('❌ Video call error:', error);
        setError(error.message);
        setIsConnecting(false);
        setConnectionStatus('Connection failed');
      }
    };

    if (roomName) {
      joinRoom();
    }

    // Cleanup on unmount
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [roomName, identityPrefix, location.search]);

  const handleParticipantConnected = participant => {
    setParticipants(prev => [...prev, participant]);

    participant.tracks.forEach(publication => {
      if (publication.isSubscribed && publication.track) {
        attachTrack(publication.track);
      }
    });

    participant.on('trackSubscribed', track => {
      attachTrack(track);
    });

    participant.on('trackUnsubscribed', track => {
      detachTrack(track);
    });
  };

  const handleParticipantDisconnected = participant => {
    setParticipants(prev => prev.filter(p => p.sid !== participant.sid));

    participant.tracks.forEach(publication => {
      if (publication.track) {
        detachTrack(publication.track);
      }
    });
  };

  const attachTrack = track => {
    if (videoRef.current) {
      const mediaElement = track.attach();
      mediaElement.style.width = '100%';
      mediaElement.style.height = '100%';
      mediaElement.style.objectFit = 'cover';
      videoRef.current.appendChild(mediaElement);
    }
  };

  const detachTrack = track => {
    track.detach().forEach(element => {
      element.remove();
    });
  };

  const toggleVideo = () => {
    if (room && room.localParticipant) {
      room.localParticipant.videoTracks.forEach(publication => {
        if (publication.track) {
          if (isVideoEnabled) {
            publication.track.disable();
          } else {
            publication.track.enable();
          }
        }
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (room && room.localParticipant) {
      room.localParticipant.audioTracks.forEach(publication => {
        if (publication.track) {
          if (isAudioEnabled) {
            publication.track.disable();
          } else {
            publication.track.enable();
          }
        }
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const endCall = () => {
    if (room) {
      room.disconnect();
    }
    navigate('/');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 text-white p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">{userType} Video Call</h1>
            <p className="text-sm opacity-75">Room: {roomName}</p>
            <p className="text-sm opacity-75">Status: {connectionStatus}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-xs ${
                isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            >
              {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-screen">
        {/* Remote participants video */}
        <div ref={videoRef} className="w-full h-full bg-gray-800 flex items-center justify-center">
          {!isConnected && !isConnecting && (
            <div className="text-white text-center">
              <div className="text-6xl mb-4">📹</div>
              <p className="text-xl">Waiting to connect...</p>
            </div>
          )}
          {isConnecting && (
            <div className="text-white text-center">
              <div className="animate-spin text-6xl mb-4">⏳</div>
              <p className="text-xl">Connecting to video call...</p>
            </div>
          )}
        </div>

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-20 right-4 w-48 h-36 bg-gray-700 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <div ref={localVideoRef} className="w-full h-full bg-gray-600 flex items-center justify-center">
            {!isVideoEnabled && (
              <div className="text-white text-center">
                <VideoOff size={24} />
                <p className="text-xs mt-1">Video Off</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-6">
        <div className="flex justify-center space-x-4">
          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-colors ${
              isAudioEnabled ? `bg-${themeColor}-500 hover:bg-${themeColor}-600` : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isAudioEnabled ? <Mic className="text-white" size={24} /> : <MicOff className="text-white" size={24} />}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoEnabled ? `bg-${themeColor}-500 hover:bg-${themeColor}-600` : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {isVideoEnabled ? <Video className="text-white" size={24} /> : <VideoOff className="text-white" size={24} />}
          </button>

          {/* End Call */}
          <button onClick={endCall} className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors">
            <PhoneOff className="text-white" size={24} />
          </button>
        </div>
      </div>

      {/* Participants Count */}
      {participants.length > 0 && (
        <div className="absolute top-20 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg">
          <p className="text-sm">
            👥 {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoCallPage;
