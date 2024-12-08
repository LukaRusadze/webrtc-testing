import { useQuery } from "@tanstack/react-query";
import { firestore } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  DocumentData,
  DocumentReference,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { useMemo, useEffect } from "react";

const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
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

function useCallStart(
  callDoc: DocumentReference<DocumentData, DocumentData>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["start-call"],
    refetchOnWindowFocus: false,
    enabled,
    queryFn: async () => {
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
  const callDoc = useMemo(() => doc(collection(firestore, "calls")), []);
  const offerCandidates = useMemo(
    () => collection(callDoc, "offerCandidates"),
    [callDoc],
  );
  const answerCandidates = useMemo(
    () => collection(callDoc, "answerCandidates"),
    [callDoc],
  );
  const remoteStream = useMemo(() => new MediaStream(), []);

  const { data: localStream } = useCamera();
  const { data: callId } = useCallStart(callDoc, Boolean(localStream));

  useEffect(() => {
    function onIceCandidate(event: RTCPeerConnectionIceEvent) {
      if (!event.candidate) {
        return;
      }

      addDoc(offerCandidates, event.candidate.toJSON());
    }

    pc.addEventListener("icecandidate", (event) => onIceCandidate(event));

    return () => {
      pc.removeEventListener("icecandidate", (event) => onIceCandidate(event));
    };
  }, [offerCandidates]);

  useEffect(() => {
    return onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        console.log(data);
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });
  }, [callDoc]);

  useEffect(() => {
    return onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  }, [answerCandidates]);

  useEffect(() => {
    function onRemoteTrack(event: RTCTrackEvent) {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    }

    pc.addEventListener("track", onRemoteTrack);

    return () => {
      pc.removeEventListener("track", onRemoteTrack);
    };
  }, [remoteStream]);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 px-4 md:flex-row md:gap-8 md:px-32">
      <section className="w-full">
        <h1 className="text-2xl font-bold">Your Video</h1>
        {localStream ? (
          <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow md:aspect-video">
            <video
              autoPlay
              playsInline
              muted
              className="absolute h-full w-full object-cover"
              ref={(el) => el && (el.srcObject = localStream)}
            />
          </div>
        ) : null}
      </section>
      <section className="w-full">
        <h1 className="text-2xl font-bold">Remote Video</h1>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow md:aspect-video">
          <video
            autoPlay
            playsInline
            className="absolute h-full w-full object-cover"
            ref={(el) => el && (el.srcObject = remoteStream)}
          />
        </div>
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
    <div className="absolute bottom-2 rounded-xl bg-white px-4 py-2 shadow md:bottom-20">
      {props.callId}
    </div>
  );
}
