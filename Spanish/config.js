// =================================================
//  项目配置文件 (Single Source of Truth)
// =================================================

// Supabase 连接信息
const SUPABASE_URL = 'https://rvarfascuwvponxwdeoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2YXJmYXNjdXd2cG9ueHdkZW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNDE5MDcsImV4cCI6MjA3MTgxNzkwN30.KdBVtNYdOw9n8351FWlAgAPCv0WmSnr9vOGgtHCRSnc';

// 从全局 supabase 对象创建客户端实例
// 我们将把它挂载到 window 对象上，方便所有脚本共享同一个客户端实例
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);