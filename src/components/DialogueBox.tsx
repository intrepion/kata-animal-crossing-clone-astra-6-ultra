import { useEffect, useState } from "react";
import { ChevronDown, Heart } from "lucide-react";
import { Avatar } from "../Icons";

export interface DialogueChoice {
  label: string;
  action: () => void;
  disabled?: boolean;
}
export default function DialogueBox({
  speaker,
  message,
  animal,
  friendship = 0,
  choices,
  onClose,
}: {
  speaker: string;
  message: string;
  animal?: string;
  friendship?: number;
  choices?: DialogueChoice[];
  onClose: () => void;
}) {
  const [letters, setLetters] = useState(0);
  const [choiceIndex, setChoiceIndex] = useState(0);
  useEffect(() => {
    setLetters(0);
    setChoiceIndex(0);
    const timer = setInterval(
      () =>
        setLetters((n) => {
          if (n >= message.length) {
            clearInterval(timer);
            return n;
          }
          return n + 2;
        }),
      25,
    );
    return () => clearInterval(timer);
  }, [message]);
  const done = letters >= message.length;
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (
        ["ArrowUp", "ArrowDown"].includes(event.key) &&
        done &&
        choices?.length
      ) {
        event.preventDefault();
        setChoiceIndex(
          (index) =>
            (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) %
            choices.length,
        );
        return;
      }
      if (
        event.key.toLowerCase() === "e" ||
        event.code === "Space" ||
        event.key === "Enter"
      ) {
        event.preventDefault();
        if (!done) setLetters(message.length);
        else if (choices?.length) {
          const choice = choices[choiceIndex] ?? choices[0];
          if (!choice.disabled) choice.action();
        } else onClose();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [done, message, choices, choiceIndex, onClose]);
  return (
    <div
      className="conversation-screen"
      role="dialog"
      aria-modal="true"
      aria-label={`Conversation with ${speaker}`}
    >
      <div className="conversation-character">
        {animal && <Avatar animal={animal} />}
      </div>
      <div
        className="speech-bubble"
        onClick={() => {
          if (!done) setLetters(message.length);
        }}
      >
        <div className="speaker-label">
          {speaker}
          {friendship > 0 && (
            <span className="friendship-hearts">
              {Array.from({ length: 5 }, (_, i) => (
                <Heart
                  key={i}
                  size={11}
                  fill={friendship > i * 4 ? "currentColor" : "none"}
                />
              ))}
            </span>
          )}
        </div>
        <p aria-live="polite">
          {message.slice(0, letters)}
          <span className="untyped">{message.slice(letters)}</span>
        </p>
        {done ? (
          <button
            className="speech-next"
            onClick={onClose}
            aria-label="Close conversation"
          >
            <ChevronDown size={24} />
          </button>
        ) : (
          <button
            className="speech-skip"
            onClick={() => setLetters(message.length)}
          >
            Continue <kbd>E</kbd>
          </button>
        )}
      </div>
      {done && choices && (
        <div className="conversation-choices">
          {choices.map((choice, i) => (
            <button
              key={i}
              className={choiceIndex === i ? "highlighted" : ""}
              onMouseEnter={() => setChoiceIndex(i)}
              onFocus={() => setChoiceIndex(i)}
              onClick={choice.action}
              disabled={choice.disabled}
            >
              <span>›</span>
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
