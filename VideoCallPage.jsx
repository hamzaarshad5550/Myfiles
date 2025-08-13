// src/pages/VideoCallPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WEBHOOK_CONFIG } from '../config/webhooks';

const VideoCallPage = ({ identityPrefix }) => {
  const { roomName: urlRoomName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const blurredBgRef = useRef(null);
  const VideoLibRef = useRef(null);

  const [resolvedRoomName, setResolvedRoomName] = useState(urlRoomName);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [error, setError] = useState(null);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const isPatient = identityPrefix === 'patient';
  const themeColor = isPatient ? 'blue' : 'green';

  const attachTrack = (track, container) => {
    if (!track || !container) return;
    if (container.querySelector(`[data-track-id="${track.sid}"]`)) return;
    const el = track.attach();
    el.dataset.trackId = track.sid;
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.objectFit = 'cover';
    container.appendChild(el);
  };

  const detachTrack = (track) => {
    if (!track) return;
    track.detach().forEach((el) => el.remove());
  };

  const handleParticipantConnected = (participant) => {
    if (participant.identity === room?.localParticipant.identity) return; // skip local
    setParticipants((prev) => [...prev, participant]);

    participant.tracks.forEach((pub) => {
      if (pub.track) {
        const container = document.getElementById(`participant-${participant.sid}`);
        if (container) attachTrack(pub.track, container);
      }
    });

    participant.on('trackSubscribed', (track) => {
      const container = document.getElementById(`participant-${participant.sid}`);
      if (container) attachTrack(track, container);
    });

    participant.on('trackUnsubscribed', detachTrack);
  };

  const handleParticipantDisconnected = (participant) => {
    setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
    participant.tracks.forEach((pub) => pub.track && detachTrack(pub.track));
  };

  const createInitialLocalTracks = async () => {
    const VideoLib = VideoLibRef.current;
    const tracks = [];
    let devices = [];

    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (e) {
      console.warn('enumerateDevices failed:', e.message);
    }

    const videoDevice = devices.find((d) => d.kind === 'videoinput');
    const audioDevice = devices.find((d) => d.kind === 'audioinput');

    if (isVideoEnabled && videoDevice) {
      try {
        const videoTrack = await VideoLib.createLocalVideoTrack({ deviceId: videoDevice.deviceId });
        tracks.push(videoTrack);
      } catch {
        setIsVideoEnabled(false);
      }
    }
    if (isAudioEnabled && audioDevice) {
      try {
        const audioTrack = await VideoLib.createLocalAudioTrack({ deviceId: audioDevice.deviceId });
        tracks.push(audioTrack);
      } catch {
        setIsAudioEnabled(false);
      }
    }

    return tracks;
  };

  useEffect(() => {
    const joinRoom = async () => {
      try {
        setIsConnecting(true);
        setConnectionStatus('Connecting...');

        const queryParams = new URLSearchParams(location.search);
        const identity = queryParams.get('identity') || `${identityPrefix}_${Math.floor(Math.random() * 10000)}`;

        const resp = await fetch(WEBHOOK_CONFIG.VIDEO_TOKEN_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, roomName: urlRoomName, userType: identityPrefix }),
        });

        if (!resp.ok) throw new Error(`Failed to get token: ${resp.status}`);
        const { token, roomName: serverRoomName } = await resp.json();

        const VideoLib = await import('twilio-video');
        VideoLibRef.current = VideoLib;

        setConnectionStatus('Preparing devices...');
        const tracks = await createInitialLocalTracks();

        const connectedRoom = await VideoLib.connect(token, { name: serverRoomName || urlRoomName, tracks });

        setRoom(connectedRoom);
        setResolvedRoomName(serverRoomName || urlRoomName);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('Connected');

        // Attach local video once
        connectedRoom.localParticipant.videoTracks.forEach((pub) => {
          if (pub.track && localVideoRef.current) {
            attachTrack(pub.track, localVideoRef.current);
            if (blurredBgRef.current) attachTrack(pub.track, blurredBgRef.current); // blurred bg
          }
        });

        connectedRoom.participants.forEach(handleParticipantConnected);
        connectedRoom.on('participantConnected', handleParticipantConnected);
        connectedRoom.on('participantDisconnected', handleParticipantDisconnected);

        connectedRoom.on('disconnected', (disconnectedRoom) => {
          setIsConnected(false);
          setConnectionStatus('Disconnected');
          disconnectedRoom.localParticipant.tracks.forEach((pub) => {
            if (pub.track) {
              detachTrack(pub.track);
              pub.track.stop();
            }
          });
        });
      } catch (err) {
        setError(err.message || 'Connection failed.');
        setIsConnecting(false);
        setConnectionStatus('Failed');
      }
    };

    if (urlRoomName) joinRoom();
    return () => {
      if (room) room.disconnect();
    };
  }, [urlRoomName, identityPrefix, location.search]);

  const toggleVideo = async () => {
    if (!room || !VideoLibRef.current) return;
    const VideoLib = VideoLibRef.current;
    if (isVideoEnabled) {
      room.localParticipant.videoTracks.forEach((pub) => {
        detachTrack(pub.track);
        pub.track.stop();
        room.localParticipant.unpublishTrack(pub.track);
      });
      setIsVideoEnabled(false);
    } else {
      try {
        const track = await VideoLib.createLocalVideoTrack();
        room.localParticipant.publishTrack(track);
        attachTrack(track, localVideoRef.current);
        attachTrack(track, blurredBgRef.current);
        setIsVideoEnabled(true);
      } catch {
        setError('Unable to enable camera.');
      }
    }
  };

  const toggleAudio = async () => {
    if (!room || !VideoLibRef.current) return;
    const VideoLib = VideoLibRef.current;
    if (isAudioEnabled) {
      room.localParticipant.audioTracks.forEach((pub) => {
        pub.track.stop();
        room.localParticipant.unpublishTrack(pub.track);
      });
      setIsAudioEnabled(false);
    } else {
      try {
        const track = await VideoLib.createLocalAudioTrack();
        room.localParticipant.publishTrack(track);
        setIsAudioEnabled(true);
      } catch {
        setError('Unable to enable microphone.');
      }
    }
  };

  const endCall = () => {
    if (room) room.disconnect();
    navigate('/');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <motion.div
          className="p-8 bg-gray-800 rounded-xl shadow-lg text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <h2 className="text-2xl font-bold mb-4">⚠ Connection Error</h2>
          <p className="mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-500 rounded-lg mr-2">
            Retry
          </button>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-gray-500 rounded-lg">
            Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-gray-900 to-green-900 relative overflow-hidden">
      <motion.div
        className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-2xl md:text-3xl font-bold drop-shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        GP Out of Hour — {resolvedRoomName}
      </motion.div>

      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        <AnimatePresence>
          {participants.length === 0 && (
            <motion.div
              key="waiting"
              className="flex items-center justify-center bg-gray-800 text-white col-span-full rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isConnecting ? 'Connecting...' : 'Waiting for participants...'}
            </motion.div>
          )}
          {participants.map((p) => (
            <motion.div
              key={p.sid}
              id={`participant-${p.sid}`}
              className="relative bg-black rounded-lg overflow-hidden"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-xs">
                {p.identity}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Local video with blurred background */}
      <motion.div
        drag
        dragConstraints={{ left: 0, top: 0, right: 300, bottom: 300 }}
        className="absolute top-20 right-4 w-40 h-32 rounded-lg overflow-hidden border-2 border-white shadow-lg cursor-move"
      >
        <div
          ref={blurredBgRef}
          className="absolute inset-0 blur-lg scale-110 opacity-50"
          style={{ pointerEvents: 'none' }}
        />
        <div ref={localVideoRef} className="relative w-full h-full flex items-center justify-center">
          {!isVideoEnabled && (
            <div className="text-white text-center">
              <VideoOff size={24} />
              <p className="text-xs mt-1">Video Off</p>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4"
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 60 }}
      >
        <div className="flex justify-center space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-colors ${isAudioEnabled ? `bg-${themeColor}-500` : 'bg-red-500'}`}
          >
            {isAudioEnabled ? <Mic className="text-white" /> : <MicOff className="text-white" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${isVideoEnabled ? `bg-${themeColor}-500` : 'bg-red-500'}`}
          >
            {isVideoEnabled ? <Video className="text-white" /> : <VideoOff className="text-white" />}
          </button>
          <button onClick={endCall} className="p-4 rounded-full bg-red-500">
            <PhoneOff className="text-white" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VideoCallPage;
