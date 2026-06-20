class WebRTCManager {
  constructor(socket, currentUserId) {
    this.socket = socket;
    this.currentUserId = currentUserId;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = new MediaStream();
    this.activeStreams = [];
    
    // Callbacks
    this.onRemoteStream = null;
    this.onCallIncoming = null;
    this.onCallAccepted = null;
    this.onCallRejected = null;
    this.onCallEnded = null;

    // Listen for signaling messages
    this.socket.on('offer', async (data) => {
      if (data.targetId === this.currentUserId) {
        await this.handleOffer(data);
      }
    });

    this.socket.on('answer', async (data) => {
      if (data.targetId === this.currentUserId) {
        await this.handleAnswer(data.answer);
      }
    });

    this.socket.on('ice-candidate', async (data) => {
      if (data.targetId === this.currentUserId) {
        await this.handleIceCandidate(data.candidate);
      }
    });

    // Call Signaling
    this.socket.on('call_initiated', (data) => {
      if (data.targetId === this.currentUserId && this.onCallIncoming) {
        this.onCallIncoming(data);
      }
    });

    this.socket.on('call_accepted', (data) => {
      if (data.targetId === this.currentUserId && this.onCallAccepted) {
        this.onCallAccepted(data);
      }
    });

    this.socket.on('call_rejected', (data) => {
      if (data.targetId === this.currentUserId && this.onCallRejected) {
        this.onCallRejected(data);
        this.cleanup();
      }
    });

    this.socket.on('call_ended', (data) => {
      if (data.targetId === this.currentUserId && this.onCallEnded) {
        this.onCallEnded(data);
        this.cleanup();
      }
    });
  }

  createPeerConnection(targetId) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { targetId, candidate: event.candidate });
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream.addTrack(event.track);
      if (this.onRemoteStream) this.onRemoteStream(this.remoteStream);
    };
  }

  async initiateCall(targetId, type = 'video', callerName = '') {
    this.socket.emit('call_initiated', { targetId, callerId: this.currentUserId, callerName, type });
  }

  async acceptCall(callerId, type = 'video') {
    this.socket.emit('call_accepted', { targetId: callerId, responderId: this.currentUserId });
  }

  rejectCall(callerId) {
    this.socket.emit('call_rejected', { targetId: callerId, responderId: this.currentUserId });
  }

  endCall(targetId) {
    this.socket.emit('call_ended', { targetId, callerId: this.currentUserId });
    this.cleanup();
  }

  async getLocalMedia(type = 'video') {
    try {
      let newStream;
      if (type === 'screen') {
        newStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } else {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video' ? {
            width: { min: 1280, ideal: 2560 },
            height: { min: 720, ideal: 1440 },
            frameRate: { ideal: 30 }
          } : false,
          audio: true
        });
      }
      this.localStream = newStream;
      this.activeStreams.push(newStream);
      return newStream;
    } catch (err) {
      console.error('Error getting local media:', err);
      throw err;
    }
  }

  async replaceVideoTrack(newStream) {
    if (!this.peerConnection) return;
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (!newVideoTrack) return;
    const sender = this.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) {
      await sender.replaceTrack(newVideoTrack);
    } else {
      this.peerConnection.addTrack(newVideoTrack, newStream);
    }
  }

  async startConnection(targetId) {
    if (!this.peerConnection) {
      this.createPeerConnection(targetId);
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        // Prevent duplicate tracks
        if (!this.peerConnection.getSenders().find(s => s.track === track)) {
          this.peerConnection.addTrack(track, this.localStream);
        }
        track.onended = () => {
          this.endCall(targetId);
        };
      });
    }

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    this.socket.emit('offer', { targetId, callerId: this.currentUserId, offer });
  }

  async handleOffer(data) {
    if (!this.peerConnection) {
      this.createPeerConnection(data.callerId);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (!this.peerConnection.getSenders().find(s => s.track === track)) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });
    }
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    this.socket.emit('answer', { targetId: data.callerId, answer });
  }

  async handleAnswer(answer) {
    if (this.peerConnection) {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleIceCandidate(candidate) {
    if (this.peerConnection) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  cleanup() {
    if (this.activeStreams) {
      this.activeStreams.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      this.activeStreams = [];
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = new MediaStream();
  }
}

export default WebRTCManager;
