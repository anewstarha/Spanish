// === DOM 元素获取 ===
// 注意：我们不再需要在这里初始化 Supabase，因为它已经在 config.js 中完成
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const errorMessage = document.getElementById('error-message');

// === 事件监听器 ===
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        // **修正点**: 使用 window.supabaseClient 访问全局客户端实例
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

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

        // **修正点**: 使用 window.supabaseClient 访问全局客户端实例
        const { error } = await window.supabaseClient.auth.signUp({ email, password });

        if (error) {
            errorMessage.textContent = `注册失败: ${error.message}`;
        } else {
            alert('注册成功！现在将跳转到登录页面。');
            window.location.href = 'login.html';
        }
    });
}

// === 页面保护与用户状态函数 ===
const protectPage = async () => {
    // **修正点**: 使用 window.supabaseClient 访问全局客户端实例
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
};

const handleSignOut = async () => {
    // **修正点**: 使用 window.supabaseClient 访问全局客户端实例
    await window.supabaseClient.auth.signOut();
    window.location.href = 'login.html';
};