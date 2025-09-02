// js/vocabulary-main.js

import { supabase } from './config.js';
import { protectPage, initializeLogoutButton } from './auth.js';
import { showCustomConfirm, readText } from './utils.js';

let currentUser = null;
let allWords = [];
let allSentences = [];
let currentFilteredWords = [];
let currentWordIndex = 0;
let currentWordStatusFilter = 'all';
let currentWordSortOrder = 'frequency';

const dom = {
    wordCardContainer: document.getElementById('word-card-container'),
    wordCard: document.getElementById('word-card'),
    emptyMessage: document.getElementById('empty-vocabulary-message'),
    statusFilterGroup: document.getElementById('word-status-filter-group'),
    sortOrderGroup: document.getElementById('word-sort-order-group'),
    spanishWordText: document.querySelector('#word-card .spanish #word-text'),
    frequencyBadge: document.getElementById('word-frequency-badge'),
    chineseTranslation: document.querySelector('#word-card .chinese'),
    sourceSentence: document.querySelector('#word-card .source-sentence'),
    readBtn: document.getElementById('word-read-btn'),
    slowReadBtn: document.getElementById('word-slow-read-btn'),
    masteredToggle: document.getElementById('word-mastered-toggle'),
    sentenceListModal: document.getElementById('sentenceListModal'),
    sentenceListTitle: document.getElementById('sentenceListTitle'),
    sentenceListContent: document.getElementById('sentence-list-content'),
    sentenceListCloseBtn: document.getElementById('sentenceListCloseBtn'),
};

async function fetchInitialData() {
    const { data: wordsData, error: wordsError } = await supabase.from('high_frequency_words').select('*').eq('user_id', currentUser.id);
    if (wordsError) throw wordsError;
    allWords = wordsData || [];
    const { data: sentencesData, error: sentencesError } = await supabase.from('sentences').select('spanish_text').eq('user_id', currentUser.id);
    if (sentencesError) throw sentencesError;
    allSentences = sentencesData || [];
}

function renderWordCard() {
    if (!dom.wordCardContainer) return;
    if (currentFilteredWords.length === 0) {
        dom.wordCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (currentWordStatusFilter === 'mastered') dom.emptyMessage.innerText = '您还没有掌握任何词汇！';
        else if (currentWordStatusFilter === 'unmastered' && allWords.length > 0) dom.emptyMessage.innerText = '恭喜！所有词汇都已掌握。';
        else dom.emptyMessage.innerText = '暂无高频词汇，请先在“管理”页面添加一些句子。';
        return;
    }
    dom.wordCardContainer.style.display = 'flex';
    dom.emptyMessage.style.display = 'none';
    const currentWord = currentFilteredWords[currentWordIndex];
    if (!currentWord) return;
    dom.spanishWordText.innerText = currentWord.spanish_word;
    dom.chineseTranslation.innerText = currentWord.chinese_translation || '暂无翻译';
    dom.sourceSentence.innerText = currentWord.source_sentence;
    dom.frequencyBadge.innerText = currentWord.frequency;
    dom.masteredToggle.classList.toggle('mastered', currentWord.mastered);
}

function filterAndSortWords() {
    let filtered = allWords;
    if (currentWordStatusFilter === 'unmastered') {
        filtered = allWords.filter(w => !w.mastered);
    } else if (currentWordStatusFilter === 'mastered') {
        filtered = allWords.filter(w => w.mastered);
    }
    if (currentWordSortOrder === 'random') {
        currentFilteredWords = [...filtered].sort(() => Math.random() - 0.5);
    } else {
        currentFilteredWords = [...filtered].sort((a, b) => b.frequency - a.frequency);
    }
    currentWordIndex = 0;
    renderWordCard();
}

async function toggleWordMastered() {
    if (currentFilteredWords.length === 0 || !currentUser) return;
    const currentWord = currentFilteredWords[currentWordIndex];
    const newStatus = !currentWord.mastered;

    // === 核心改动 (修复 RLS 问题) ===
    // 更新时，同时匹配词汇的 id 和 当前用户的 user_id
    const { error } = await supabase
        .from('high_frequency_words')
        .update({ mastered: newStatus })
        .eq('id', currentWord.id)
        .eq('user_id', currentUser.id); // <--- 新增的用户验证
    // ===================================

    if (error) {
        console.error('更新单词状态失败:', error);
        await showCustomConfirm('更新掌握状态失败。请检查 RLS 策略或网络连接。');
    } else {
        currentWord.mastered = newStatus;
        renderWordCard();
    }
}

function showSentencesForWord(word) {
    if (!dom.sentenceListModal) return;
    const matchingSentences = allSentences.filter(sentence => new RegExp(`\\b${word}\\b`, 'i').test(sentence.spanish_text));
    dom.sentenceListTitle.innerText = `包含 “${word}” 的例句 (${matchingSentences.length})`;
    dom.sentenceListContent.innerHTML = '';
    if (matchingSentences.length > 0) {
        matchingSentences.forEach(sentence => {
            const item = document.createElement('div');
            item.className = 'sentence-list-item';
            item.innerText = sentence.spanish_text;
            item.onclick = () => readText(sentence.spanish_text);
            dom.sentenceListContent.appendChild(item);
        });
    } else {
        dom.sentenceListContent.innerHTML = '<p>暂无更多例句。</p>';
    }
    dom.sentenceListModal.style.display = 'flex';
}

async function updateLastStudiedWord(wordId) {
    if (!wordId || !currentUser) return;
    await supabase.from('profiles').update({ last_word_id: wordId, updated_at: new Date() }).eq('id', currentUser.id);
}

function setupEventListeners() {
    dom.statusFilterGroup?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
            currentWordStatusFilter = e.target.dataset.value;
            dom.statusFilterGroup.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            filterAndSortWords();
        }
    });

    dom.sortOrderGroup?.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.classList.contains('active')) {
            currentWordSortOrder = e.target.dataset.value;
            dom.sortOrderGroup.querySelector('.active')?.classList.remove('active');
            e.target.classList.add('active');
            filterAndSortWords();
        }
    });

    dom.wordCard?.addEventListener('click', async (event) => {
        if (event.target.closest('button') || event.target.closest('.card-footer') || event.target.id === 'word-frequency-badge') {
            return;
        }
        if (currentFilteredWords.length === 0) return;
        const rect = dom.wordCard.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        if (event.clientX < midpoint) {
            currentWordIndex = (currentWordIndex > 0) ? currentWordIndex - 1 : currentFilteredWords.length - 1;
        } else {
            currentWordIndex = (currentWordIndex < currentFilteredWords.length - 1) ? currentWordIndex + 1 : 0;
        }
        renderWordCard();
        
        const currentWord = currentFilteredWords[currentWordIndex];
        if (currentWord) {
            await updateLastStudiedWord(currentWord.id);
        }
    });
    
    dom.readBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        readText(currentFilteredWords[currentWordIndex]?.spanish_word, false, dom.readBtn);
    });

    dom.slowReadBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        readText(currentFilteredWords[currentWordIndex]?.spanish_word, true, dom.slowReadBtn);
    });

    dom.masteredToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWordMastered();
    });

    dom.frequencyBadge?.addEventListener('click', (e) => {
        e.stopPropagation();
        showSentencesForWord(currentFilteredWords[currentWordIndex]?.spanish_word);
    });

    dom.sentenceListCloseBtn?.addEventListener('click', () => {
        if (dom.sentenceListModal) dom.sentenceListModal.style.display = 'none';
    });
}

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;
    initializeLogoutButton();
    dom.emptyMessage.style.display = 'flex';
    dom.emptyMessage.innerText = '加载中...';
    try {
        await fetchInitialData();
        const { data: profile } = await supabase.from('profiles').select('last_word_id').eq('id', currentUser.id).single();
        const lastWordId = profile?.last_word_id;
        filterAndSortWords();
        if (lastWordId) {
            const targetIndex = currentFilteredWords.findIndex(w => w.id == lastWordId);
            if (targetIndex !== -1) {
                currentWordIndex = targetIndex;
                renderWordCard();
            }
        }
        setupEventListeners();
    } catch (error) {
        console.error("初始化词汇页面失败:", error);
        dom.emptyMessage.innerText = `加载数据时发生错误: ${error.message}`;
    }
}

initializePage();