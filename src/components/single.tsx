import { useState } from "react";
import { firestore } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const pc = new RTCPeerConnection({
  iceServers: [
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun4.l.google.com:5349",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
});

function onStartCallIceCandidate(event: RTCPeerConnectionIceEvent) {
  if (!event.candidate) {
    return;
  }

  const callDoc = doc(collection(firestore, "calls"));
  const offerCandidates = collection(callDoc, "offerCandidates");

  addDoc(offerCandidates, event.candidate.toJSON());
}

export function Single() {
  const [localStream, setLocalStream] = useState(() => new MediaStream());
  const [remoteStream] = useState(() => new MediaStream());

  const [callId, setCallId] = useState("");

  async function startWebcam() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    console.log(stream);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    setLocalStream(stream);

    pc.addEventListener("track", (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    });
  }

  async function startCall() {
    const callDoc = doc(collection(firestore, "calls"));
    const answerCandidates = collection(callDoc, "answerCandidates");

    setCallId(callDoc.id);

    pc.removeEventListener("icecandidate", onStartCallIceCandidate);
    pc.addEventListener("icecandidate", onStartCallIceCandidate);

    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    } as const;

    await setDoc(callDoc, { offer });

    onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        console.log(data);
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  }

  async function answerCall() {
    const callDoc = doc(firestore, "calls", callId);
    const answerCandidates = collection(callDoc, "answerCandidates");
    const offerCandidates = collection(callDoc, "offerCandidates");

    pc.addEventListener("icecandidate", (event) => {
      console.log(event.candidate);
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    });

    const callData = (await getDoc(callDoc)).data();

    const offerDescription = callData?.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    } as const;

    await updateDoc(callDoc, { answer });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          console.log("data", data);
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }

  return (
    <main className="flex min-h-screen w-full">
      <section className="flex-1 flex-col items-center gap-4 justify-center flex">
        <video
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (video && localStream) {
              video.srcObject = localStream;
            }
          }}
        />
        <button
          onClick={startWebcam}
          className="bg-black text-white px-4 py-2 rounded-xl"
        >
          Start Webcam
        </button>

        <button
          onClick={startCall}
          className="bg-black text-white px-4 py-2 rounded-xl"
        >
          Start call
        </button>
      </section>

      <section>
        <input
          className="border-2"
          value={callId}
          onChange={(event) => {
            setCallId(event.target.value);
          }}
        />
      </section>

      <section className="flex-1 flex-col items-center gap-4 justify-center flex">
        <video
          autoPlay
          playsInline
          muted
          ref={(video) => {
            if (video && remoteStream) {
              video.srcObject = remoteStream;
            }
          }}
        />
        <button
          onClick={answerCall}
          className="bg-black text-white px-4 py-2 rounded-xl"
        >
          Answer
        </button>
      </section>
    </main>
  );
}
