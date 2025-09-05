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

export { protectPage, initializeHeader };