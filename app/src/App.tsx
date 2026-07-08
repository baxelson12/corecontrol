import { useState } from "react";
import {
  Button,
  Field,
  Input,
  Text,
  Title1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { invoke } from "@tauri-apps/api/core";

/** Shape of the reply returned by the Rust `ping` command. */
type Pong = { message: string; echoed: string };

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    maxWidth: "420px",
    margin: "0 auto",
    padding: "48px 24px",
  },
  reply: {
    padding: "12px 16px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
});

/**
 * Root view. Sends a name to the Rust `ping` command and shows the reply,
 * proving the Tauri IPC bridge and Fluent UI render path both work.
 *
 * @returns The scaffold check screen.
 */
function App() {
  const styles = useStyles();
  const [name, setName] = useState("cooler");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Invokes the backend `ping` command with the current name, storing either
   * the greeting or a surfaced error for display.
   */
  async function onPing(): Promise<void> {
    setError(null);
    try {
      const pong = await invoke<Pong>("ping", { name });
      setReply(pong.message);
    } catch (err) {
      setReply(null);
      setError(typeof err === "string" ? err : "Unexpected error");
    }
  }

  return (
    <main className={styles.root}>
      <Title1>CoreLiquid</Title1>
      <Text>Scaffold check — call the Rust backend over Tauri IPC.</Text>
      <Field label="Name">
        <Input value={name} onChange={(_, data) => setName(data.value)} />
      </Field>
      <Button appearance="primary" onClick={() => void onPing()}>
        Ping backend
      </Button>
      {reply && <Text className={styles.reply}>{reply}</Text>}
      {error && <Text className={styles.error}>{error}</Text>}
    </main>
  );
}

export default App;
