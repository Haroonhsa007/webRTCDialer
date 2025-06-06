
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
    general?: string[]; // Keep general for other potential errors
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
      message: 'Invalid input.', // More generic message as we are not checking credentials here
    };
  }

  const { username, password } = validatedFields.data;

  // Simulate some processing, but no actual credential check here for login gating.
  // The actual Telnyx connection attempt will use credentials on the dashboard page.
  console.log(`Login attempt with username: ${username}. Proceeding to dashboard.`);
  
  // Simulate API call delay if needed, or remove
  await new Promise(resolve => setTimeout(resolve, 500)); // Reduced delay

  // If Zod validation passes, redirect to dashboard.
  // The responsibility for correct Telnyx credentials now lies solely with their configuration
  // on the dashboard page itself.
  redirect('/dashboard'); 
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
