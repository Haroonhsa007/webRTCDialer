"use client";

import { useFormState, useFormStatus } from 'react-dom';
import { login, type LoginState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const initialState: LoginState = { message: null, errors: {} };
  const [state, dispatch] = useFormState(login, initialState);
  
  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary h-12 w-12">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </div>
        <CardTitle className="text-3xl font-bold text-center font-headline">WebRTC Talk</CardTitle>
        <CardDescription className="text-center">Sign in with your Telnyx credentials.</CardDescription>
      </CardHeader>
      <form action={dispatch}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input 
              id="username" 
              name="username" 
              type="text" 
              placeholder="Enter your username" 
              required 
              aria-describedby="username-error"
            />
            {state.errors?.username && (
              <div id="username-error" className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} /> {state.errors.username.join(', ')}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              placeholder="Enter your password" 
              required 
              aria-describedby="password-error"
            />
            {state.errors?.password && (
              <div id="password-error" className="text-sm text-destructive flex items-center gap-1">
                 <AlertCircle size={14} /> {state.errors.password.join(', ')}
              </div>
            )}
          </div>
          {state.errors?.general && (
            <div id="general-error" aria-live="polite" className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle size={14} /> {state.errors.general.join(', ')}
            </div>
          )}
           {state.message && !state.errors?.general && (
            <div aria-live="polite" className="text-sm text-destructive">
              {state.message}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <LoginButton />
        </CardFooter>
      </form>
    </Card>
  );
}

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" aria-disabled={pending} disabled={pending}>
      {pending ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground"></div>
      ) : (
        <>
          <LogIn className="mr-2 h-5 w-5" /> Sign In
        </>
      )}
    </Button>
  );
}
