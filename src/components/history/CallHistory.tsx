"use client";

import type { CallLogEntry } from "@/types/call";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, History } from "lucide-react"; 

const CallTypeIcon = ({ type }: { type: CallLogEntry['type'] }) => {
  switch (type) {
    case 'incoming': return <PhoneIncoming className="h-5 w-5 text-green-500" />;
    case 'outgoing': return <PhoneOutgoing className="h-5 w-5 text-blue-500" />;
    case 'missed': return <PhoneMissed className="h-5 w-5 text-red-500" />; 
    default: return <History className="h-5 w-5 text-gray-500" />;
  }
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallHistory({ callLog }: { callLog: CallLogEntry[] }) {
  if (!callLog || callLog.length === 0) {
    return (
      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center font-headline flex items-center justify-center gap-2">
            <History size={24} /> Call History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No calls in history yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-center font-headline flex items-center justify-center gap-2">
          <History size={24} /> Call History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Number / Name</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLog.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="p-2">
                    <CallTypeIcon type={log.type} />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{log.cname || log.phoneNumber}</div>
                    {log.cname && <div className="text-xs text-muted-foreground">{log.phoneNumber}</div>}
                  </TableCell>
                  <TableCell className="text-right">{formatDuration(log.durationInSeconds)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {format(new Date(log.startTime), "PPp")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
