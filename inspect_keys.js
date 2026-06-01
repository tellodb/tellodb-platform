import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://xckwepwibjohwnguulys.supabase.co"; // Replace with actual URL if different
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhja3dlcHdpYmpvaHduZ3V1bHlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTYyMzcxMjQsImV4cCI6MjAzMTgxMzEyNH0.xyz"; // Replace if needed

// I need the service role key to inspect all api keys
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.log("No service role key found. We'll try to find it in .env.local");
}
