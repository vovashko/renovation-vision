import { forwardRef } from "react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { Icon } from "@/components/ui/icon";

/** Pinned message composer: an optional attachment preview, attach and send buttons. */
export const ChatComposer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    onAttach: () => void;
    placeholder: string;
    disabled?: boolean;
    attachment?: { name: string; onRemove: () => void };
  }
>(function ChatComposer({ value, onChange, onSend, onAttach, placeholder, disabled, attachment }, ref) {
  return (
    <div className="p-4 pt-2">
      <InputGroup>
        {attachment && (
          <InputGroupAddon align="block-start" className="justify-between">
            <InputGroupText className="min-w-0 truncate">{attachment.name}</InputGroupText>
            <InputGroupButton type="button" onClick={attachment.onRemove} aria-label="Remove attachment">
              <Icon name="close" size={18} />
            </InputGroupButton>
          </InputGroupAddon>
        )}
        <InputGroupAddon align="inline-start">
          <InputGroupButton type="button" onClick={onAttach} aria-label="Attach">
            <Icon name="attach_file" size={20} />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupTextarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            onSend();
          }}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton type="button" variant="default" onClick={onSend} disabled={disabled} aria-label="Send">
            <Icon name="send" size={20} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
});
