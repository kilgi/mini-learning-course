const SUPABASE_URL = "https://cdwxkittegibajvlnkvw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkd3hraXR0ZWdpYmFqdmxua3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMjg3NzcsImV4cCI6MjEwNjcwNDc3N30.CyYsbDkxNIwql2qiaDoc1BxGjI416nKsSi3WjcC7iNo";
const supabaseClient =
	SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient
		? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
		: null;