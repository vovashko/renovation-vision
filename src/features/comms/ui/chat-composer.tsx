import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { Icon } from "@/components/ui/icon";
import { MAX_MESSAGE_LENGTH } from "@/features/comms/domain/schemas";

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
  const { t } = useTranslation("comms");
  return (
    <div className="p-4 pt-2">
      <InputGroup>
        {attachment && (
          <InputGroupAddon align="block-start" className="justify-between">
            <InputGroupText className="min-w-0 truncate">{attachment.name}</InputGroupText>
            <InputGroupButton type="button" onClick={attachment.onRemove} aria-label={t("chat.composer.removeAttachment")}>
              <Icon name="close" size={18} />
            </InputGroupButton>
          </InputGroupAddon>
        )}
        <InputGroupAddon align="inline-start">
          <InputGroupButton type="button" size="icon" onClick={onAttach} aria-label={t("chat.composer.attach")}>
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
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            variant="default"
            size="icon"
            onClick={onSend}
            disabled={disabled}
            aria-label={t("chat.composer.send")}
          >
            <Icon name="send" size={20} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
});
