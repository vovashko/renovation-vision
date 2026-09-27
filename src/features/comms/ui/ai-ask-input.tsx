import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Icon } from "@/components/ui/icon";

/** The AI tab's question field: an optional "clear chat" button, the question, and send. */
export function AiAskInput({
  value,
  onChange,
  onSubmit,
  onClear,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <form
      className="p-4 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <InputGroup>
        {onClear && (
          <InputGroupAddon align="inline-start">
            <InputGroupButton type="button" onClick={onClear} aria-label="Clear chat">
              <Icon name="delete" size={18} />
            </InputGroupButton>
          </InputGroupAddon>
        )}
        <InputGroupInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask about your project…"
          aria-label="Ask the AI assistant"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="submit" variant="default" disabled={disabled} aria-label="Send question">
            <Icon name="send" size={20} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
