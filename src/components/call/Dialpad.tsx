"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Grid, PhoneCall, Delete, XCircle, Asterisk,Hash } from "lucide-react";
import type { HTMLAttributes } from "react";

interface DialpadProps extends HTMLAttributes<HTMLDivElement> {
  currentNumber: string;
  onNumberChange: (number: string) => void;
  onMakeCall: (number: string) => void;
  disabled?: boolean;
}

export function Dialpad({ currentNumber, onNumberChange, onMakeCall, disabled = false, className, ...props }: DialpadProps) {
  const dialpadKeys = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    "*", "0", "#",
  ];

  const handleKeyPress = (key: string) => {
    onNumberChange(currentNumber + key);
  };

  const handleBackspace = () => {
    onNumberChange(currentNumber.slice(0, -1));
  };

  const handleClear = () => {
    onNumberChange("");
  };

  const handleSubmitCall = () => {
    if (currentNumber.trim()) {
      onMakeCall(currentNumber);
    }
  };

  return (
    <div className={`w-full max-w-xs mx-auto p-4 bg-card rounded-xl shadow-2xl ${className}`} {...props}>
      <div className="mb-4 relative">
        <Input
          type="tel"
          value={currentNumber}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="Enter phone number"
          className="text-center text-2xl py-6 pr-16 rounded-lg border-2 focus-visible:ring-primary focus-visible:ring-offset-0"
          aria-label="Phone number input"
          disabled={disabled}
        />
        {currentNumber.length > 0 && !disabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackspace}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 text-muted-foreground hover:text-foreground"
            aria-label="Backspace"
          >
            <Delete size={24} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {dialpadKeys.map((key) => (
          <Button
            key={key}
            variant="outline"
            className="h-16 text-2xl font-medium rounded-lg border-2 hover:bg-accent/10 active:bg-accent/20 transition-all duration-150 ease-in-out transform active:scale-95 shadow-sm"
            onClick={() => handleKeyPress(key)}
            disabled={disabled}
            aria-label={`Dial ${key === '*' ? 'star' : key === '#' ? 'hash' : key}`}
          >
            {key === '*' ? <Asterisk size={24} /> : key === '#' ? <Hash size={24} /> : key}
          </Button>
        ))}
      </div>

      <Button
        className="w-full h-16 text-xl bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg transition-all duration-150 ease-in-out transform active:scale-95 shadow-md"
        onClick={handleSubmitCall}
        disabled={disabled || !currentNumber.trim()}
        aria-label="Make call"
      >
        <PhoneCall size={24} className="mr-2" />
        Call
      </Button>
    </div>
  );
}
