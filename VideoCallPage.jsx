import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Send, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as signalR from '@microsoft/signalr';
import { WEBHOOK_CONFIG } from '../config/webhooks';
import toast from 'react-hot-toast';

const VideoCallPage = ({ identityPrefix }) => {
  const { roomName: urlRoomName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const blurredBgRef = useRef(null);
  const VideoLibRef = useRef(null);
  const hubConnectionRef = useRef(null);
  const roomRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const chatScrollRef = useRef(null);

  const [resolvedRoomName, setResolvedRoomName] = useState(urlRoomName);
  const [participants, setParticipants] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [error, setError] = useState(null);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const [chatMessages, setChatMessages] = useState([]);
  const [smsInput, setSmsInput] = useState('');
  const [identity, setIdentity] = useState('');

  const [showScrollToLatest, setShowScrollToLatest] = useState(false);

  const isPatient = identityPrefix === 'patient';
  const themeColor = isPatient ? 'blue' : 'green';

  const backendBaseUrl =
    (WEBHOOK_CONFIG && WEBHOOK_CONFIG.BACKEND_BASE_URL) ||
    process.env.REACT_APP_BACKEND_URL ||
    'https://localhost:5001';

  // --- cleanup ---
  const cleanupConnections = async () => {
    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch {}
    try {
      if (hubConnectionRef.current) {
        await hubConnectionRef.current.stop();
        hubConnectionRef.current = null;
      }
    } catch {}
    hasJoinedRef.current = false;
    setIsConnected(false);
  };

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

  const handlePublication = (participantSid, publication) => {
    if (publication.track) {
      const container = document.getElementById(`participant-${participantSid}`);
      if (container) attachTrack(publication.track, container);
    }
    publication.on('subscribed', (track) => {
      const container = document.getElementById(`participant-${participantSid}`);
      if (container) attachTrack(track, container);
    });
    publication.on('unsubscribed', (track) => detachTrack(track));
  };

  const handleParticipantConnected = (participant) => {
    if (participant.identity === roomRef.current?.localParticipant.identity) return;
    setParticipants((prev) => {
      const exists = prev.some((p) => p.sid === participant.sid);
      return exists ? prev : [...prev, participant];
    });
    participant.tracks.forEach((publication) => handlePublication(participant.sid, publication));
    participant.on('trackPublished', (publication) => handlePublication(participant.sid, publication));
    participant.on('trackUnpublished', (publication) => {
      if (publication.track) detachTrack(publication.track);
    });
  };

  const handleParticipantDisconnected = (participant) => {
    setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
    participant.tracks.forEach((pub) => pub.track && detachTrack(pub.track));
  };

  useEffect(() => {
    const joinRoom = async () => {
      if (hasJoinedRef.current) return;
      hasJoinedRef.current = true;

      try {
        await cleanupConnections();
        setIsConnecting(true);
        setConnectionStatus('Connecting...');

        const queryParams = new URLSearchParams(location.search);
        const idFromUrl = queryParams.get('identity');
        const id = idFromUrl || `${identityPrefix}_${Math.floor(Math.random() * 10000)}`;
        setIdentity(id);

        const tokenResp = await fetch(WEBHOOK_CONFIG.VIDEO_TOKEN_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: id, roomName: urlRoomName, userType: identityPrefix }),
        });
        if (!tokenResp.ok) throw new Error(`Failed to get token: ${tokenResp.status}`);
        const { token, roomName: serverRoomName } = await tokenResp.json();

        const VideoLib = await import('twilio-video');
        VideoLibRef.current = VideoLib;

        const tracks = [];
        if (isVideoEnabled) {
          try {
            const vTrack = await VideoLib.createLocalVideoTrack();
            tracks.push(vTrack);
          } catch {
            setIsVideoEnabled(false);
          }
        }
        if (isAudioEnabled) {
          try {
            const aTrack = await VideoLib.createLocalAudioTrack();
            tracks.push(aTrack);
          } catch {
            setIsAudioEnabled(false);
            toast('No microphone detected, continuing without audio.');
          }
        }

        const connectedRoom = await VideoLib.connect(token, { name: serverRoomName || urlRoomName, tracks });
        roomRef.current = connectedRoom;
        setResolvedRoomName(serverRoomName || urlRoomName);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('Connected');

        connectedRoom.localParticipant.videoTracks.forEach((pub) => {
          if (pub.track && localVideoRef.current) {
            const el = pub.track.attach();
            localVideoRef.current.appendChild(el);
          }
        });

        connectedRoom.participants.forEach((p) => handleParticipantConnected(p));
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

        const normalizedApi = backendBaseUrl.replace(/\/+$/, '');
        if (!hubConnectionRef.current) {
          const hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${normalizedApi}/chathub?roomName=${encodeURIComponent(serverRoomName || urlRoomName)}&identity=${encodeURIComponent(id)}`)
            .withAutomaticReconnect()
            .build();

          hubConnection.on('ReceiveMessage', (user, message) => {
            setChatMessages((prev) => [
              ...prev,
              { from: user, text: message, self: user === id, timestamp: new Date().toISOString() },
            ]);
          });

          hubConnection.on('ForceDisconnect', async () => {
            toast.error('Another session is using your identity.', { duration: 4000 });
            await cleanupConnections();
          });

          await hubConnection.start();
          hubConnectionRef.current = hubConnection;
        }
      } catch (err) {
        setError(err.message || 'Connection failed.');
        setIsConnecting(false);
        setConnectionStatus('Failed');
        hasJoinedRef.current = false;
        console.error('Join room error:', err);
      }
    };

    if (urlRoomName) joinRoom();
    return () => cleanupConnections();
  }, [urlRoomName, identityPrefix, location.search, backendBaseUrl]);

  // --- chat scroll handling ---
  const scrollToBottom = () => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; };

  useEffect(() => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const isNearBottom = scrollHeight - scrollTop <= clientHeight + 50;
    if (isNearBottom) scrollToBottom();
    else setShowScrollToLatest(true);
  }, [chatMessages]);

  const handleScroll = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    setShowScrollToLatest(!(scrollHeight - scrollTop <= clientHeight + 50));
  };

  // --- controls ---
  const toggleVideo = async () => {
    if (!roomRef.current || !VideoLibRef.current) return;
    if (isVideoEnabled) {
      roomRef.current.localParticipant.videoTracks.forEach((pub) => {
        detachTrack(pub.track);
        pub.track.stop();
        roomRef.current.localParticipant.unpublishTrack(pub.track);
      });
      setIsVideoEnabled(false);
    } else {
      try {
        const track = await VideoLibRef.current.createLocalVideoTrack();
        roomRef.current.localParticipant.publishTrack(track);
        attachTrack(track, localVideoRef.current);
        attachTrack(track, blurredBgRef.current);
        setIsVideoEnabled(true);
      } catch { toast.error('Unable to start video.'); }
    }
  };

  const toggleAudio = async () => {
    if (!roomRef.current || !VideoLibRef.current) return;
    if (isAudioEnabled) {
      roomRef.current.localParticipant.audioTracks.forEach((pub) => {
        pub.track.stop();
        roomRef.current.localParticipant.unpublishTrack(pub.track);
      });
      setIsAudioEnabled(false);
    } else {
      try {
        const track = await VideoLibRef.current.createLocalAudioTrack();
        roomRef.current.localParticipant.publishTrack(track);
        setIsAudioEnabled(true);
      } catch { toast.error('No microphone available.'); }
    }
  };

  const endCall = () => {
    cleanupConnections();
    navigate('/');
  };

  const sendChat = async () => {
    if (!smsInput.trim() || !hubConnectionRef.current) return;
    const msg = smsInput.trim();
    setSmsInput('');
    try { await hubConnectionRef.current.invoke('SendMessage', resolvedRoomName, identity, msg); } catch (err) { console.error('Chat send failed:', err); }
  };

  const uniqueParticipants = participants.reduce((acc, curr) => { if (!acc.some((p) => p.sid === curr.sid)) acc.push(curr); return acc; }, []);

  const formatDate = (date) => {
    const today = new Date();
    const d = new Date(date);
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3">
        {/* Video Area */}
        <div className="lg:col-span-2 relative p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <AnimatePresence>
            {uniqueParticipants.length === 0 && (
              <motion.div key="waiting" className="flex items-center justify-center bg-gray-800 text-white col-span-full rounded-lg">
                {isConnecting ? 'Connecting...' : 'Waiting for participants...'}
              </motion.div>
            )}
            {uniqueParticipants.map((p) => (
              <motion.div key={`participant-${p.sid}`} id={`participant-${p.sid}`} className="relative bg-black rounded-lg overflow-hidden">
                <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-xs">{p.identity}</span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Local video */}
          <motion.div drag dragConstraints={{ left: 0, top: 0, right: 300, bottom: 300 }} className="absolute top-4 right-4 w-40 h-32 rounded-lg overflow-hidden border-2 border-white shadow-lg cursor-move">
            <div ref={blurredBgRef} className="absolute inset-0 blur-lg scale-110 opacity-50" style={{ pointerEvents: 'none' }} />
            <div ref={localVideoRef} className="relative w-full h-full flex items-center justify-center">
              {!isVideoEnabled && (<div className="text-white text-center"><VideoOff size={24}/><p className="text-xs mt-1">Video Off</p></div>)}
            </div>
          </motion.div>
        </div>

        {/* Chat Panel */}
        <div className="bg-gray-800 flex flex-col border-l border-gray-700 relative">
          <div className="p-3 border-b border-gray-700 text-white font-bold">Live Chat</div>
          <div ref={chatScrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 && <div className="text-gray-400 text-sm text-center mt-4">No messages yet</div>}
            {chatMessages.map((msg, idx) => {
              const msgDate = formatDate(msg.timestamp);
              const prevDate = idx > 0 ? formatDate(chatMessages[idx - 1].timestamp) : null;
              const showDateSeparator = msgDate !== prevDate;
              const isPatientMsg = msg.from.toLowerCase().includes('patient');
              const bubbleColor = msg.self ? 'bg-blue-500 text-white ml-auto' : isPatientMsg ? 'bg-blue-400 text-white mr-auto' : 'bg-green-400 text-black mr-auto';

              return (
                <React.Fragment key={idx}>
                  {showDateSeparator && <div className="text-center text-xs text-gray-400 my-2">{msgDate}</div>}
                  <div className={`max-w-sm md:max-w-md lg:max-w-lg p-2 rounded-lg break-words ${bubbleColor}`}>
                    <div className="flex justify-between items-center text-xs opacity-80">
                      <span className="font-semibold">{msg.self ? 'You' : msg.from}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div>{msg.text}</div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          {showScrollToLatest && (
            <button onClick={scrollToBottom} className="absolute bottom-20 right-4 p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white shadow">
              <ArrowDown size={18}/>
            </button>
          )}

          <div className="p-3 border-t border-gray-700 flex space-x-2">
            <input
              value={smsInput}
              onChange={(e) => setSmsInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Type a message..."
              className="flex-1 rounded px-3 py-2 text-black"
            />
            <button onClick={sendChat} className="p-2 bg-blue-500 rounded text-white"><Send size={18}/></button>
          </div>
        </div>
      </div>

      {/* Call controls */}
      <div className="bg-black bg-opacity-50 p-4 flex justify-center space-x-4">
        <button onClick={toggleAudio} className={`p-4 rounded-full ${isAudioEnabled ? `bg-${themeColor}-500` : 'bg-red-500'}`}>
          {isAudioEnabled ? <Mic className="text-white"/> : <MicOff className="text-white"/>}
        </button>
        <button onClick={toggleVideo} className={`p-4 rounded-full ${isVideoEnabled ? `bg-${themeColor}-500` : 'bg-red-500'}`}>
          {isVideoEnabled ? <Video className="text-white"/> : <VideoOff className="text-white"/>}
        </button>
        <button onClick={endCall} className="p-4 rounded-full bg-red-500"><PhoneOff className="text-white"/></button>
      </div>
    </div>
  );
};

export default VideoCallPage;
