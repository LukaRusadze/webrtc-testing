import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";

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
  ],
  iceCandidatePoolSize: 10,
});

export function Receiver() {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!code) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <div className="flex flex-col gap-4 rounded-xl bg-white p-8 shadow">
          <h1 className="text-2xl font-bold">Join a call</h1>
          <Input ref={inputRef} placeholder="Insert call code here..." />
          <Button
            onClick={() => {
              if (inputRef.current) {
                setCode(inputRef.current.value);
              }
            }}
          >
            Join
          </Button>
        </div>
      </main>
    );
  }

  return <CallScreen code={code} />;
}

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

function CallScreen({ code }: { code: string }) {
  const { data: localStream } = useCamera();

  const remoteStream = useMemo(() => new MediaStream(), []);

  const callDoc = useMemo(
    () => doc(collection(firestore, "calls"), code),
    [code],
  );
  const answerCandidates = useMemo(
    () => collection(callDoc, "answerCandidates"),
    [callDoc],
  );
  const offerCandidates = useMemo(
    () => collection(callDoc, "offerCandidates"),
    [callDoc],
  );

  useEffect(() => {
    (async () => {
      const offerDescription = (await getDoc(callDoc)).data()?.offer;
      await pc.setRemoteDescription(
        new RTCSessionDescription(offerDescription),
      );

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      } as const;

      await updateDoc(callDoc, { answer });
    })();
  }, [callDoc]);

  useEffect(() => {
    pc.addEventListener("track", (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    });
  }, [remoteStream]);

  useEffect(() => {
    return onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          console.log("data", data);
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  }, [offerCandidates]);

  useEffect(() => {
    function onEvent(event: RTCPeerConnectionIceEvent) {
      if (!event.candidate) {
        return;
      }

      addDoc(answerCandidates, event.candidate.toJSON());
    }

    pc.addEventListener("icecandidate", onEvent);

    return () => {
      pc.removeEventListener("icecandidate", onEvent);
    };
  }, [answerCandidates]);

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
    </main>
  );
}
