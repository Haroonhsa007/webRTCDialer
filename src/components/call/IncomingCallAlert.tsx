"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneIncoming, PhoneOff, UserCircle } from "lucide-react";

interface IncomingCallAlertProps {
  callerNumber: string;
  callerName?: string;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallAlert({ callerNumber, callerName, onAnswer, onDecline }: IncomingCallAlertProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-2xl animate-in fade-in-0 zoom-in-95">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 rounded-full p-3 w-fit mb-3">
            <PhoneIncoming className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-headline">Incoming Call</CardTitle>
          {callerName && <CardDescription className="text-lg">{callerName}</CardDescription>}
          <CardDescription className={callerName ? "text-sm" : "text-lg"}>{callerNumber}</CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-around gap-3 pt-4">
          <Button
            variant="destructive"
            className="flex-1 text-lg py-6 transition-transform active:scale-95"
            onClick={onDecline}
            aria-label="Decline call"
          >
            <PhoneOff className="mr-2 h-5 w-5" /> Decline
          </Button>
          <Button
            className="flex-1 text-lg py-6 bg-accent hover:bg-accent/90 text-accent-foreground transition-transform active:scale-95"
            onClick={onAnswer}
            aria-label="Answer call"
          >
            <PhoneIncoming className="mr-2 h-5 w-5" /> Answer
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
