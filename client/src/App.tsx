import { useState } from "react";
import { createTranscript } from "./api";
import Dashboard from "./Dashboard";
import Recorder from "./Recorder";

export default function App() {
  // Bumped after a save so the dashboard reloads its list.
  const [reloadKey, setReloadKey] = useState(0);

  const saveFromRecorder = async (text: string) => {
    await createTranscript({ text, language: "hi-en" });
    setReloadKey((key) => key + 1);
  };

  return (
    <main>
      <h1>Speech to Text</h1>
      <p className="subtitle">Speak in Hindi, English or a mix of both.</p>
      <Recorder onSave={saveFromRecorder} />
      <Dashboard reloadKey={reloadKey} />
    </main>
  );
}
