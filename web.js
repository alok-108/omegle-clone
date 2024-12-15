// WebRTC Setup
let localStream;
let peerStream;
let peerConnection;
let userId = generateUniqueId();
let userTag = ''; // Tag for connecting users
let isVideoActive = false;
let isPaired = false;

const socket = new WebSocket("wss://anonymous-chat-vlbb.onrender.com"); // Replace with your WebSocket server URL
const messageInput = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const messagesContainer = document.getElementById("messages");
const startVideoBtn = document.getElementById("startVideoBtn");
const tagInput = document.getElementById("tagInput");
const userVideo = document.getElementById("user-video");
const peerVideo = document.getElementById("peer-video");

// Generate unique user ID
function generateUniqueId() {
  return 'user-' + Math.random().toString(36).substring(2, 15);
}

// WebSocket message handler
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.type === "pair") {
    handlePairing(message.peerId);
  } else if (message.type === "offer") {
    handleOffer(message.offer);
  } else if (message.type === "answer") {
    handleAnswer(message.answer);
  } else if (message.type === "candidate") {
    handleCandidate(message.candidate);
  }
};

// Send a message to the server to request pairing based on tag
function requestPairing() {
  userTag = tagInput.value.trim();
  if (!userTag) {
    alert("Please enter a tag!");
    return;
  }

  socket.send(JSON.stringify({ type: "pair", userId, tag: userTag }));
}

// Handle user pairing (start video chat)
function handlePairing(peerId) {
  if (!isPaired) {
    // Start video chat with the other user in the queue
    startVideoChat(peerId);
    isPaired = true;
  }
}

// Create WebRTC connection and start video
async function startVideoChat(peerId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStream = stream;
    userVideo.srcObject = stream;

    // Create peer connection
    createPeerConnection(peerId);
  } catch (err) {
    console.error("Error accessing camera: ", err);
  }
}

// Set up peer connection for WebRTC
function createPeerConnection(peerId) {
  peerConnection = new RTCPeerConnection();

  // Add local stream to the peer connection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle incoming stream from peer
  peerConnection.ontrack = (event) => {
    peerStream = event.streams[0];
    peerVideo.srcObject = peerStream;
  };

  // Handle ICE candidates for NAT traversal
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.send(JSON.stringify({
        type: "candidate",
        candidate: event.candidate,
        peerId
      }));
    }
  };

  // Create and send offer to the peer
  peerConnection.createOffer().then((offer) => {
    peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "offer", offer, peerId }));
  });
}

// Handle incoming offer from peer
function handleOffer(offer) {
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  peerConnection.createAnswer().then((answer) => {
    peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: "answer", answer }));
  });
}

// Handle incoming answer from peer
function handleAnswer(answer) {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle ICE candidate from peer
function handleCandidate(candidate) {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Handle sending text messages
sendMessageBtn.onclick = () => {
  const message = messageInput.value;
  if (message) {
    socket.send(JSON.stringify({ type: "message", message, userId }));
    displayMessage(message, "user");
    messageInput.value = "";
  }
};

// Display messages in the chat window
function displayMessage(message, sender) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);
  messageElement.textContent = message;
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Start or stop video when button is clicked
startVideoBtn.onclick = () => {
  if (!isVideoActive) {
    requestPairing(); // Request pairing with another user based on tag
    isVideoActive = true;
    startVideoBtn.textContent = "End Video";
  } else {
    endVideoChat(); // Disconnect video chat
    isVideoActive = false;
    startVideoBtn.textContent = "Start Video";
  }
};

// End video chat and stop media
function endVideoChat() {
  if (peerConnection) {
    peerConnection.close();
    localStream.getTracks().forEach((track) => track.stop());
    userVideo.srcObject = null;
    peerVideo.srcObject = null;
    peerConnection = null;
  }
  isPaired = false;
}
