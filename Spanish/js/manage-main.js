// js/manage-main.js

import { supabase } from './config.js';
import { protectPage, initializeLogoutButton } from './auth.js';
import { showCustomConfirm, generateAndUpdateHighFrequencyWords } from './utils.js';

let currentUser = null;
let allSentences = [];

const dom = {
    batchInput: document.getElementById('batch-input'),
    addBatchBtn: document.getElementById('add-batch-button'),
    sentenceList: document.getElementById('sentence-list'),
    sentenceSearch: document.getElementById('sentence-search'),
};

async function fetchSentences() {
    const { data, error } = await supabase.from('sentences').select('*').eq('user_id', currentUser.id).order('id', { ascending: true });
    if (error) {
        console.error('获取句子失败:', error);
        dom.sentenceList.innerHTML = `<p class="empty-list-message">加载句子列表失败。</p>`;
        return;
    }
    allSentences = data || [];
    renderManageSentences(allSentences);
}

function renderManageSentences(sentencesToRender) {
    if (!dom.sentenceList) return;
    dom.sentenceList.innerHTML = '';
    if ((sentencesToRender || []).length === 0) {
        dom.sentenceList.innerHTML = `<p class="empty-list-message">您的句子列表为空，请在左侧添加。</p>`;
        return;
    }
    sentencesToRender.forEach(sentence => {
        const li = document.createElement('li');
        li.className = 'sentence-item';
        li.dataset.id = sentence.id;
        li.innerHTML = `
            <div class="sentence-text">
                <span class="spanish">${sentence.spanish_text}</span>
                <span class="chinese">${sentence.chinese_translation}</span>
            </div>
        `;
        li.addEventListener('click', () => {
            sessionStorage.setItem('targetSentenceId', sentence.id);
            window.location.href = 'index.html';
        });
        dom.sentenceList.appendChild(li);
    });
}

async function addSentencesInBatch() {
    if (dom.addBatchBtn.classList.contains('loading')) return;
    const lines = dom.batchInput.value.trim().split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) {
        await showCustomConfirm('输入内容不能为空！');
        return;
    }
    dom.addBatchBtn.classList.add('loading');
    dom.addBatchBtn.disabled = true;
    try {
        const { data: existing, error: fetchError } = await supabase.from('sentences').select('spanish_text').eq('user_id', currentUser.id);
        if (fetchError) throw fetchError;
        const existingSet = new Set(existing.map(s => s.spanish_text));
        const toAdd = lines.map(line => ({ spanish_text: line.trim() })).filter(s => !existingSet.has(s.spanish_text));
        const duplicateCount = lines.length - toAdd.length;
        if (toAdd.length === 0) {
            await showCustomConfirm(`没有新的句子可添加。发现 ${duplicateCount} 个重复句子。`);
            return;
        }

        const TRANSLATE_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence';
        
        // === 核心改动 (修复 406 错误)：获取 session 并加入请求头 ===
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            throw new Error("用户未登录或会话已过期，请重新登录。");
        }
        // =======================================================

        const payload = { sentences: toAdd, getTranslation: true };
        const response = await fetch(TRANSLATE_URL, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${session.access_token}` 
            }, 
            body: JSON.stringify(payload) 
        });
        if (!response.ok) throw new Error(`翻译服务出错 (${response.status}): ${await response.text()}`);

        const { translatedSentences } = await response.json();
        const sentencesWithUserId = translatedSentences.map(s => ({ ...s, user_id: currentUser.id }));
        const { error: insertError } = await supabase.from('sentences').insert(sentencesWithUserId);
        if (insertError) throw insertError;
        dom.batchInput.value = '';
        let message = `成功添加 ${sentencesWithUserId.length} 个句子。`;
        if (duplicateCount > 0) message += ` 忽略了 ${duplicateCount} 个重复句子。`;
        await showCustomConfirm(message, false);
        setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1500);
        await fetchSentences();
        await generateAndUpdateHighFrequencyWords(currentUser.id);
    } catch (error) {
        console.error('批量添加失败:', error);
        await showCustomConfirm(`批量添加失败: ${error.message}`);
    } finally {
        dom.addBatchBtn.classList.remove('loading');
        dom.addBatchBtn.disabled = false;
    }
}

function liveSearch() {
    const searchTerm = dom.sentenceSearch.value.toLowerCase();
    const filtered = allSentences.filter(s =>
        s.spanish_text.toLowerCase().includes(searchTerm) ||
        (s.chinese_translation && s.chinese_translation.toLowerCase().includes(searchTerm))
    );
    renderManageSentences(filtered);
}

function setupEventListeners() {
    dom.addBatchBtn?.addEventListener('click', addSentencesInBatch);
    dom.sentenceSearch?.addEventListener('input', liveSearch);
}

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    initializeLogoutButton();
    await fetchSentences();
    setupEventListeners();
}

initializePage();