// js/index-main.js

import { supabase } from './config.js';
import { protectPage, initializeLogoutButton } from './auth.js';
import { showCustomConfirm, readText, generateAndUpdateHighFrequencyWords } from './utils.js';

let currentUser = null;
let allSentences = [];
let wordTranslationMap = new Map();
let currentFilteredSentences = [];
let currentIndex = 0;
let currentStatusFilter = 'unmastered';
let currentSortOrder = 'sequential';
let isSingleSentenceMode = false;

const dom = {
    statusFilterGroup: document.getElementById('status-filter-group'),
    sortOrderGroup: document.getElementById('sort-order-group'),
    sentenceCardContainer: document.getElementById('sentence-card-container'),
    sentenceCard: document.getElementById('sentence-card'),
    emptyMessage: document.getElementById('empty-message'),
    spanishText: document.querySelector('#sentence-card .spanish'),
    chineseText: document.querySelector('#sentence-card .chinese'),
    readBtn: document.getElementById('index-read-btn'),
    slowReadBtn: document.getElementById('index-slow-read-btn'),
    wordReadBtn: document.getElementById('index-word-read-btn'),
    aiExplainBtn: document.getElementById('index-ai-explain-btn'),
    masteredToggle: document.getElementById('mastered-toggle'),
    addSentenceLink: document.getElementById('add-sentence-link'),
    editSentenceLink: document.getElementById('edit-sentence-link'),
    deleteSentenceLink: document.getElementById('delete-sentence-link'),
    addSentenceModal: document.getElementById('addSentenceModal'),
    editSentenceModal: document.getElementById('editSentenceModal'),
    aiExplanationModal: document.getElementById('aiExplanationModal'),
    aiExplanationTitle: document.getElementById('aiExplanationTitle'),
    aiExplanationContent: document.getElementById('aiExplanationContent'),
    aiExplanationCloseBtn: document.getElementById('aiExplanationCloseBtn'),
    addSentenceForm: document.getElementById('add-sentence-form'),
    editSentenceForm: document.getElementById('edit-sentence-form'),
    cancelAddBtn: document.getElementById('cancel-add-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    newSpanishText: document.getElementById('new-spanish-text'),
    newChineseText: document.getElementById('new-chinese-text'),
    editSentenceId: document.getElementById('edit-sentence-id'),
    editSpanishText: document.getElementById('edit-spanish-text'),
    editChineseText: document.getElementById('edit-chinese-text'),
};

async function fetchInitialData() {
    const { data: sentencesData, error: sentencesError } = await supabase
        .from('sentences')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('id', { ascending: true });
    if (sentencesError) throw sentencesError;
    allSentences = sentencesData || [];

    const { data: wordsData, error: wordsError } = await supabase
        .from('high_frequency_words')
        .select('spanish_word, chinese_translation')
        .eq('user_id', currentUser.id);
    if (wordsError) throw wordsError;
    wordTranslationMap.clear();
    (wordsData || []).forEach(word => {
        if(word.chinese_translation) {
            wordTranslationMap.set(word.spanish_word, word.chinese_translation)
        }
    });
}

function renderSentenceCard() {
    if (!dom.sentenceCardContainer) return;
    if (currentFilteredSentences.length === 0) {
        dom.sentenceCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (currentStatusFilter === 'mastered') dom.emptyMessage.innerText = '您还没有掌握任何句子！';
        else if (currentStatusFilter === 'unmastered' && allSentences.length > 0) dom.emptyMessage.innerText = '恭喜！所有句子都已掌握。';
        else dom.emptyMessage.innerText = '您的句子列表为空，请在“管理”页面添加新句子。';
        return;
    }
    dom.sentenceCardContainer.style.display = 'flex';
    dom.emptyMessage.style.display = 'none';
    const currentSentence = currentFilteredSentences[currentIndex];
    const sentenceText = currentSentence.spanish_text;
    const tokens = sentenceText.split(/([,;!?."\s¿¡—:-])/);
    const punctuationRegex = /[.,;!?()"\-—:¿¡]/g;
    const htmlParts = tokens.map(token => {
        const cleanToken = token.toLowerCase().replace(punctuationRegex, '').trim();
        if (wordTranslationMap.has(cleanToken)) {
            const translation = wordTranslationMap.get(cleanToken);
            return `<span class="highlight-word" data-word="${cleanToken}" title="${translation}">${token}</span>`;
        }
        return `<span>${token}</span>`;
    });
    dom.spanishText.innerHTML = htmlParts.join('');
    dom.chineseText.innerText = currentSentence.chinese_translation;
    dom.masteredToggle.classList.toggle('mastered', currentSentence.mastered);
}

function filterAndSortSentences() {
    if (currentSortOrder === 'single') {
        isSingleSentenceMode = true;
        const singleSentence = currentFilteredSentences[currentIndex] || allSentences[0];
        currentFilteredSentences = singleSentence ? [singleSentence] : [];
        currentIndex = 0;
        if(dom.sentenceCard) dom.sentenceCard.classList.add('is-locked');
    } else {
        isSingleSentenceMode = false;
        if(dom.sentenceCard) dom.sentenceCard.classList.remove('is-locked');
        let filtered = allSentences;
        if (currentStatusFilter === 'unmastered') {
            filtered = allSentences.filter(s => !s.mastered);
        } else if (currentStatusFilter === 'mastered') {
            filtered = allSentences.filter(s => s.mastered);
        }
        if (currentSortOrder === 'random') {
            currentFilteredSentences = [...filtered].sort(() => Math.random() - 0.5);
        } else {
            currentFilteredSentences = filtered;
        }
    }
    renderSentenceCard();
}

async function updateLastStudiedSentence(sentenceId) {
    if (!sentenceId || !currentUser) return;
    await supabase
        .from('profiles')
        .update({ last_sentence_id: sentenceId, updated_at: new Date() })
        .eq('id', currentUser.id);
}

async function toggleMasteredStatus() {
    if (currentFilteredSentences.length === 0 || !currentUser) return;
    const currentSentence = currentFilteredSentences[currentIndex];
    const newStatus = !currentSentence.mastered;
    const { error } = await supabase
        .from('sentences')
        .update({ mastered: newStatus })
        .eq('id', currentSentence.id)
        .eq('user_id', currentUser.id);
    if (error) {
        console.error('更新掌握状态失败:', error);
        await showCustomConfirm("状态更新失败！请检查 RLS 策略或网络连接。");
    } else {
        currentSentence.mastered = newStatus;
        renderSentenceCard();
    }
}

async function deleteCurrentSentence() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToDelete = currentFilteredSentences[currentIndex];
    const confirmation = await showCustomConfirm(`确定要删除这个句子吗？\n"${sentenceToDelete.spanish_text}"`);
    if (confirmation) {
        const { error } = await supabase.from('sentences').delete().eq('id', sentenceToDelete.id).eq('user_id', currentUser.id);
        if (error) {
            await showCustomConfirm('删除失败，请检查网络或刷新页面。');
        } else {
            await showCustomConfirm('删除成功！', false);
            setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
            await fetchInitialData();
            await generateAndUpdateHighFrequencyWords(currentUser.id);
            currentIndex = 0; // 重置索引
            filterAndSortSentences();
        }
    }
}

async function handleAddSentence(event) {
    event.preventDefault();
    const spanishText = dom.newSpanishText.value.trim();
    const chineseText = dom.newChineseText.value.trim();
    if (!spanishText || !chineseText) {
        await showCustomConfirm('西班牙语和中文翻译均不能为空！');
        return;
    }
    const { error } = await supabase.from('sentences').insert([{ spanish_text: spanishText, chinese_translation: chineseText, user_id: currentUser.id }]);
    if (error) {
        await showCustomConfirm(`添加失败: ${error.message}`);
    } else {
        dom.addSentenceModal.style.display = 'none';
        dom.addSentenceForm.reset();
        await showCustomConfirm('添加成功！', false);
        setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
        await fetchInitialData();
        await generateAndUpdateHighFrequencyWords(currentUser.id);
        currentIndex = 0;
        filterAndSortSentences();
    }
}

function openEditModal() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToEdit = currentFilteredSentences[currentIndex];
    dom.editSentenceId.value = sentenceToEdit.id;
    dom.editSpanishText.value = sentenceToEdit.spanish_text;
    dom.editChineseText.value = sentenceToEdit.chinese_translation;
    dom.editSentenceModal.style.display = 'flex';
}

async function handleEditSentence(event) {
    event.preventDefault();
    const id = dom.editSentenceId.value;
    const spanishText = dom.editSpanishText.value.trim();
    const chineseText = dom.editChineseText.value.trim();
    if (!spanishText || !chineseText) {
        await showCustomConfirm('西班牙语和中文翻译均不能为空！');
        return;
    }
    const { error } = await supabase.from('sentences').update({ spanish_text: spanishText, chinese_translation: chineseText, ai_notes: null }).eq('id', id).eq('user_id', currentUser.id);
    if (error) {
        await showCustomConfirm(`更新失败: ${error.message}`);
    } else {
        dom.editSentenceModal.style.display = 'none';
        dom.editSentenceForm.reset();
        await showCustomConfirm('更新成功！', false);
        setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
        await fetchInitialData();
        await generateAndUpdateHighFrequencyWords(currentUser.id);
        filterAndSortSentences();
    }
}

async function getAiExplanation() {
    if (currentFilteredSentences.length === 0) return;
    const currentSentence = currentFilteredSentences[currentIndex];
    dom.aiExplanationTitle.innerText = `“${currentSentence.spanish_text}”`;
    dom.aiExplanationModal.style.display = 'flex';
    if (currentSentence.ai_notes) {
        dom.aiExplanationContent.innerHTML = `<p>${currentSentence.ai_notes.replace(/\n/g, '<br>')}</p>`;
        return;
    }
    const EXPLAIN_URL = 'https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence';
    dom.aiExplanationContent.innerHTML = `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成解释，请稍候...</p>`;
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error("用户未认证，无法使用AI功能。");

        const response = await fetch(EXPLAIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ sentence: currentSentence.spanish_text, getExplanation: true })
        });
        if (!response.ok) throw new Error(`AI 服务错误 (${response.status}): ${await response.text()}`);
        
        const result = await response.json();
        const explanation = result.explanation || '未能获取 AI 解释。';
        const { error } = await supabase.from('sentences').update({ ai_notes: explanation }).eq('id', currentSentence.id);
        if (!error) currentSentence.ai_notes = explanation;
        dom.aiExplanationContent.innerHTML = `<p>${explanation.replace(/\n/g, '<br>')}</p>`;
    } catch (error) {
        console.error('获取 AI 解释失败:', error);
        dom.aiExplanationContent.innerHTML = `<p>无法连接到 AI 服务。错误详情: ${error.message}</p>`;
    }
}

async function readWordByWord() {
    const sentence = currentFilteredSentences[currentIndex]?.spanish_text;
    if (!sentence) return;
    const words = sentence.split(/\s+/).filter(word => word.length > 0);
    dom.wordReadBtn.classList.add('playing');
    try {
        for (const word of words) {
            await readText(word);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    } finally {
        dom.wordReadBtn.classList.remove('playing');
    }
}

function setupEventListeners() {
    dom.statusFilterGroup?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
            currentStatusFilter = e.target.dataset.value;
            dom.statusFilterGroup.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            currentIndex = 0; // 切换筛选时重置索引
            filterAndSortSentences();
        }
    });

    dom.sortOrderGroup?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
            currentSortOrder = e.target.dataset.value;
            dom.sortOrderGroup.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            currentIndex = 0; // 切换排序时重置索引
            filterAndSortSentences();
        }
    });

    dom.sentenceCard?.addEventListener('click', async (event) => {
        if (isSingleSentenceMode || event.target.closest('button') || event.target.classList.contains('highlight-word') || event.target.closest('.card-footer')) {
            return;
        }
        if (currentFilteredSentences.length === 0) return;
        const rect = dom.sentenceCard.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        if (event.clientX < midpoint) {
            currentIndex = (currentIndex > 0) ? currentIndex - 1 : currentFilteredSentences.length - 1;
        } else {
            currentIndex = (currentIndex < currentFilteredSentences.length - 1) ? currentIndex + 1 : 0;
        }
        renderSentenceCard();
        const currentSentence = currentFilteredSentences[currentIndex];
        if (currentSentence) {
            await updateLastStudiedSentence(currentSentence.id);
        }
    });

    dom.spanishText?.addEventListener('click', (event) => {
        if (event.target.classList.contains('highlight-word')) {
            event.stopPropagation();
            readText(event.target.dataset.word, false, event.target);
        }
    });

    dom.readBtn?.addEventListener('click', () => readText(currentFilteredSentences[currentIndex]?.spanish_text, false, dom.readBtn));
    dom.slowReadBtn?.addEventListener('click', () => readText(currentFilteredSentences[currentIndex]?.spanish_text, true, dom.slowReadBtn));
    dom.wordReadBtn?.addEventListener('click', readWordByWord);
    dom.aiExplainBtn?.addEventListener('click', getAiExplanation);
    dom.masteredToggle?.addEventListener('click', (e) => { e.stopPropagation(); toggleMasteredStatus(); });
    dom.addSentenceLink?.addEventListener('click', () => dom.addSentenceModal.style.display = 'flex');
    dom.editSentenceLink?.addEventListener('click', openEditModal);
    dom.deleteSentenceLink?.addEventListener('click', deleteCurrentSentence);
    dom.cancelAddBtn?.addEventListener('click', () => dom.addSentenceModal.style.display = 'none');
    dom.cancelEditBtn?.addEventListener('click', () => dom.editSentenceModal.style.display = 'none');
    dom.addSentenceForm?.addEventListener('submit', handleAddSentence);
    dom.editSentenceForm?.addEventListener('submit', handleEditSentence);
    dom.aiExplanationCloseBtn?.addEventListener('click', () => dom.aiExplanationModal.style.display = 'none');
}

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    initializeLogoutButton();
    dom.emptyMessage.style.display = 'flex';
    dom.emptyMessage.innerText = '加载中...';

    try {
        await fetchInitialData();
        const { data: profile } = await supabase.from('profiles').select('last_sentence_id').eq('id', currentUser.id).single();
        
        const targetSentenceIdFromSession = sessionStorage.getItem('targetSentenceId');
        sessionStorage.removeItem('targetSentenceId');
        const targetId = targetSentenceIdFromSession || profile?.last_sentence_id;

        // === 核心改动 (修复“断点续学”逻辑) ===
        // 1. 先按默认的 'unmastered' 筛选一次
        filterAndSortSentences();

        if (targetId) {
            const lastStudiedSentence = allSentences.find(s => s.id == targetId);
            
            // 2. 检查上次学习的句子是否是"已掌握"，并且当前筛选是"未掌握"
            if (lastStudiedSentence && lastStudiedSentence.mastered && currentStatusFilter === 'unmastered') {
                console.log("上次学习的句子已掌握，自动切换到'所有'筛选模式。");
                // 智能切换筛选条件
                currentStatusFilter = 'all';
                // 更新UI显示
                dom.statusFilterGroup.querySelector('[data-value="unmastered"]')?.classList.remove('active');
                dom.statusFilterGroup.querySelector('[data-value="all"]')?.classList.add('active');
                // 再次筛选
                filterAndSortSentences();
            }

            // 3. 在当前筛选好的列表 (currentFilteredSentences) 中寻找位置
            const targetIndex = currentFilteredSentences.findIndex(s => s.id == targetId);

            if (targetIndex !== -1) {
                currentIndex = targetIndex;
                renderSentenceCard(); // 找到后重新渲染一次卡片
            } else {
                currentIndex = 0; // 如果找不到（比如被删除了），就从头开始
            }
        } else {
            currentIndex = 0;
        }
        // ===================================
        
        setupEventListeners();

    } catch (error) {
        console.error("初始化页面失败:", error);
        if (error.message.includes("JSON object requested, multiple (or no) rows returned")) {
             dom.emptyMessage.innerText = `加载用户数据失败，请确保 profiles 表中有您的记录。错误: ${error.message}`;
        } else {
             dom.emptyMessage.innerText = `加载数据时发生错误: ${error.message}`;
        }
    }
}

initializePage();