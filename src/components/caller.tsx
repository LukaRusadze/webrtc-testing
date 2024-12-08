import { useQuery } from "@tanstack/react-query";
import { firestore } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { useLayoutEffect } from "react";

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

function useCamera() {
  return useQuery({
    queryKey: ["local-camera"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      return stream;
    },
  });
}

async function onIceCandidate(event: RTCPeerConnectionIceEvent) {
  if (!event.candidate) {
    return;
  }

  const callDoc = doc(collection(firestore, "calls"));
  const offerCandidates = collection(callDoc, "offerCandidates");

  console.log("candidate", event.candidate.toJSON());

  await new Promise((resolve) => setTimeout(resolve, 5000));

  addDoc(offerCandidates, event.candidate.toJSON())
    .then(console.warn)
    .catch(console.error);
}

function onRemoteTrack(event: RTCTrackEvent) {
  console.log("remote track", event);
  event.streams[0].getTracks().forEach((track) => {
    console.log("remote track", track);
  });
}

function useCallStart(enabled: boolean) {
  return useQuery({
    queryKey: ["start-call"],
    refetchOnWindowFocus: false,
    enabled,
    queryFn: async () => {
      const callDoc = doc(collection(firestore, "calls"));

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      } as const;

      await setDoc(callDoc, { offer });

      return callDoc.id;
    },
  });
}

export function Caller() {
  useLayoutEffect(() => {
    pc.addEventListener("icecandidate", onIceCandidate);

    return () => {
      pc.removeEventListener("icecandidate", onIceCandidate);
    };
  }, []);

  useLayoutEffect(() => {
    const callDoc = doc(collection(firestore, "calls"));

    return onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        console.log(data);
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });
  }, []);

  useLayoutEffect(() => {
    const callDoc = doc(collection(firestore, "calls"));
    const answerCandidates = collection(callDoc, "answerCandidates");

    return onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  }, []);

  useLayoutEffect(() => {
    pc.addEventListener("track", onRemoteTrack);

    return () => {
      pc.removeEventListener("track", onRemoteTrack);
    };
  }, []);

  const { data: localStream } = useCamera();
  const { data: callId } = useCallStart(Boolean(localStream));

  return (
    <main className="flex bg-black w-full min-h-screen">
      <section className="flex-1 h-full max-h-screen w-full overflow-hidden flex">
        <video
          className="flex-1 object-cover"
          autoPlay
          playsInline
          muted
          ref={(ref) => {
            if (ref && localStream instanceof MediaStream) {
              ref.srcObject = localStream;
            }
          }}
        />
      </section>
      <CallId callId={callId} />
    </main>
  );
}

function CallId(props: { callId?: string }) {
  if (!props.callId) {
    return null;
  }

  return (
    <div className="bg-white px-4 py-2 rounded-xl absolute left-16 bottom-16">
      {props.callId}
    </div>
  );
}
