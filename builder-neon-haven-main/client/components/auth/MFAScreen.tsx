import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface MFAScreenProps {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export default function MFAScreen({ email, onVerify, onCancel, isLoading = false, error = "" }: MFAScreenProps) {
  const [mfaCode, setMfaCode] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    // Keep only the last character if multiple were pasted
    const digit = value.slice(-1);
    const newCode = mfaCode.split("");
    newCode[index] = digit;
    const codeString = newCode.join("");
    setMfaCode(codeString);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!mfaCode[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      const newCode = mfaCode.split("");
      newCode[index] = "";
      setMfaCode(newCode.join(""));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text");
    const digits = paste.replace(/\D/g, "").slice(0, 6);
    setMfaCode(digits);
    if (digits.length === 6) {
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length === 6) {
      await onVerify(mfaCode);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 mx-auto mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center text-white">Verify Your Identity</CardTitle>
          <CardDescription className="text-center text-white/80">
            Enter the 6-digit code sent to {email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium block text-white">Authentication Code</label>
              <div className="flex gap-2 justify-center">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={mfaCode[index] || ""}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleBackspace(index, e)}
                    onPaste={handlePaste}
                    disabled={isLoading}
                    className="w-12 h-12 text-center text-lg font-semibold text-foreground"
                    placeholder="•"
                  />
                ))}
              </div>
              <p className="text-xs text-white/60 text-center mt-2">
                Enter 6-digit code or paste from authenticator app
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || mfaCode.length !== 6}
            >
              {isLoading ? "Verifying..." : "Verify"}
            </Button>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full" 
              onClick={onCancel}
              disabled={isLoading}
            >
              Use Another Method
            </Button>

            <p className="text-center text-xs text-white/60">
              Don't have a code? Check your authenticator app or email
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
