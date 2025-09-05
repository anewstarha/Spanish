import { supabase } from './config.js';

const loginForm = document.getElementById('login-form');
    
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorMessage = document.getElementById('error-message');
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            errorMessage.textContent = `登录失败: ${error.message}`;
        } else {
            window.location.href = 'index.html';
        }
    });
}