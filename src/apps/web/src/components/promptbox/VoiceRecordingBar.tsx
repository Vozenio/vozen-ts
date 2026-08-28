import "@/lib/i18n/promptbox";
import { useTranslation } from "react-i18next";
import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { cn } from "@bb/shared-ui/lib/utils";
import { WaveformVisualizer } from "./WaveformVisualizer.js";

interface VoiceRecordingBarProps {
  state: "recording" | "transcribing";
  stream: MediaStream | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONTROL_BUTTON_CLASS =
  "size-8 rounded-full p-0 max-md:pointer-coarse:size-10";

export function VoiceRecordingBar({
  state,
  stream,
  onConfirm,
  onCancel,
}: VoiceRecordingBarProps) {
  const { t } = useTranslation();
  const isTranscribing = state === "transcribing";

  return (
    <div className="flex flex-row items-center gap-2 px-2 py-1.5">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={
          isTranscribing
            ? t("promptbox.voiceRecordingBar.cancelTranscription")
            : t("promptbox.voiceRecordingBar.cancelRecording")
        }
        onClick={onCancel}
        className={CONTROL_BUTTON_CLASS}
      >
        <Icon name="X" className="size-4" />
      </Button>
      <div className="relative flex min-w-0 flex-1 items-center">
        <div
          className={cn("h-7 w-full", isTranscribing && "animate-shine-icon")}
        >
          <WaveformVisualizer stream={stream} active={!isTranscribing} />
        </div>
        <span className="sr-only" aria-live="polite">
          {isTranscribing
            ? t("promptbox.voiceRecordingBar.transcribing")
            : t("promptbox.voiceRecordingBar.recording")}
        </span>
      </div>
      <Button
        type="button"
        size="icon"
        variant="default"
        aria-label={
          isTranscribing
            ? t("promptbox.voiceRecordingBar.transcribingVoiceInput")
            : t("promptbox.voiceRecordingBar.stopAndTranscribe")
        }
        disabled={isTranscribing}
        onClick={onConfirm}
        className={CONTROL_BUTTON_CLASS}
      >
        {isTranscribing ? (
          <Icon name="Spinner" className="size-4 animate-spin" />
        ) : (
          <Icon name="Check" className="size-4" />
        )}
      </Button>
    </div>
  );
}
