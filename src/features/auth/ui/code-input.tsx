import { forwardRef } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { TOTP_CODE_LENGTH } from "../domain/schemas";

type CodeInputProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * The 6-digit code field (an authenticator app's TOTP, or an emailed code), on `ui/input-otp`.
 * Digits only; the phone shows the numeric keypad and offers a code from SMS/email autofill.
 * Spread `<FormField>`'s field props onto it.
 */
export const CodeInput = forwardRef<HTMLInputElement, CodeInputProps>(function CodeInput({ value, onChange, ...props }, ref) {
  return (
    <InputOTP
      ref={ref}
      maxLength={TOTP_CODE_LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      value={value ?? ""}
      onChange={onChange}
      {...props}
    >
      <InputOTPGroup>
        {Array.from({ length: TOTP_CODE_LENGTH }, (_, index) => (
          <InputOTPSlot key={index} index={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
});
