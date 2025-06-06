"use server";

import { redirect } from 'next/navigation';
import { z } from 'zod';

const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = {
  errors?: {
    username?: string[];
    password?: string[];
    general?: string[];
  };
  message?: string | null;
};

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validatedFields = LoginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid credentials.',
    };
  }

  const { username, password } = validatedFields.data;

  // Mock Telnyx authentication
  // In a real app, you would integrate with Telnyx API/SDK here
  console.log(`Attempting login for user: ${username}`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (username === "testuser" && password === "password123") {
    // For demo purposes, we're not setting up actual sessions.
    // We'll just redirect. In a real app, set up session/cookie here.
  } else {
    return {
      errors: { general: ["Invalid username or password."] },
      message: "Login failed.",
    };
  }
  
  redirect('/'); 
  // Note: redirect() must be called outside of a try/catch block.
  // If it's inside and an error occurs before redirect, it might not work as expected.
  // Since we are redirecting, the return type of LoginState might not be fully utilized here for the success case.
  // This is fine as redirect throws a NEXT_REDIRECT error.
}

export async function logout() {
  // In a real app, clear session/cookie here
  console.log("User logged out");
  redirect('/login');
}
