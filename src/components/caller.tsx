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
    {
      urls: [
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
    {
      urls: "relay1.expressturn.com:3478",
      username: "ef34TD0W09CBD8KFQU",
      credential: "zVZalLG6s3Lr3V4I",
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
    pc.addEventListener("connectionstatechange", console.warn);
    pc.addEventListener("iceconnectionstatechange", console.warn);
    pc.addEventListener("icegatheringstatechange", console.warn);
    pc.addEventListener("signalingstatechange", console.warn);
    pc.addEventListener("negotiationneeded", console.warn);
    pc.addEventListener("datachannel", console.warn);
    pc.addEventListener("icecandidateerror", console.warn);
    pc.addEventListener("", console.warn);

    return () => {
      pc.removeEventListener("connectionstatechange", console.warn);
      pc.removeEventListener("iceconnectionstatechange", console.warn);
      pc.removeEventListener("icegatheringstatechange", console.warn);
      pc.removeEventListener("signalingstatechange", console.warn);
      pc.removeEventListener("negotiationneeded", console.warn);
      pc.removeEventListener("datachannel", console.warn);
      pc.removeEventListener("icecandidateerror", console.warn);
    };
  }, []);

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
        console.log(track);
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
