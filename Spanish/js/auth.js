// js/auth.js

// 导入 Supabase 实例
import { supabase } from './config.js';

/**
 * 初始化登录和注册表单的事件监听器。
 */
function initializeAuthForms() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
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
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const passwordConfirm = document.getElementById('signup-password-confirm').value;

            if (password !== passwordConfirm) {
                errorMessage.textContent = '两次输入的密码不匹配！';
                return;
            }

            const { data, error } = await supabase.auth.signUp({ email, password });

            if (error) {
                errorMessage.textContent = `注册失败: ${error.message}`;
            } else {
                alert('注册成功！请检查您的邮箱以完成验证，然后登录。');
                window.location.href = 'login.html';
            }
        });
    }
}

/**
 * 检查用户是否已登录，如果未登录则重定向到登录页面。
 * @returns {Promise<object|null>} 当前登录的用户对象。
 */
const protectPage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
};

/**
 * 处理用户登出操作。
 */
const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
};

/**
 * 为页面上的登出按钮添加事件监听器。
 */
function initializeLogoutButton() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleSignOut();
        });
    }
}

// 导出需要被其他模块使用的函数
export { protectPage, handleSignOut, initializeAuthForms, initializeLogoutButton };