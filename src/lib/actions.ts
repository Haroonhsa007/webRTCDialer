
"use server";

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { cookies } from 'next/headers';

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
      message: 'Invalid input.',
    };
  }

  const { username, password } = validatedFields.data;

  // Store credentials in cookies to be used by the Telnyx client on the dashboard
  // NB: For production, consider more secure ways to handle client-side credentials.
  cookies().set('telnyx_sip_username', username, { path: '/' });
  cookies().set('telnyx_sip_password', password, { path: '/' });

  console.log(`Login attempt with username: ${username}. Storing credentials in cookies and proceeding to dashboard.`);
  
  // Simulate API call delay if needed, or remove
  await new Promise(resolve => setTimeout(resolve, 250));

  redirect('/dashboard'); 
}

export async function logout() {
  // Clear the Telnyx credentials cookies
  cookies().delete('telnyx_sip_username');
  cookies().delete('telnyx_sip_password');
  
  console.log("User logged out, Telnyx credentials cookies cleared.");
  redirect('/login');
}

