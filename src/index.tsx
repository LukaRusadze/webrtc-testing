import { useState } from "react";
import { Caller } from "./components/caller";
import { Receiver } from "./components/receiver";
import { Button } from "./components/ui/button";
import { Single } from "./components/single";

const mode = {
  caller: Caller,
  receiver: Receiver,
  single: Single,
} as const;

type Mode = keyof typeof mode;

export default function App() {
  const [currentMode, setCurrentMode] = useState<Mode | null>(null);

  if (!currentMode) {
    return (
      <main className="w-full min-h-screen flex justify-center items-center gap-12">
        <Button onClick={() => setCurrentMode("caller")}>Caller</Button>
        <Button onClick={() => setCurrentMode("receiver")}>Receiver</Button>
        <Button onClick={() => setCurrentMode("single")}>Single</Button>
      </main>
    );
  }

  const Component = mode[currentMode];

  return <Component />;
}
