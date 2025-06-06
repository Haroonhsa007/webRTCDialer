import { redirect } from 'next/navigation';

export default function HomePage() {
  // In a real app, you'd check auth status here
  // For now, we'll always redirect to login
  redirect('/login');
  return null; 
}
