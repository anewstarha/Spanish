// js/auth.js

// 导入 Supabase 实例
import { supabase } from './config.js';

/**
 * 初始化登录和注册表单的事件监听器。
 */
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
 * 为页面上的登出按钮添加事件监听器。(旧版函数，为兼容性保留)
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

/**
 * 初始化页面的动态导航栏，显示用户昵称。
 * @param {object} user - 当前登录的用户对象。
 */
async function initializeHeader(user) {
    const profileLink = document.getElementById('profile-link');
    if (!profileLink || !user) return;

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('获取用户昵称失败:', error);
    } else if (profile) {
        profileLink.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            你好, ${profile.nickname}
        `;
    }
}

// 确保这是文件中唯一的 export 语句
export { protectPage, handleSignOut, initializeAuthForms, initializeLogoutButton, initializeHeader };