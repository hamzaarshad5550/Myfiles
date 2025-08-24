// VideoCallPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Send, Download } from 'lucide-react';
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
  const recordingCheckIntervalRef = useRef(null);

  const [resolvedRoomName, setResolvedRoomName] = useState(urlRoomName);
  const [roomSid, setRoomSid] = useState(null);
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

  // Recording state
  const [compositionSid, setCompositionSid] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const isPatient = identityPrefix === 'patient';
  const themeColor = isPatient ? 'blue' : 'green';

  const backendBaseUrl =
    (WEBHOOK_CONFIG && WEBHOOK_CONFIG.BACKEND_BASE_URL) ||
    process.env.REACT_APP_BACKEND_URL ||
    'https://localhost:5001';
  const normalizedBackendUrl = backendBaseUrl.replace(/\/+$/, '');

  // --- attach / detach helpers ---
  const attachTrack = (track, container) => {
    if (!track || !container) return;
    const el = track.attach();
    container.appendChild(el);
  };

  const detachTrack = (track) => {
    if (!track) return;
    (track.detach ? track.detach() : []).forEach((el) => el.remove());
  };

  // --- cleanup ---
  const cleanupConnections = async () => {
    try { roomRef.current?.disconnect(); roomRef.current = null; } catch {}
    try { await hubConnectionRef.current?.stop(); hubConnectionRef.current = null; } catch {}
    if (recordingCheckIntervalRef.current) {
      clearInterval(recordingCheckIntervalRef.current);
      recordingCheckIntervalRef.current = null;
    }
    hasJoinedRef.current = false;
    setIsConnected(false);
  };

  // --- trigger download helper ---
  const triggerDownloadViaFetch = async (url, suggestedFilename) => {
    try {
      setStatus('Downloading recording...');
      
      // Use backend proxy for download to handle authentication
      const downloadResp = await fetch(`${normalizedBackendUrl}/api/video/download-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: url })
      });
      
      if (!downloadResp.ok) throw new Error(`Download failed: ${downloadResp.status}`);
      
      const blob = await downloadResp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = suggestedFilename || `recording_${compositionSid || Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      setStatus('Download started');
      toast.success('Download started.');
    } catch (err) {
      console.error('triggerDownload error:', err);
      setStatus('Download failed.');
      toast.error(err.message || 'Download failed.');
    }
  };

  // --- leave call handler ---
  const leaveCall = async () => {
    try {
      await cleanupConnections();
      navigate('/thank-you');
    } catch (err) {
      console.error('Error leaving call:', err);
      toast.error('Error leaving call');
      try { await cleanupConnections(); } catch {}
      navigate('/');
    }
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
    setParticipants((prev) => prev.some((p) => p.sid === participant.sid) ? prev : [...prev, participant]);
    participant.tracks.forEach((pub) => handlePublication(participant.sid, pub));
    participant.on('trackPublished', (pub) => handlePublication(participant.sid, pub));
    participant.on('trackUnpublished', (pub) => pub.track && detachTrack(pub.track));
  };

  const handleParticipantDisconnected = (participant) => {
    setParticipants((prev) => prev.filter((p) => p.sid !== participant.sid));
    participant.tracks.forEach((pub) => pub.track && detachTrack(pub.track));
  };

  // Check recording status periodically
  const checkRecordingStatus = async (sid) => {
    try {
      const res = await fetch(`${normalizedBackendUrl}/api/video/recording-status/${sid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'completed' && data.downloadUrl) {
          setDownloadUrl(data.downloadUrl);
          setIsRecording(false);
          setStatus('Recording complete. Ready for download.');
          toast.success('Recording ready for download.');
          if (recordingCheckIntervalRef.current) {
            clearInterval(recordingCheckIntervalRef.current);
            recordingCheckIntervalRef.current = null;
          }
        } else if (data.status === 'failed') {
          setIsRecording(false);
          setStatus('Recording failed.');
          toast.error('Recording failed.');
          if (recordingCheckIntervalRef.current) {
            clearInterval(recordingCheckIntervalRef.current);
            recordingCheckIntervalRef.current = null;
          }
        }
      }
    } catch (err) {
      console.error('Error checking recording status:', err);
    }
  };

  // --- join room ---
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

        const tokenResp = await fetch(`${normalizedBackendUrl}/api/video/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity: id, roomName: urlRoomName, userType: identityPrefix }),
        });
        if (!tokenResp.ok) throw new Error(`Failed to get token: ${tokenResp.status}`);
        const { token, roomName: serverRoomName } = await tokenResp.json();

        const VideoLib = await import('twilio-video');
        VideoLibRef.current = VideoLib;

        // Try to get user media, but don't fail if not available
        const tracks = [];
        try {
          if (isVideoEnabled) {
            const videoTrack = await VideoLib.createLocalVideoTrack().catch(() => {
              setIsVideoEnabled(false);
              toast.error('Camera not available');
              return null;
            });
            if (videoTrack) tracks.push(videoTrack);
          }
        } catch (e) {
          setIsVideoEnabled(false);
          console.warn('Video not available:', e);
        }

        try {
          if (isAudioEnabled) {
            const audioTrack = await VideoLib.createLocalAudioTrack().catch(() => {
              setIsAudioEnabled(false);
              toast.error('Microphone not available');
              return null;
            });
            if (audioTrack) tracks.push(audioTrack);
          }
        } catch (e) {
          setIsAudioEnabled(false);
          console.warn('Audio not available:', e);
        }

        const connectedRoom = await VideoLib.connect(token, { 
          name: serverRoomName || urlRoomName, 
          tracks,
          dominantSpeaker: true,
          networkQuality: true,
          preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }]
        });
        
        roomRef.current = connectedRoom;
        setResolvedRoomName(serverRoomName || urlRoomName);
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('Connected');

        // Get the room SID for recording
        setRoomSid(connectedRoom.sid);

        connectedRoom.localParticipant.videoTracks.forEach((pub) => { 
          if(pub.track) attachTrack(pub.track, localVideoRef.current); 
        });
        
        connectedRoom.participants.forEach(handleParticipantConnected);
        connectedRoom.on('participantConnected', handleParticipantConnected);
        connectedRoom.on('participantDisconnected', handleParticipantDisconnected);
        connectedRoom.on('disconnected', (disconnectedRoom) => {
          setIsConnected(false);
          setConnectionStatus('Disconnected');
          disconnectedRoom.localParticipant.tracks.forEach((pub) => pub.track && detachTrack(pub.track));
        });

        if (!hubConnectionRef.current) {
          const hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${normalizedBackendUrl}/chathub?roomName=${encodeURIComponent(serverRoomName || urlRoomName)}&identity=${encodeURIComponent(id)}`)
            .withAutomaticReconnect()
            .build();
          hubConnection.on('ReceiveMessage', (user, message) => {
            setChatMessages((prev) => [...prev, { from: user, text: message, self: user === id, timestamp: new Date().toISOString() }]);
          });
          hubConnection.on('ForceDisconnect', async () => { toast.error('Another session is using your identity.'); await cleanupConnections(); });
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
  }, [urlRoomName, identityPrefix, location.search, normalizedBackendUrl]);

  // --- chat helpers ---
  const scrollToBottom = () => { if(chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; };
  useEffect(() => { if(!chatScrollRef.current) return; const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current; setShowScrollToLatest(!(scrollHeight - scrollTop <= clientHeight + 50)); }, [chatMessages]);
  const handleScroll = () => { if(!chatScrollRef.current) return; const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current; setShowScrollToLatest(!(scrollHeight - scrollTop <= clientHeight + 50)); };
  
  const toggleVideo = async () => {
    if(!roomRef.current || !VideoLibRef.current) return;
    if(isVideoEnabled){
      roomRef.current.localParticipant.videoTracks.forEach(pub=>{
        detachTrack(pub.track); 
        pub.track.stop?.(); 
        roomRef.current.localParticipant.unpublishTrack(pub.track);
      });
      setIsVideoEnabled(false);
    } else { 
      try { 
        const track = await VideoLibRef.current.createLocalVideoTrack().catch(() => {
          toast.error('Camera not available');
          return null;
        });
        if (track) {
          roomRef.current.localParticipant.publishTrack(track); 
          attachTrack(track, localVideoRef.current); 
          setIsVideoEnabled(true);
        }
      } catch { 
        toast.error('Unable to start video.'); 
      } 
    } 
  };
  
  const toggleAudio = async () => {
    if(!roomRef.current || !VideoLibRef.current) return;
    if(isAudioEnabled){
      roomRef.current.localParticipant.audioTracks.forEach(pub=>{
        pub.track.stop?.(); 
        roomRef.current.localParticipant.unpublishTrack(pub.track);
      });
      setIsAudioEnabled(false);
    } else { 
      try { 
        const track = await VideoLibRef.current.createLocalAudioTrack().catch(() => {
          toast.error('Microphone not available');
          return null;
        });
        if (track) {
          roomRef.current.localParticipant.publishTrack(track); 
          setIsAudioEnabled(true);
        }
      } catch { 
        toast.error('No microphone available.'); 
      } 
    } 
  };
  
  const sendChat = async () => { 
    if(!smsInput.trim() || !hubConnectionRef.current) return; 
    const msg = smsInput.trim(); 
    setSmsInput(''); 
    try { 
      await hubConnectionRef.current.invoke('SendMessage', resolvedRoomName, identity, msg); 
    } catch (err) { 
      console.error('Chat send failed:', err); 
    } 
  };

  // --- Recording handlers ---
  const startRecording = async () => {
    if(isRecordingBusy) return;
    setIsRecordingBusy(true); 
    setStatus(null);
    try {
      if(!resolvedRoomName && !roomSid) throw new Error('Room information not available.');
      
      const requestBody = roomSid 
        ? { RoomSid: roomSid, RoomName: resolvedRoomName }
        : { RoomName: resolvedRoomName };
        
      const res = await fetch(`${normalizedBackendUrl}/api/video/start-recording`, { 
        method:'POST', 
        headers:{'Content-Type':'application/json'}, 
        body:JSON.stringify(requestBody) 
      });
      
      if(!res.ok) throw new Error(`Start failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      const sid = data.compositionSid || data.sid;
      if(!sid) throw new Error('No compositionSid returned.');
      setCompositionSid(sid); 
      setIsRecording(true); 
      setDownloadUrl(null); 
      setStatus('Recording started...');
      
      // Start checking recording status periodically
      if (recordingCheckIntervalRef.current) {
        clearInterval(recordingCheckIntervalRef.current);
      }
      recordingCheckIntervalRef.current = setInterval(() => checkRecordingStatus(sid), 5000);
      
      toast.success('Recording started.');
    } catch(err){ 
      console.error(err); 
      setStatus(err.message); 
      toast.error(err.message); 
    } finally{ 
      setIsRecordingBusy(false); 
    }
  };

  const stopRecording = async () => {
    console.log('stopRecording called with:', {
      compositionSid,
      roomSid,
      resolvedRoomName
    });

    if(!compositionSid && !roomSid && !resolvedRoomName) {
      toast.error('No active recording or room information.');
      return;
    }

    setIsRecordingBusy(true);
    setStatus('Stopping recording...');
    try {
      // Use CompositionSid if available (preferred method)
      if (compositionSid) {
        const requestBody = { CompositionSid: compositionSid };
        
        const res = await fetch(`${normalizedBackendUrl}/api/video/stop-recording`, { 
          method:'POST', 
          headers:{'Content-Type':'application/json'}, 
          body:JSON.stringify(requestBody) 
        });
        
        if(!res.ok) {
          const errorText = await res.text();
          throw new Error(`Stop failed: ${res.status} ${errorText}`);
        }
        
        const data = await res.json();
        handleStopResponse(data);
      } 
      // Fallback to room-based approach if CompositionSid is not available
      else if (roomSid && resolvedRoomName) {
        // Send both RoomSid and RoomName (both are required by backend)
        const requestBody = {
          RoomSid: roomSid,
          RoomName: resolvedRoomName
        };

        console.log('Sending stop recording request with:', requestBody);

        const res = await fetch(`${normalizedBackendUrl}/api/video/stop-recording`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(requestBody)
        });
        
        if(!res.ok) {
          const errorText = await res.text();
          throw new Error(`Stop failed: ${res.status} ${errorText}`);
        }
        
        const data = await res.json();
        handleStopResponse(data);
      } else {
        // If we don't have both required fields, show a specific error
        const missingFields = [];
        if (!roomSid) missingFields.push('RoomSid');
        if (!resolvedRoomName) missingFields.push('RoomName');
        throw new Error(`Cannot stop recording: Missing required fields: ${missingFields.join(', ')}`);
      }
    } catch(err){
      console.error(err); 
      setStatus('Error while stopping recording.'); 
      toast.error(err.message); 
    } finally{ 
      setIsRecordingBusy(false); 
    }
  };

  const handleStopResponse = (data) => {
    if (data.status === 'completed' && data.downloadUrl) {
      setDownloadUrl(data.downloadUrl);
      setIsRecording(false);
      setStatus('Recording complete. Ready for download.');
      toast.success('Recording ready for download.');
    } else {
      // If not completed yet, start checking status
      setStatus(`Recording is ${data.status || 'processing'}...`);
      if (recordingCheckIntervalRef.current) {
        clearInterval(recordingCheckIntervalRef.current);
      }
      recordingCheckIntervalRef.current = setInterval(() => checkRecordingStatus(data.compositionSid || compositionSid), 5000);
      toast.info(`Recording is ${data.status || 'processing'}. Download will be available soon.`);
    }
  };

  const downloadRecording = async () => {
    if (!downloadUrl) return;
    await triggerDownloadViaFetch(downloadUrl, `recording_${compositionSid}.mp4`);
  };

  // --- Render ---
  const uniqueParticipants = participants.reduce((acc,curr)=>{ if(!acc.some(p=>p.sid===curr.sid)) acc.push(curr); return acc; },[]);
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3">
        {/* Video Area */}
        <div className="lg:col-span-2 relative p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <AnimatePresence>
            {uniqueParticipants.length===0 && (<motion.div key="waiting" className="flex items-center justify-center bg-gray-800 text-white col-span-full rounded-lg">{isConnecting?'Connecting...':'Waiting for participants...'}</motion.div>)}
            {uniqueParticipants.map(p=>(
              <motion.div key={`participant-${p.sid}`} id={`participant-${p.sid}`} className="relative bg-black rounded-lg overflow-hidden">
                <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-sm">{p.identity}</span>
              </motion.div>
            ))}
            <div ref={localVideoRef} className="relative bg-black rounded-lg overflow-hidden">
              <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-sm">You</span>
            </div>
          </AnimatePresence>
        </div>

        {/* Chat & Controls */}
        <div className="flex flex-col p-2 space-y-2">
          <div className="flex-1 overflow-y-auto border rounded p-2" ref={chatScrollRef} onScroll={handleScroll}>
            {chatMessages.map((msg, idx)=>(
              <div key={idx} className={`p-1 ${msg.self?'text-right':'text-left'}`}>
                <div className="inline-block bg-gray-700 text-white px-2 py-1 rounded">{msg.text}</div>
                <div className="text-xs text-gray-400">{msg.from} • {new Date(msg.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>

          {showScrollToLatest && <button onClick={scrollToBottom} className="bg-blue-500 text-white p-1 rounded text-sm">Scroll to latest</button>}

          <div className="flex space-x-2">
            <input type="text" value={smsInput} onChange={(e)=>setSmsInput(e.target.value)} placeholder="Type a message..." className="flex-1 p-2 rounded"/>
            <button onClick={sendChat} className="bg-blue-500 p-2 rounded"><Send size={16}/></button>
          </div>

          <div className="flex space-x-2 justify-center flex-wrap">
            <button onClick={toggleVideo} className={`p-2 rounded ${isVideoEnabled?'bg-green-600':'bg-gray-600'}`}>{isVideoEnabled?<Video size={16}/>:<VideoOff size={16}/>}</button>
            <button onClick={toggleAudio} className={`p-2 rounded ${isAudioEnabled?'bg-green-600':'bg-gray-600'}`}>{isAudioEnabled?<Mic size={16}/>:<MicOff size={16}/>}</button>
            <button onClick={leaveCall} className="p-2 rounded bg-red-600"><PhoneOff size={16}/></button>
            <button onClick={startRecording} disabled={isRecording || isRecordingBusy} className="p-2 rounded bg-yellow-600">Start Recording</button>
            <button onClick={stopRecording} disabled={!isRecording || isRecordingBusy} className="p-2 rounded bg-orange-600">Stop Recording</button>
            {downloadUrl && (
              <button onClick={downloadRecording} className="p-2 rounded bg-green-600">
                <Download size={16} />
              </button>
            )}
          </div>

          {status && <div className="text-sm text-white text-center">{status}</div>}
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;