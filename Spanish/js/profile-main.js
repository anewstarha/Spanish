// js/profile-main.js

import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
// 【修改】导入新函数
import { initializeDropdowns } from './utils.js';

let currentUser = null;

const dom = {
    profileForm: document.getElementById('profile-form'),
    emailInput: document.getElementById('profile-email'),
    nicknameInput: document.getElementById('profile-nickname'),
    messageText: document.getElementById('message-text'),
    // 【修改】移除了旧的 logout-button-profile
};

async function loadUserProfile() {
    dom.emailInput.value = currentUser.email;
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', currentUser.id)
        .single();
    if (error) {
        console.error('获取用户信息失败:', error);
        dom.messageText.style.color = 'var(--danger-color)';
        dom.messageText.textContent = `加载用户信息失败: ${error.message}`;
    } else if (profile) {
        dom.nicknameInput.value = profile.nickname;
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    const newNickname = dom.nicknameInput.value.trim();
    if (newNickname.length < 2) {
        dom.messageText.style.color = 'var(--danger-color)';
        dom.messageText.textContent = '昵称长度至少为2个字符。';
        return;
    }
    const { error } = await supabase
        .from('profiles')
        .update({ nickname: newNickname, updated_at: new Date() })
        .eq('id', currentUser.id);
    if (error) {
        dom.messageText.style.color = 'var(--danger-color)';
        dom.messageText.textContent = `更新失败: ${error.message}`;
    } else {
        dom.messageText.style.color = 'var(--success-color)';
        dom.messageText.textContent = '更新成功！';
        // 重新初始化头部以显示新昵称
        await initializeHeader(currentUser);
        setTimeout(() => { dom.messageText.textContent = ''; }, 1500);
    }
}

function setupEventListeners() {
    dom.profileForm.addEventListener('submit', handleProfileUpdate);
    // 【修改】移除了旧的 logoutButton 事件监听
}

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    
    await initializeHeader(currentUser);
    await loadUserProfile();
    setupEventListeners();
    initializeDropdowns(); // 【修改】激活新头部菜单功能
}

initializePage();