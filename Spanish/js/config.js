// js/config.js

// 从 CDN 导入 Supabase 客户端创建函数
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase 连接信息
const SUPABASE_URL = 'https://rvarfascuwvponxwdeoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2YXJmYXNjdXd2cG9ueHdkZW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyNDE5MDcsImV4cCI6MjA3MTgxNzkwN30.KdBVtNYdOw9n8351FWlAgAPCv0WmSnr9vOGgtHCRSnc';

// 创建并导出 Supabase 客户端实例，供其他模块使用
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);