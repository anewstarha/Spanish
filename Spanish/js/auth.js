// js/auth.js

import { supabase } from './config.js';

const protectPage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
};

async function initializeHeader(user) {
    if (!user) return;

    const userMenuGreeting = document.getElementById('user-menu-greeting');
    const logoutButton = document.getElementById('logout-button');

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single();
    
    if (error) {
        console.error('获取用户昵称失败:', error);
        if(userMenuGreeting) userMenuGreeting.textContent = '你好, 用户';
    } else if (profile && userMenuGreeting) {
        userMenuGreeting.textContent = `你好, ${profile.nickname}`;
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        });
    }
}

function initializeAuthForms() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
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
}

export { protectPage, initializeHeader, initializeAuthForms };