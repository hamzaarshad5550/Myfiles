import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Send, Download, RefreshCw, FileText, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as signalR from '@microsoft/signalr';
import { WEBHOOK_CONFIG } from '../config/webhooks';
import toast from 'react-hot-toast';

const VideoCallPage = ({ identityPrefix }) => {
  const { roomName: urlRoomName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
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
  const [recordingSid, setRecordingSid] = useState(null);
  const [compositionSid, setCompositionSid] = useState(null);
  const [recordingType, setRecordingType] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [isRecordingBusy, setIsRecordingBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('');

  // Transcription state
  const [transcriptionSid, setTranscriptionSid] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranscriptionBusy, setIsTranscriptionBusy] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState('');
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('en-US');
  const [transcripts, setTranscripts] = useState([]);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState(null);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const isPatient = identityPrefix === 'patient';
  const backendBaseUrl =
    (WEBHOOK_CONFIG && WEBHOOK_CONFIG.BACKEND_BASE_URL) ||
    process.env.REACT_APP_BACKEND_URL ||
    'https://localhost:5001';
  const normalizedBackendUrl = backendBaseUrl.replace(/\/+$/, '');

  // --- Helper functions ---
  const attachTrack = (track, container) => {
    if (!track || !container) return;
    const el = track.attach();
    container.appendChild(el);
  };

  const detachTrack = (track) => {
    if (!track) return;
    (track.detach ? track.detach() : []).forEach((el) => el.remove());
  };

  const cleanupConnections = async () => {
    try {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    } catch (error) {
      console.warn('Error disconnecting room:', error);
    }

    try {
      if (hubConnectionRef.current) {
        await hubConnectionRef.current.stop();
        hubConnectionRef.current = null;
      }
    } catch (error) {
      console.warn('Error stopping hub connection:', error);
    }

    if (recordingCheckIntervalRef.current) {
      clearInterval(recordingCheckIntervalRef.current);
      recordingCheckIntervalRef.current = null;
    }

    // Stop transcription if active
    if (isTranscribing && !isTranscriptionBusy) {
      try {
        if (speechRecognition) {
          speechRecognition.stop();
          setSpeechRecognition(null);
        }
        setIsTranscribing(false);
        setTranscriptionStatus('stopped');
        setCurrentTranscript('');
      } catch (error) {
        console.warn('Error stopping transcription:', error);
      }
    }

    hasJoinedRef.current = false;
    setIsConnected(false);
  };

  const triggerDownloadViaFetch = async (url, suggestedFilename) => {
    try {
      setStatus('Downloading recording...');

      // Use the appropriate SID for download
      const sidToUse = compositionSid || recordingSid;

      const downloadResp = await fetch(`${normalizedBackendUrl}/api/video/download-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: url !== `${normalizedBackendUrl}/api/video/download-recording` ? url : undefined,
          recordingSid: sidToUse
        })
      });

      if (!downloadResp.ok) {
        const errorText = await downloadResp.text();
        throw new Error(`Download failed: ${downloadResp.status} ${errorText}`);
      }

      const blob = await downloadResp.blob();
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = suggestedFilename || `recording_${sidToUse || Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      setStatus('Download completed');
      toast.success('Download completed successfully!');
    } catch (err) {
      console.error('triggerDownload error:', err);
      setStatus('Download failed.');
      toast.error(err.message || 'Download failed.');
    }
  };

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

  const checkRecordingStatus = async () => {
    try {
      let sid = recordingType === 'recording' ? recordingSid : compositionSid;
      if (!sid) {
        console.log('No SID available for status check');
        return;
      }

      console.log(`Checking status for ${recordingType} SID: ${sid}`);
      // Use auto-detection for type
      const res = await fetch(`${normalizedBackendUrl}/api/video/recording-status/${sid}?type=auto`);
      if (res.ok) {
        const data = await res.json();
        console.log('Recording status response:', data);
        setRecordingStatus(data.status);

        // Update recording type if it changed (e.g., fallback from composition to recording)
        if (data.type !== recordingType) {
          console.log(`Recording type changed from ${recordingType} to ${data.type}`);
          setRecordingType(data.type);
          if (data.type === 'recording' && data.sid) {
            setRecordingSid(data.sid);
            setCompositionSid(null);
          } else if (data.type === 'composition' && data.sid) {
            setCompositionSid(data.sid);
            setRecordingSid(null);
          }
        }

        if (data.status === 'completed') {
          setDownloadUrl(data.downloadUrl || `${normalizedBackendUrl}/api/video/download-recording`);
          setIsRecording(false);
          setStatus(`Recording complete (${data.duration || 0}s). Ready for download.`);
          toast.success('Recording ready for download!');
          if (recordingCheckIntervalRef.current) {
            clearInterval(recordingCheckIntervalRef.current);
            recordingCheckIntervalRef.current = null;
          }
        }
        else if (data.status === 'enqueued' || data.status === 'processing') {
          setStatus(`Recording is ${data.status}. Processing may take several minutes...`);
        }
        else if (data.status === 'failed') {
          setIsRecording(false);
          setStatus('Recording failed.');
          toast.error('Recording failed.');
          if (recordingCheckIntervalRef.current) {
            clearInterval(recordingCheckIntervalRef.current);
            recordingCheckIntervalRef.current = null;
          }
        }
        else {
          setStatus(`Recording status: ${data.status}`);
        }
      } else {
        console.error('Failed to fetch recording status:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Error checking recording status:', err);
    }
  };

  // --- Room connection ---
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
        
        if (!tokenResp.ok) {
          const errorText = await tokenResp.text();
          throw new Error(`Failed to get token: ${tokenResp.status} ${errorText}`);
        }
        
        const { token, roomName: serverRoomName } = await tokenResp.json();

        const VideoLib = await import('twilio-video');

        // Try to get user media
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

        setRoomSid(connectedRoom.sid);

        // Attach local video track
        connectedRoom.localParticipant.videoTracks.forEach((pub) => { 
          if(pub.track) attachTrack(pub.track, localVideoRef.current); 
        });
        
        // Handle participants
        connectedRoom.participants.forEach(handleParticipantConnected);
        connectedRoom.on('participantConnected', handleParticipantConnected);
        connectedRoom.on('participantDisconnected', handleParticipantDisconnected);
        
        connectedRoom.on('disconnected', (disconnectedRoom) => {
          setIsConnected(false);
          setConnectionStatus('Disconnected');
          disconnectedRoom.localParticipant.tracks.forEach((pub) => pub.track && detachTrack(pub.track));
        });

        // Setup SignalR chat
        if (!hubConnectionRef.current) {
          const hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${normalizedBackendUrl}/chathub?roomName=${encodeURIComponent(serverRoomName || urlRoomName)}&identity=${encodeURIComponent(id)}`)
            .withAutomaticReconnect()
            .build();
          
          hubConnection.on('ReceiveMessage', (user, message) => {
            setChatMessages((prev) => [...prev, { 
              from: user, 
              text: message, 
              self: user === id, 
              timestamp: new Date().toISOString() 
            }]);
          });
          
          hubConnection.on('ForceDisconnect', async () => { 
            toast.error('Another session is using your identity.'); 
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
        toast.error('Failed to join the video call');
      }
    };

    if (urlRoomName) {
      joinRoom();
    }
    
    return () => {
      cleanupConnections();
    };
  }, [urlRoomName, identityPrefix, location.search, normalizedBackendUrl]);

  // --- Chat helpers ---
  const scrollToBottom = () => { 
    if(chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; 
    }
  };
  
  useEffect(() => {
    if(!chatScrollRef.current) return; 
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current; 
    setShowScrollToLatest(!(scrollHeight - scrollTop <= clientHeight + 50));
  }, [chatMessages]);
  
  const handleScroll = () => {
    if(!chatScrollRef.current) return; 
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current; 
    setShowScrollToLatest(!(scrollHeight - scrollTop <= clientHeight + 50));
  };

  const toggleVideo = async () => {
    if(!roomRef.current) return;
    
    if(isVideoEnabled){
      roomRef.current.localParticipant.videoTracks.forEach(pub => {
        detachTrack(pub.track); 
        pub.track.stop?.(); 
        roomRef.current.localParticipant.unpublishTrack(pub.track);
      });
      setIsVideoEnabled(false);
    } else { 
      try { 
        const VideoLib = await import('twilio-video');
        const track = await VideoLib.createLocalVideoTrack().catch(() => {
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
    if(!roomRef.current) return;
    
    if(isAudioEnabled){
      roomRef.current.localParticipant.audioTracks.forEach(pub => {
        pub.track.stop?.(); 
        roomRef.current.localParticipant.unpublishTrack(pub.track);
      });
      setIsAudioEnabled(false);
    } else { 
      try { 
        const VideoLib = await import('twilio-video');
        const track = await VideoLib.createLocalAudioTrack().catch(() => {
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
      toast.error('Failed to send message');
    } 
  };

  // --- Recording handlers ---
  const startRecording = async () => {
    if(isRecordingBusy) return;
    setIsRecordingBusy(true);
    setStatus(null);
    setRecordingStatus('');

    try {
      if(!resolvedRoomName || !roomSid) {
        throw new Error('Room information not available. Please wait for connection to complete.');
      }

      const requestBody = {
        RoomSid: roomSid,
        RoomName: resolvedRoomName
      };

      console.log('Starting recording with:', requestBody);
      const res = await fetch(`${normalizedBackendUrl}/api/video/start-recording`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(requestBody)
      });

      if(!res.ok) {
        let errorDetails = '';
        try {
          const errorData = await res.json();
          errorDetails = errorData.details || errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = await res.text();
        }

        throw new Error(`Start failed: ${res.status} ${errorDetails}`);
      }

      const data = await res.json();
      console.log('Start recording response:', data);

      // Handle the response - support both recording types
      if (data.type === 'recording') {
        if (data.recordingSid) {
          setRecordingSid(data.recordingSid);
          setCompositionSid(null);
        } else {
          // Room recording enabled but no specific SID yet
          setRecordingSid(data.roomSid);
          setCompositionSid(null);
        }
        setRecordingType('recording');
        setRecordingStatus(data.status || 'processing');
      } else if (data.type === 'composition' && data.compositionSid) {
        setCompositionSid(data.compositionSid);
        setRecordingSid(null);
        setRecordingType('composition');
        setRecordingStatus(data.status || 'enqueued');
      } else {
        throw new Error('Invalid response from server');
      }

      setIsRecording(true);
      setDownloadUrl(null);
      setStatus('Recording started. Processing...');

      // Clear any existing interval
      if (recordingCheckIntervalRef.current) {
        clearInterval(recordingCheckIntervalRef.current);
      }

      // Start checking status every 5 seconds
      recordingCheckIntervalRef.current = setInterval(() => checkRecordingStatus(), 5000);

      toast.success('Recording started successfully!');
    } catch(err){
      console.error('Start recording error:', err);
      setStatus(err.message);
      toast.error(err.message);
    } finally{
      setIsRecordingBusy(false);
    }
  };

  const stopRecording = async () => {
    if (!compositionSid && !recordingSid && (!roomSid || !resolvedRoomName)) {
      toast.error('No active recording to stop.');
      return;
    }

    setIsRecordingBusy(true);
    setStatus('Checking recording status...');

    try {
      const requestBody = {
        RecordingSid: recordingSid || "",
        CompositionSid: compositionSid || "",
        RoomSid: roomSid || "",
        RoomName: resolvedRoomName || ""
      };

      console.log('Stopping recording with:', requestBody);
      const res = await fetch(`${normalizedBackendUrl}/api/video/stop-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        let errorDetails = '';
        try {
          const errorData = await res.json();
          errorDetails = errorData.details || errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = await res.text();
        }

        throw new Error(`Stop failed: ${res.status} ${errorDetails}`);
      }

      const data = await res.json();
      console.log('Stop recording response:', data);

      // Update state based on response
      if (data.type === 'recording' && (data.recordingSid || data.sid)) {
        setRecordingSid(data.recordingSid || data.sid);
        setCompositionSid(null);
        setRecordingType('recording');
      } else if (data.type === 'composition' && (data.compositionSid || data.sid)) {
        setCompositionSid(data.compositionSid || data.sid);
        setRecordingSid(null);
        setRecordingType('composition');
      }

      setRecordingStatus(data.status);

      // Handle different statuses
      if (data.status === 'completed') {
        setDownloadUrl(data.downloadUrl || `${normalizedBackendUrl}/api/video/download-recording`);
        setIsRecording(false);
        setStatus(`Recording complete (${data.duration || 0}s). Ready for download.`);
        toast.success('Recording ready for download!');

        if (recordingCheckIntervalRef.current) {
          clearInterval(recordingCheckIntervalRef.current);
          recordingCheckIntervalRef.current = null;
        }
      }
      else if (data.status === 'enqueued' || data.status === 'processing') {
        setStatus(`Recording is ${data.status}. Processing may take several minutes...`);

        if (recordingCheckIntervalRef.current) {
          clearInterval(recordingCheckIntervalRef.current);
        }

        // For stuck compositions, check more frequently
        const checkInterval = (data.type === 'composition' && data.status === 'enqueued') ? 5000 : 10000;
        recordingCheckIntervalRef.current = setInterval(() => checkRecordingStatus(), checkInterval);

        toast.success(`Recording is being processed. Please wait...`);
      }
      else if (data.status === 'failed') {
        setIsRecording(false);
        setStatus('Recording failed.');
        toast.error('Recording failed. Please try starting a new recording.');

        if (recordingCheckIntervalRef.current) {
          clearInterval(recordingCheckIntervalRef.current);
          recordingCheckIntervalRef.current = null;
        }
      }
      else {
        setStatus(`Recording status: ${data.status}`);

        if (recordingCheckIntervalRef.current) {
          clearInterval(recordingCheckIntervalRef.current);
        }

        // Continue checking for other statuses
        recordingCheckIntervalRef.current = setInterval(() => checkRecordingStatus(), 8000);

        toast.info(`Recording status: ${data.status}`);
      }
    } catch(err) {
      console.error('Error in stopRecording:', err);
      setStatus('Error while checking recording status.');
      toast.error(err.message);
    } finally {
      setIsRecordingBusy(false);
    }
  };

  const downloadRecording = async () => {
    if (!downloadUrl && !recordingSid && !compositionSid) {
      toast.error('No recording available for download');
      return;
    }

    try {
      setStatus('Preparing download...');

      // Use the appropriate SID for download
      const sidToUse = compositionSid || recordingSid;

      if (sidToUse) {
        console.log(`Downloading ${recordingType} with SID: ${sidToUse}`);
        await triggerDownloadViaFetch(
          downloadUrl || `${normalizedBackendUrl}/api/video/download-recording`,
          `${recordingType}_${sidToUse}.mp4`
        );
      } else {
        throw new Error('No recording SID available for download');
      }
    } catch (err) {
      console.error('Download error:', err);
      setStatus('Download failed');
      toast.error(err.message || 'Download failed');
    }
  };

  const refreshRecordingStatus = async () => {
    if (!recordingSid && !compositionSid) return;
    await checkRecordingStatus();
    toast.success('Recording status refreshed');
  };

  // --- Transcription handlers ---
  const startTranscription = async () => {
    if (isTranscriptionBusy) return;
    setIsTranscriptionBusy(true);

    try {
      if (!resolvedRoomName || !roomSid) {
        throw new Error('Room information not available. Please wait for connection to complete.');
      }

      // Check if browser supports Web Speech API
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        throw new Error('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      }

      // Check microphone permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
        console.log('Microphone permission granted');
      } catch (permissionError) {
        console.error('Microphone permission error:', permissionError);
        if (permissionError.name === 'NotAllowedError') {
          throw new Error('Microphone access denied. Please allow microphone access in your browser and try again.');
        } else if (permissionError.name === 'NotFoundError') {
          throw new Error('No microphone found. Please connect a microphone and try again.');
        } else {
          throw new Error(`Microphone error: ${permissionError.message}`);
        }
      }

      const requestBody = {
        RoomSid: roomSid,
        RoomName: resolvedRoomName,
        Language: transcriptionLanguage
      };

      console.log('Starting transcription with:', requestBody);
      const res = await fetch(`${normalizedBackendUrl}/api/video/start-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        let errorDetails = '';
        try {
          const errorData = await res.json();
          errorDetails = errorData.details || errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = await res.text();
        }
        throw new Error(`Start transcription failed: ${res.status} ${errorDetails}`);
      }

      const data = await res.json();
      console.log('Start transcription response:', data);

      // Initialize Web Speech API
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = transcriptionLanguage;

      recognition.onstart = () => {
        console.log('Speech recognition started');
        setTranscriptionStatus('listening');
        setStatus('🎤 Listening for speech...');
      };

      recognition.onresult = async (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Update current transcript display
        setCurrentTranscript(interimTranscript);

        // Store final transcripts
        if (finalTranscript) {
          const newTranscript = {
            text: finalTranscript,
            participantIdentity: identity || 'You',
            timestamp: new Date().toISOString(),
            isFinal: true
          };

          setTranscripts(prev => [...prev, newTranscript]);

          // Send to backend for storage
          try {
            await fetch(`${normalizedBackendUrl}/api/video/store-transcript`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                roomSid: roomSid,
                text: finalTranscript,
                participantIdentity: identity || 'You',
                isFinal: true
              })
            });
          } catch (err) {
            console.error('Failed to store transcript:', err);
          }
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setIsTranscribing(false);
          setTranscriptionStatus('permission-denied');
          setStatus('Microphone access denied');
          toast.error('Microphone access denied. Please allow microphone access in your browser settings and try again.');
        } else if (event.error === 'no-speech') {
          toast.error('No speech detected. Please speak closer to your microphone.');
        } else if (event.error === 'audio-capture') {
          toast.error('No microphone found. Please check your microphone connection.');
        } else if (event.error === 'network') {
          toast.error('Network error occurred during speech recognition.');
        } else {
          toast.error(`Speech recognition error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        console.log('Speech recognition ended');
        if (isTranscribing) {
          // Restart if still transcribing
          setTimeout(() => {
            if (isTranscribing) {
              recognition.start();
            }
          }, 100);
        }
      };

      setSpeechRecognition(recognition);
      recognition.start();

      setTranscriptionSid(data.transcriptionSid);
      setIsTranscribing(true);
      setTranscriptionStatus('listening');
      setStatus('🎤 Real-time transcription started');
      toast.success('Real-time transcription started!');

    } catch (err) {
      console.error('Start transcription error:', err);
      setStatus(err.message);
      toast.error(err.message);
    } finally {
      setIsTranscriptionBusy(false);
    }
  };

  const stopTranscription = async () => {
    if (isTranscriptionBusy) return;
    setIsTranscriptionBusy(true);

    try {
      // Stop Web Speech API
      if (speechRecognition) {
        speechRecognition.stop();
        setSpeechRecognition(null);
      }

      const requestBody = {
        TranscriptionSid: transcriptionSid || "",
        RoomSid: roomSid || "",
        RoomName: resolvedRoomName || ""
      };

      console.log('Stopping transcription with:', requestBody);
      const res = await fetch(`${normalizedBackendUrl}/api/video/stop-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        let errorDetails = '';
        try {
          const errorData = await res.json();
          errorDetails = errorData.details || errorData.error || JSON.stringify(errorData);
        } catch {
          errorDetails = await res.text();
        }
        throw new Error(`Stop transcription failed: ${res.status} ${errorDetails}`);
      }

      const data = await res.json();
      console.log('Stop transcription response:', data);

      setIsTranscribing(false);
      setTranscriptionStatus('stopped');
      setCurrentTranscript('');
      setStatus('Transcription stopped');
      toast.success('Transcription stopped');

      // Fetch final transcripts
      if (roomSid) {
        await fetchTranscripts();
      }

    } catch (err) {
      console.error('Stop transcription error:', err);
      setStatus(err.message);
      toast.error(err.message);
    } finally {
      setIsTranscriptionBusy(false);
    }
  };

  const fetchTranscripts = async () => {
    if (!roomSid) return;

    try {
      const res = await fetch(`${normalizedBackendUrl}/api/video/transcriptions/${roomSid}`);
      if (res.ok) {
        const data = await res.json();
        console.log('Transcripts response:', data);
        if (data.transcripts && data.transcripts.length > 0) {
          setTranscripts(data.transcripts);
          toast.success(`Found ${data.transcripts.length} transcript entries`);
        } else {
          toast.success('No transcripts available yet');
        }
      }
    } catch (err) {
      console.error('Fetch transcripts error:', err);
      toast.error('Failed to fetch transcripts');
    }
  };

  const toggleTranscripts = () => {
    setShowTranscripts(!showTranscripts);
    if (!showTranscripts && transcripts.length === 0) {
      fetchTranscripts();
    }
  };

  // --- Render ---
  const uniqueParticipants = participants.reduce((acc, curr) => {
    if(!acc.some(p => p.sid === curr.sid)) acc.push(curr); 
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3">
        {/* Video Area */}
        <div className="lg:col-span-2 relative p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
          <AnimatePresence>
            {uniqueParticipants.length === 0 && (
              <motion.div 
                key="waiting" 
                className="flex items-center justify-center bg-gray-800 text-white col-span-full rounded-lg"
              >
                {isConnecting ? 'Connecting...' : 'Waiting for participants...'}
              </motion.div>
            )}
            
            {uniqueParticipants.map(participant => (
              <motion.div 
                key={`participant-${participant.sid}`} 
                id={`participant-${participant.sid}`} 
                className="relative bg-black rounded-lg overflow-hidden"
              >
                <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-sm">
                  {participant.identity}
                </span>
              </motion.div>
            ))}
            
            <div ref={localVideoRef} className="relative bg-black rounded-lg overflow-hidden">
              <span className="absolute bottom-0 left-0 bg-black bg-opacity-50 text-white px-2 py-1 text-sm">
                You
              </span>
            </div>
          </AnimatePresence>
        </div>

        {/* Chat & Controls */}
        <div className="flex flex-col p-2 space-y-2">
          <div className="flex-1 overflow-y-auto border rounded p-2 bg-gray-800" ref={chatScrollRef} onScroll={handleScroll}>
            {chatMessages.length === 0 ? (
              <div className="text-gray-400 text-center p-4">No messages yet</div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`p-1 ${msg.self ? 'text-right' : 'text-left'}`}>
                  <div className="inline-block bg-gray-700 text-white px-2 py-1 rounded">
                    {msg.text}
                  </div>
                  <div className="text-xs text-gray-400">
                    {msg.from} • {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>

          {showScrollToLatest && (
            <button 
              onClick={scrollToBottom} 
              className="bg-blue-500 text-white p-1 rounded text-sm"
            >
              Scroll to latest
            </button>
          )}

          <div className="flex space-x-2">
            <input
              type="text"
              value={smsInput}
              onChange={(e) => setSmsInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 p-2 rounded bg-gray-700 text-white"
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            />
            <button 
              onClick={sendChat} 
              className="bg-blue-500 p-2 rounded text-white"
              disabled={!smsInput.trim()}
            >
              <Send size={16}/>
            </button>
          </div>

          {/* Recording Status Display */}
          {(recordingStatus || recordingType) && (
            <div className="p-2 bg-gray-800 rounded text-white text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span>Recording - Type: {recordingType || 'unknown'} | </span>
                  <span>Status: {recordingStatus || 'checking'}</span>
                </div>
                {recordingStatus !== 'completed' && (
                  <button
                    onClick={refreshRecordingStatus}
                    className="p-1 bg-gray-700 rounded"
                    title="Refresh status"
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Transcription Status Display */}
          {(isTranscribing || transcriptionStatus) && (
            <div className={`p-2 rounded text-white text-sm ${
              transcriptionStatus === 'permission-denied' ? 'bg-red-800' : 'bg-blue-800'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span>Transcription - Language: {transcriptionLanguage} | </span>
                  <span>Status: {transcriptionStatus || 'checking'}</span>
                  {isTranscribing && <span className="ml-2 animate-pulse">🎤 Live</span>}
                  {transcriptionStatus === 'permission-denied' && (
                    <span className="ml-2 text-red-200">❌ Permission Required</span>
                  )}
                </div>
              </div>
              {/* Permission help */}
              {transcriptionStatus === 'permission-denied' && (
                <div className="mt-2 p-2 bg-red-700 rounded text-xs">
                  <div className="text-red-200">To enable transcription:</div>
                  <div className="text-white">
                    1. Click the microphone icon in your browser's address bar<br/>
                    2. Select "Allow" for microphone access<br/>
                    3. Refresh the page and try again
                  </div>
                </div>
              )}
              {/* Current transcript (interim results) */}
              {currentTranscript && (
                <div className="mt-2 p-2 bg-blue-700 rounded text-xs">
                  <div className="text-blue-200">Currently speaking:</div>
                  <div className="text-white italic">"{currentTranscript}"</div>
                </div>
              )}
            </div>
          )}

          {/* Transcripts Viewer */}
          {showTranscripts && (
            <div className="p-2 bg-gray-800 rounded text-white text-sm max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">
                  Transcripts ({transcripts.length})
                  {isTranscribing && <span className="ml-2 text-green-400">● Recording</span>}
                </h4>
                <button
                  onClick={fetchTranscripts}
                  className="p-1 bg-gray-700 rounded hover:bg-gray-600"
                  title="Refresh transcripts"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              {transcripts.length === 0 ? (
                <div className="text-gray-400 text-center py-4">
                  {transcriptionStatus === 'permission-denied' ? (
                    <div>
                      <div className="text-red-400">❌ Microphone access required</div>
                      <div className="text-xs mt-1">Please allow microphone access to enable transcription</div>
                    </div>
                  ) : isTranscribing ? (
                    <div>
                      <div className="animate-pulse">🎤 Listening for speech...</div>
                      <div className="text-xs mt-1">Speak into your microphone to see transcripts here</div>
                    </div>
                  ) : (
                    <div>
                      <div>No transcripts available yet.</div>
                      <div className="text-xs mt-1">Start transcription to see real-time text.</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {transcripts.map((transcript, index) => (
                    <div key={index} className="border-l-2 border-blue-500 pl-2 py-1">
                      <div className="text-xs text-gray-400 flex items-center justify-between">
                        <span>{transcript.participantIdentity || 'Unknown'}</span>
                        <span>{new Date(transcript.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-white mt-1">{transcript.text}</div>
                    </div>
                  ))}
                  {/* Auto-scroll to bottom */}
                  <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2 justify-center flex-wrap">
            <button 
              onClick={toggleVideo} 
              className={`p-2 rounded ${isVideoEnabled ? 'bg-green-600' : 'bg-gray-600'} text-white`}
              title={isVideoEnabled ? 'Turn off video' : 'Turn on video'}
            >
              {isVideoEnabled ? <Video size={16}/> : <VideoOff size={16}/>}
            </button>
            
            <button 
              onClick={toggleAudio} 
              className={`p-2 rounded ${isAudioEnabled ? 'bg-green-600' : 'bg-gray-600'} text-white`}
              title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            >
              {isAudioEnabled ? <Mic size={16}/> : <MicOff size={16}/>}
            </button>
            
            <button 
              onClick={leaveCall} 
              className="p-2 rounded bg-red-600 text-white"
              title="Leave call"
            >
              <PhoneOff size={16}/>
            </button>
            
            <button 
              onClick={startRecording} 
              disabled={isRecording || isRecordingBusy || !isConnected}
              className="p-2 rounded bg-yellow-600 text-white disabled:bg-gray-600"
              title="Start recording"
            >
              Start Recording
            </button>
            
            <button 
              onClick={stopRecording} 
              disabled={!isRecording || isRecordingBusy}
              className="p-2 rounded bg-orange-600 text-white disabled:bg-gray-600"
              title="Stop recording"
            >
              Stop Recording
            </button>
            
            {downloadUrl && (
              <button
                onClick={downloadRecording}
                className="p-2 rounded bg-green-600 text-white"
                title="Download recording"
              >
                <Download size={16} />
              </button>
            )}
          </div>

          {/* Transcription Controls */}
          <div className="flex space-x-2 justify-center flex-wrap mt-2">
            <select
              value={transcriptionLanguage}
              onChange={(e) => setTranscriptionLanguage(e.target.value)}
              className="p-2 rounded bg-gray-700 text-white text-sm"
              disabled={isTranscribing}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
              <option value="it-IT">Italian</option>
              <option value="pt-BR">Portuguese (Brazil)</option>
              <option value="ja-JP">Japanese</option>
              <option value="ko-KR">Korean</option>
              <option value="zh-CN">Chinese (Mandarin)</option>
            </select>

            <button
              onClick={startTranscription}
              disabled={isTranscribing || isTranscriptionBusy || !isConnected}
              className="p-2 rounded bg-blue-600 text-white disabled:bg-gray-600 text-sm"
              title={!isConnected ? "Connect to room first" : "Start transcription"}
            >
              <Play size={16} className="inline mr-1" />
              {isTranscriptionBusy ? 'Starting...' : 'Start Transcription'}
            </button>

            <button
              onClick={stopTranscription}
              disabled={!isTranscribing || isTranscriptionBusy}
              className="p-2 rounded bg-red-600 text-white disabled:bg-gray-600 text-sm"
              title="Stop transcription"
            >
              <Square size={16} className="inline mr-1" />
              Stop Transcription
            </button>

            <button
              onClick={toggleTranscripts}
              className="p-2 rounded bg-purple-600 text-white text-sm"
              title="View transcripts"
            >
              <FileText size={16} className="inline mr-1" />
              {showTranscripts ? 'Hide' : 'Show'} Transcripts
            </button>
          </div>

          {status && (
            <div className="text-sm text-white text-center p-2 bg-gray-800 rounded">
              {status}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 text-center p-2 bg-gray-800 rounded">
              Error: {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallPage;