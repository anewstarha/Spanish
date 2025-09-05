import { supabase } from './config.js';

const signupForm = document.getElementById('signup-form');

if (signupForm) {
    signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorMessage = document.getElementById('error-message');

        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const passwordConfirm = document.getElementById('signup-password-confirm').value;
        const nickname = document.getElementById('signup-nickname').value.trim();

        if (password !== passwordConfirm) {
            errorMessage.textContent = '两次输入的密码不匹配！';
            return;
        }
        if (nickname.length < 2) {
            errorMessage.textContent = '昵称长度至少为2个字符。';
            return;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    nickname: nickname 
                }
            }
        });

        if (error) {
            errorMessage.textContent = `注册失败: ${error.message}`;
        } else {
            alert('注册成功！请检查您的邮箱以完成验证，然后登录。');
            window.location.href = 'login.html';
        }
    });
}