// js/study-main.js - The Final & Complete Unified Study Script

import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { showCustomConfirm, readText, generateAndUpdateHighFrequencyWords } from './utils.js';

// --- 1. State Management ---
let currentUser = null;
let currentStudyMode = 'sentences'; // 'sentences' or 'words'

// Sentence State
let allSentences = [];
let wordTranslationMap = new Map();
let currentFilteredSentences = [];
let sentenceIndex = 0;
let sentenceStatusFilter = 'unmastered';
let sentenceSortOrder = 'sequential';

// Word State
let allWords = [];
let currentFilteredWords = [];
let wordIndex = 0;
let wordStatusFilter = 'all';
let wordSortOrder = 'frequency';


// --- 2. DOM Elements ---
const dom = {
    studyModeSwitcher: document.getElementById('study-mode-switcher'),
    switcherPill: document.getElementById('switcher-pill'),
    actionsMenuBtn: document.getElementById('actions-menu-btn'),
    actionsPanel: document.getElementById('actions-panel'),
    sentenceFilters: document.getElementById('sentence-filters'),
    wordFilters: document.getElementById('word-filters'),
    emptyMessage: document.getElementById('empty-message'),
    sentenceCardContainer: document.getElementById('sentence-card-container'),
    sentenceCard: document.getElementById('sentence-card'),
    sentenceSpanishText: document.querySelector('#sentence-card .spanish'),
    sentenceChineseText: document.querySelector('#sentence-card .chinese'),
    masteredToggle: document.getElementById('mastered-toggle'),
    sentenceReadBtn: document.getElementById('index-read-btn'),
    sentenceSlowReadBtn: document.getElementById('index-slow-read-btn'),
    sentenceWordReadBtn: document.getElementById('index-word-read-btn'),
    sentenceAiExplainBtn: document.getElementById('index-ai-explain-btn'),
    addSentenceLink: document.getElementById('add-sentence-link'),
    editSentenceLink: document.getElementById('edit-sentence-link'),
    deleteSentenceLink: document.getElementById('delete-sentence-link'),
    wordCardContainer: document.getElementById('word-card-container'),
    wordCard: document.getElementById('word-card'),
    wordSpanishText: document.getElementById('word-text'),
    wordChineseText: document.querySelector('#word-card .chinese'),
    wordFrequencyBadge: document.getElementById('word-frequency-badge'),
    wordSourceSentence: document.querySelector('#word-card .source-sentence'),
    wordMasteredToggle: document.getElementById('word-mastered-toggle'),
    wordReadBtn: document.getElementById('word-read-btn'),
    wordSlowReadBtn: document.getElementById('word-slow-read-btn'),
    aiExplanationModal: document.getElementById('aiExplanationModal'),
    aiExplanationTitle: document.getElementById('aiExplanationTitle'),
    aiExplanationContent: document.getElementById('aiExplanationContent'),
    aiExplanationCloseBtn: document.getElementById('aiExplanationCloseBtn'),
    addSentenceModal: document.getElementById('addSentenceModal'),
    addSentenceForm: document.getElementById('add-sentence-form'),
    addSentenceTitle: document.getElementById('add-sentence-title'),
    addSpanishGroup: document.getElementById('add-spanish-group'),
    addChineseGroup: document.getElementById('add-chinese-group'),
    newSpanishText: document.getElementById('new-spanish-text'),
    newChineseText: document.getElementById('new-chinese-text'),
    addSentenceError: document.getElementById('add-sentence-error'),
    addSentenceSubmitBtn: document.getElementById('add-sentence-submit-btn'),
    cancelAddBtn: document.getElementById('cancel-add-btn'),
    editSentenceModal: document.getElementById('editSentenceModal'),
    editSentenceForm: document.getElementById('edit-sentence-form'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    editSentenceId: document.getElementById('edit-sentence-id'),
    editSpanishText: document.getElementById('edit-spanish-text'),
    editChineseText: document.getElementById('edit-chinese-text'),
    sentenceListModal: document.getElementById('sentenceListModal'),
    sentenceListTitle: document.getElementById('sentenceListTitle'),
    sentenceListContent: document.getElementById('sentence-list-content'),
    sentenceListCloseBtn: document.getElementById('sentenceListCloseBtn'),
    sentenceStatusFilterGroup: document.getElementById('status-filter-group'),
    sentenceSortOrderGroup: document.getElementById('sort-order-group'),
    wordStatusFilterGroup: document.getElementById('word-status-filter-group'),
    wordSortOrderGroup: document.getElementById('word-sort-order-group'),
};


// --- 3. Data Fetching ---
async function fetchInitialData() {
    dom.emptyMessage.textContent = '加载中...';
    const sentencePromise = supabase.from('sentences').select('*').eq('user_id', currentUser.id).order('id', { ascending: true });
    const wordPromise = supabase.from('high_frequency_words').select('*').eq('user_id', currentUser.id);
    const wordMapPromise = supabase.from('high_frequency_words').select('spanish_word, chinese_translation').eq('user_id', currentUser.id);

    const [
        { data: sentencesData, error: sentencesError }, 
        { data: wordsData, error: wordsError },
        { data: wordMapData, error: wordMapError }
    ] = await Promise.all([sentencePromise, wordPromise, wordMapPromise]);

    if (sentencesError || wordsError || wordMapError) {
        console.error('Data fetching error:', sentencesError || wordsError || wordMapError);
        dom.emptyMessage.textContent = '数据加载失败。';
        return false;
    }
    allSentences = sentencesData || [];
    allWords = wordsData || [];
    wordTranslationMap.clear();
    (wordMapData || []).forEach(word => {
        if(word.chinese_translation) {
            wordTranslationMap.set(word.spanish_word, word.chinese_translation)
        }
    });
    return true;
}


// --- 4. UI Rendering & State Updates ---
function updatePillPosition() {
    const activeButton = dom.studyModeSwitcher.querySelector('button.active');
    if (activeButton && dom.switcherPill) {
        dom.switcherPill.style.width = `${activeButton.offsetWidth}px`;
        dom.switcherPill.style.transform = `translateX(${activeButton.offsetLeft - 4}px)`;
    }
}

function renderUI() {
    dom.emptyMessage.style.display = 'none';
    if (currentStudyMode === 'sentences') {
        dom.wordCardContainer.style.display = 'none';
        dom.wordFilters.style.display = 'none';
        dom.sentenceFilters.style.display = 'flex';
        renderSentenceCard();
    } else {
        dom.sentenceCardContainer.style.display = 'none';
        dom.sentenceFilters.style.display = 'none';
        dom.wordFilters.style.display = 'flex';
        renderWordCard();
    }
}

function renderSentenceCard() {
    filterAndSortSentences();
    if (currentFilteredSentences.length === 0) {
        dom.sentenceCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (sentenceStatusFilter === 'mastered') dom.emptyMessage.textContent = '您还没有掌握任何句子！';
        else if (sentenceStatusFilter === 'unmastered' && allSentences.length > 0) dom.emptyMessage.textContent = '恭喜！所有句子都已掌握。';
        else dom.emptyMessage.textContent = '您的句子列表为空，请在“管理”页面添加新句子。';
        return;
    }
    dom.sentenceCardContainer.style.display = 'flex';
    const currentSentence = currentFilteredSentences[sentenceIndex];
    
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
    dom.sentenceSpanishText.innerHTML = htmlParts.join('');
    dom.sentenceChineseText.textContent = currentSentence.chinese_translation;
    dom.masteredToggle.classList.toggle('mastered', currentSentence.mastered);
}

function renderWordCard() {
    filterAndSortWords();
    if (currentFilteredWords.length === 0) {
        dom.wordCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (wordStatusFilter === 'mastered') dom.emptyMessage.textContent = '您还没有掌握任何词汇！';
        else if (wordStatusFilter === 'unmastered' && allWords.length > 0) dom.emptyMessage.textContent = '恭喜！所有词汇都已掌握。';
        else dom.emptyMessage.textContent = '暂无高频词汇，请先在“管理”页面添加一些句子。';
        return;
    }
    dom.wordCardContainer.style.display = 'flex';
    const currentWord = currentFilteredWords[wordIndex];
    if (!currentWord) return;

    dom.wordSpanishText.textContent = currentWord.spanish_word;
    dom.wordChineseText.textContent = currentWord.chinese_translation || '暂无翻译';
    dom.wordFrequencyBadge.textContent = currentWord.frequency;
    dom.wordSourceSentence.textContent = currentWord.source_sentence;
    dom.wordMasteredToggle.classList.toggle('mastered', currentWord.mastered);
}


// --- 5. Filtering and Sorting Logic ---
function filterAndSortSentences() {
    let filtered = allSentences;
    if (sentenceStatusFilter === 'unmastered') filtered = allSentences.filter(s => !s.mastered);
    else if (sentenceStatusFilter === 'mastered') filtered = allSentences.filter(s => s.mastered);

    if (sentenceSortOrder === 'random') currentFilteredSentences = [...filtered].sort(() => Math.random() - 0.5);
    else currentFilteredSentences = filtered;

    if (sentenceIndex >= currentFilteredSentences.length) sentenceIndex = 0;
}

function filterAndSortWords() {
    let filtered = allWords;
    if (wordStatusFilter === 'unmastered') filtered = allWords.filter(w => !w.mastered);
    else if (wordStatusFilter === 'mastered') filtered = allWords.filter(w => w.mastered);

    if (wordSortOrder === 'random') currentFilteredWords = [...filtered].sort(() => Math.random() - 0.5);
    else currentFilteredWords = [...filtered].sort((a, b) => b.frequency - a.frequency);

    if (wordIndex >= currentFilteredWords.length) wordIndex = 0;
}


// --- 6. Core Functionality (from original files) ---

// SENTENCE Functions
async function toggleSentenceMastered() {
    if (currentFilteredSentences.length === 0) return;
    const sentence = currentFilteredSentences[sentenceIndex];
    const newStatus = !sentence.mastered;
    const { error } = await supabase.from('sentences').update({ mastered: newStatus }).eq('id', sentence.id).eq('user_id', currentUser.id);
    if (error) {
        console.error('更新句子掌握状态失败:', error);
        await showCustomConfirm("状态更新失败！");
    } else {
        sentence.mastered = newStatus;
        renderSentenceCard();
    }
}

async function deleteCurrentSentence() {
    if (currentFilteredSentences.length === 0) return;
    const sentence = currentFilteredSentences[sentenceIndex];
    const confirmation = await showCustomConfirm(`确定要删除这个句子吗？\n"${sentence.spanish_text}"`);
    if (confirmation) {
        const { error } = await supabase.from('sentences').delete().eq('id', sentence.id).eq('user_id', currentUser.id);
        if (error) {
            await showCustomConfirm('删除失败，请检查网络或刷新页面。');
        } else {
            await showCustomConfirm('删除成功！', false);
            setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
            await fetchInitialData();
            await generateAndUpdateHighFrequencyWords(currentUser.id);
            sentenceIndex = 0;
            renderUI();
        }
    }
}

function resetAddSentenceModal() {
    dom.addSentenceTitle.textContent = '新增句子';
    dom.addSentenceForm.reset();
    dom.addChineseGroup.style.display = 'none';
    dom.newChineseText.value = '';
    dom.addSentenceSubmitBtn.textContent = '获取翻译';
    dom.addSentenceSubmitBtn.disabled = false;
    dom.addSentenceError.textContent = '';
    dom.addSentenceForm.dataset.state = 'input'; // 'input', 'confirm'
}

async function handleAddSentence(e) {
    e.preventDefault();
    const state = dom.addSentenceForm.dataset.state || 'input';
    const spanishText = dom.newSpanishText.value.trim();

    if (state === 'input') {
        if (!spanishText) {
            dom.addSentenceError.textContent = '请输入西班牙语句子。';
            return;
        }
        dom.addSentenceSubmitBtn.disabled = true;
        dom.addSentenceSubmitBtn.textContent = '翻译中...';
        dom.addSentenceError.textContent = '';

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("用户未认证");

            const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ sentences: [{ spanish_text: spanishText }], getTranslation: true })
            });

            if (!response.ok) throw new Error(`AI翻译服务出错: ${await response.text()}`);
            
            const { translatedSentences } = await response.json();
            if (translatedSentences && translatedSentences.length > 0) {
                dom.newChineseText.value = translatedSentences[0].chinese_translation;
                dom.addChineseGroup.style.display = 'block';
                dom.addSentenceSubmitBtn.textContent = '确认保存';
                dom.addSentenceForm.dataset.state = 'confirm';
            } else {
                throw new Error('AI未能返回翻译。');
            }
        } catch (error) {
            console.error('获取翻译失败:', error);
            dom.addSentenceError.textContent = `翻译失败: ${error.message}`;
            dom.addSentenceSubmitBtn.textContent = '获取翻译';
        } finally {
            dom.addSentenceSubmitBtn.disabled = false;
        }
    } else if (state === 'confirm') {
        const chineseText = dom.newChineseText.value.trim();
        if (!chineseText) {
            dom.addSentenceError.textContent = '中文翻译不能为空。';
            return;
        }
        dom.addSentenceSubmitBtn.disabled = true;
        dom.addSentenceSubmitBtn.textContent = '保存中...';

        const { error } = await supabase.from('sentences').insert([{ 
            spanish_text: spanishText, 
            chinese_translation: chineseText, 
            user_id: currentUser.id 
        }]);

        if (error) {
            dom.addSentenceError.textContent = `保存失败: ${error.message}`;
            dom.addSentenceSubmitBtn.disabled = false;
            dom.addSentenceSubmitBtn.textContent = '确认保存';
        } else {
            dom.addSentenceModal.style.display = 'none';
            await showCustomConfirm('添加成功！', false);
            setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
            await fetchInitialData();
            await generateAndUpdateHighFrequencyWords(currentUser.id);
            sentenceIndex = allSentences.findIndex(s => s.spanish_text === spanishText);
            if(sentenceIndex === -1) sentenceIndex = 0;
            renderUI();
        }
    }
}

function openEditSentenceModal() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToEdit = currentFilteredSentences[sentenceIndex];
    dom.editSentenceId.value = sentenceToEdit.id;
    dom.editSpanishText.value = sentenceToEdit.spanish_text;
    dom.editChineseText.value = sentenceToEdit.chinese_translation;
    dom.editSentenceModal.style.display = 'flex';
}

async function handleEditSentence(e) {
    e.preventDefault();
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
        await showCustomConfirm('更新成功！', false);
        setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
        await fetchInitialData();
        await generateAndUpdateHighFrequencyWords(currentUser.id);
        renderUI();
    }
}

async function getAiExplanation() {
    if (currentFilteredSentences.length === 0) return;
    const currentSentence = currentFilteredSentences[sentenceIndex];
    dom.aiExplanationTitle.textContent = `“${currentSentence.spanish_text}”`;
    dom.aiExplanationModal.style.display = 'flex';
    if (currentSentence.ai_notes) {
        dom.aiExplanationContent.innerHTML = `<p>${currentSentence.ai_notes.replace(/\n/g, '<br>')}</p>`;
        return;
    }
    dom.aiExplanationContent.innerHTML = `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成解释，请稍候...</p>`;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未认证");
        const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ sentence: currentSentence.spanish_text, getExplanation: true })
        });
        if (!response.ok) throw new Error(`AI 服务错误 (${response.status}): ${await response.text()}`);
        const result = await response.json();
        const explanation = result.explanation || '未能获取 AI 解释。';
        await supabase.from('sentences').update({ ai_notes: explanation }).eq('id', currentSentence.id);
        currentSentence.ai_notes = explanation;
        dom.aiExplanationContent.innerHTML = `<p>${explanation.replace(/\n/g, '<br>')}</p>`;
    } catch (error) {
        console.error('获取 AI 解释失败:', error);
        dom.aiExplanationContent.innerHTML = `<p>无法连接到 AI 服务。错误详情: ${error.message}</p>`;
    }
}

async function readSentenceWordByWord() {
    const sentence = currentFilteredSentences[sentenceIndex]?.spanish_text;
    if (!sentence) return;
    const words = sentence.split(/\s+/).filter(word => word.length > 0);
    dom.sentenceWordReadBtn.classList.add('playing');
    try {
        for (const word of words) {
            await readText(word);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    } finally {
        dom.sentenceWordReadBtn.classList.remove('playing');
    }
}

// WORD Functions
async function toggleWordMastered() {
    if (currentFilteredWords.length === 0) return;
    const word = currentFilteredWords[wordIndex];
    const newStatus = !word.mastered;
    const { error } = await supabase.from('high_frequency_words').update({ mastered: newStatus }).eq('id', word.id).eq('user_id', currentUser.id);
    if (error) {
        console.error('更新单词掌握状态失败:', error);
        await showCustomConfirm('更新掌握状态失败。');
    } else {
        word.mastered = newStatus;
        renderWordCard();
    }
}

function showSentencesForWord() {
    if (currentFilteredWords.length === 0) return;
    const word = currentFilteredWords[wordIndex].spanish_word;
    const matchingSentences = allSentences.filter(s => new RegExp(`\\b${word}\\b`, 'i').test(s.spanish_text));
    dom.sentenceListTitle.textContent = `包含 “${word}” 的例句 (${matchingSentences.length})`;
    dom.sentenceListContent.innerHTML = '';
    if (matchingSentences.length > 0) {
        matchingSentences.forEach(sentence => {
            const item = document.createElement('div');
            item.className = 'sentence-list-item';
            item.textContent = sentence.spanish_text;
            item.onclick = () => readText(sentence.spanish_text);
            dom.sentenceListContent.appendChild(item);
        });
    } else {
        dom.sentenceListContent.innerHTML = '<p>暂无更多例句。</p>';
    }
    dom.sentenceListModal.style.display = 'flex';
}

// --- 7. Event Listener Setup ---
function setupEventListeners() {
    // --- 【修改】模式切换器现在会保存用户的选择 ---
    dom.studyModeSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || e.target.classList.contains('active')) return;
        
        currentStudyMode = e.target.dataset.mode;

        // --- 新增代码开始 ---
        supabase
            .from('profiles')
            .update({ last_study_mode: currentStudyMode })
            .eq('id', currentUser.id)
            .then(); // 发送请求，无需等待
        // --- 新增代码结束 ---
        
        dom.studyModeSwitcher.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');
        updatePillPosition();
        renderUI();
    });

    // Actions Menu
    dom.actionsMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.actionsPanel.classList.toggle('is-visible');
    });
    document.addEventListener('click', (e) => {
        if (!dom.actionsMenuBtn.contains(e.target) && !dom.actionsPanel.contains(e.target)) {
            dom.actionsPanel.classList.remove('is-visible');
        }
    });

    // Sentence Filter Listeners
    dom.sentenceStatusFilterGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        sentenceStatusFilter = e.target.dataset.value;
        dom.sentenceStatusFilterGroup.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');
        renderUI();
    });
    dom.sentenceSortOrderGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        sentenceSortOrder = e.target.dataset.value;
        dom.sentenceSortOrderGroup.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');
        renderUI();
    });
    
    // Word Filter Listeners
    dom.wordStatusFilterGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        wordStatusFilter = e.target.dataset.value;
        dom.wordStatusFilterGroup.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');
        renderUI();
    });
    dom.wordSortOrderGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        wordSortOrder = e.target.dataset.value;
        dom.wordSortOrderGroup.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');
        renderUI();
    });

    // Card Navigation & Interaction - MODIFIED TO SAVE PROGRESS
    dom.sentenceCard.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions, .card-footer') || e.target.classList.contains('highlight-word')) return;
        const rect = dom.sentenceCard.getBoundingClientRect();
        const oldIndex = sentenceIndex;
        
        sentenceIndex = e.clientX < (rect.left + rect.width / 2)
            ? (sentenceIndex > 0 ? sentenceIndex - 1 : currentFilteredSentences.length - 1)
            : (sentenceIndex < currentFilteredSentences.length - 1 ? sentenceIndex + 1 : 0);
        
        if (oldIndex !== sentenceIndex) {
            renderSentenceCard();
            const currentSentence = currentFilteredSentences[sentenceIndex];
            if (currentSentence) {
                supabase
                    .from('profiles')
                    .update({ last_sentence_id: currentSentence.id, updated_at: new Date() })
                    .eq('id', currentUser.id)
                    .then(); // then() 用于触发请求，我们无需等待它完成
            }
        }
    });

    dom.wordCard.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions, .card-footer') || e.target.id === 'word-frequency-badge') return;
        const rect = dom.wordCard.getBoundingClientRect();
        const oldIndex = wordIndex;
        
        wordIndex = e.clientX < (rect.left + rect.width / 2)
            ? (wordIndex > 0 ? wordIndex - 1 : currentFilteredWords.length - 1)
            : (wordIndex < currentFilteredWords.length - 1 ? wordIndex + 1 : 0);
            
        if (oldIndex !== wordIndex) {
            renderWordCard();
            const currentWord = currentFilteredWords[wordIndex];
            if (currentWord) {
                supabase
                    .from('profiles')
                    .update({ last_word_id: currentWord.id, updated_at: new Date() })
                    .eq('id', currentUser.id)
                    .then(); // 同样，无需等待
            }
        }
    });
    
    // Listeners for Add, Edit, Delete
    dom.addSentenceLink.addEventListener('click', () => {
        resetAddSentenceModal();
        dom.addSentenceModal.style.display = 'flex';
    });
    dom.editSentenceLink.addEventListener('click', openEditSentenceModal);
    dom.deleteSentenceLink.addEventListener('click', deleteCurrentSentence);
    
    // Sentence-specific listeners
    dom.masteredToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleSentenceMastered(); });
    dom.sentenceSpanishText.addEventListener('click', (event) => { if (event.target.classList.contains('highlight-word')) { event.stopPropagation(); readText(event.target.dataset.word, false, event.target); } });
    dom.sentenceReadBtn.addEventListener('click', () => readText(currentFilteredSentences[sentenceIndex]?.spanish_text, false, dom.sentenceReadBtn));
    dom.sentenceSlowReadBtn.addEventListener('click', () => readText(currentFilteredSentences[sentenceIndex]?.spanish_text, true, dom.sentenceSlowReadBtn));
    dom.sentenceWordReadBtn.addEventListener('click', readSentenceWordByWord);
    dom.sentenceAiExplainBtn.addEventListener('click', getAiExplanation);

    // Word-specific listeners
    dom.wordMasteredToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleWordMastered(); });
    dom.wordFrequencyBadge.addEventListener('click', (e) => { e.stopPropagation(); showSentencesForWord(); });
    dom.wordReadBtn.addEventListener('click', () => readText(currentFilteredWords[wordIndex]?.spanish_word, false, dom.wordReadBtn));
    dom.wordSlowReadBtn.addEventListener('click', () => readText(currentFilteredWords[wordIndex]?.spanish_word, true, dom.wordSlowReadBtn));

    // Modal & Form listeners
    dom.addSentenceForm.addEventListener('submit', handleAddSentence);
    dom.cancelAddBtn.addEventListener('click', () => dom.addSentenceModal.style.display = 'none');
    dom.editSentenceForm.addEventListener('submit', handleEditSentence);
    dom.cancelEditBtn.addEventListener('click', () => dom.editSentenceModal.style.display = 'none');
    dom.aiExplanationCloseBtn.addEventListener('click', () => dom.aiExplanationModal.style.display = 'none');
    dom.sentenceListCloseBtn.addEventListener('click', () => dom.sentenceListModal.style.display = 'none');
}

// --- 8. Page Initialization ---
// 【修改】此函数已完全重写，以加载并应用学习模式和学习进度
async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    
    await initializeHeader(currentUser);
    const success = await fetchInitialData();

    if (success) {
        // --- 修改/新增代码开始 ---
        
        // 1. 从数据库获取包括学习模式在内的所有进度
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('last_sentence_id, last_word_id, last_study_mode')
            .eq('id', currentUser.id)
            .single();

        // 2. 恢复上次的学习模式
        if (profile && profile.last_study_mode === 'words') {
            currentStudyMode = 'words';
            // 更新UI以匹配模式
            dom.studyModeSwitcher.querySelector('[data-mode="sentences"]').classList.remove('active');
            dom.studyModeSwitcher.querySelector('[data-mode="words"]').classList.add('active');
        }

        // 3. 恢复上次的学习进度（句子或单词）
        const targetSentenceId = sessionStorage.getItem('targetSentenceId');
        if (targetSentenceId) {
            // 优先处理从 manage.html 的跳转
            const targetIndex = allSentences.findIndex(s => s.id == targetSentenceId);
            if (targetIndex !== -1) {
                sentenceIndex = targetIndex;
            }
            sessionStorage.removeItem('targetSentenceId');
        } else if (profile) {
            // 如果没有跳转，则恢复上次的学习进度
            if (profile.last_sentence_id) {
                const lastSentenceIndex = allSentences.findIndex(s => s.id === profile.last_sentence_id);
                if (lastSentenceIndex !== -1) sentenceIndex = lastSentenceIndex;
            }
            if (profile.last_word_id) {
                const lastWordIndex = allWords.findIndex(w => w.id === profile.last_word_id);
                if (lastWordIndex !== -1) wordIndex = lastWordIndex;
            }
        }
        
        // --- 修改/新增代码结束 ---

        setupEventListeners();
        renderUI(); // renderUI会根据已恢复的 currentStudyMode 显示正确的界面
        updatePillPosition();
    }
}


initializePage();