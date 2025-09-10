// js/study-main.js

import { supabase } from './config.js';
import { protectPage, initializeHeader } from './auth.js';
import { showCustomConfirm, readText, generateAndUpdateHighFrequencyWords, initializeDropdowns, getWordsFromSentence, unlockAudioContext } from './utils.js';

// --- 1. State Management ---
let currentUser = null;
let currentStudyMode = 'sentences';
let allSentences = [], currentFilteredSentences = [], sentenceIndex = 0, sentenceStatusFilter = 'unmastered', sentenceSortOrder = 'sequential';
let allWords = [], currentFilteredWords = [], wordIndex = 0, wordStatusFilter = 'unmastered', wordSortOrder = 'frequency';
let wordTranslationMap = new Map();
let studySession = null;
let seenInThisSession = new Set();
let isAutoplayEnabled = false;
const WORDS_PER_PAGE = 30;
let wordListPage = 1;
let isLoadingMoreWords = false;

// --- 2. DOM Elements ---
const dom = {};
let studyProgressContainer = null;

function populateDomObject() {
    Object.assign(dom, {
        mainContent: document.getElementById('main-content'),
        autoplayContainer: document.querySelector('.autoplay-container'),
        autoplayToggleBtn: document.getElementById('autoplay-toggle-btn'),
        studyControls: document.querySelector('.study-controls-v2'),
        filterMenuBtn: document.getElementById('filter-menu-btn'),
        filterPanel: document.getElementById('filter-panel'),
        studyModeSwitcher: document.getElementById('study-mode-switcher'),
        switcherPill: document.getElementById('switcher-pill'),
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
        wordListContainer: null,
        aiExplanationModal: document.getElementById('aiExplanationModal'),
        aiExplanationTitle: document.getElementById('aiExplanationTitle'),
        aiExplanationContent: document.getElementById('aiExplanationContent'),
        aiExplanationCloseBtn: document.getElementById('aiExplanationCloseBtn'),
        aiWordExplanationModal: document.getElementById('aiWordExplanationModal'),
        aiWordExplanationTitle: document.getElementById('aiWordExplanationTitle'),
        aiWordExplanationContent: document.getElementById('aiWordExplanationContent'),
        aiWordExplanationCloseBtn: document.getElementById('aiWordExplanationCloseBtn'),
        addSentenceModal: document.getElementById('addSentenceModal'),
        addSentenceForm: document.getElementById('add-sentence-form'),
        editSentenceModal: document.getElementById('editSentenceModal'),
        editSentenceForm: document.getElementById('edit-sentence-form'),
        sentenceListModal: document.getElementById('sentenceListModal'),
        sentenceListTitle: document.getElementById('sentenceListTitle'),
        sentenceListContent: document.getElementById('sentence-list-content'),
        sentenceListCloseBtn: document.getElementById('sentenceListCloseBtn'),
        sentenceStatusFilterGroup: document.getElementById('status-filter-group'),
        sentenceSortOrderGroup: document.getElementById('sort-order-group'),
        wordStatusFilterGroup: document.getElementById('word-status-filter-group'),
        wordSortOrderGroup: document.getElementById('word-sort-order-group'),
    });
}


// --- 3. Core Logic ---
function setupAutoplay() {
    isAutoplayEnabled = false;
    updateAutoplayButton();
    dom.autoplayToggleBtn.addEventListener('click', toggleAutoplay);
}

function updateAutoplayButton() {
    dom.autoplayToggleBtn.textContent = `自动朗读: ${isAutoplayEnabled ? '开' : '关'}`;
    dom.autoplayToggleBtn.classList.toggle('active', isAutoplayEnabled);
    dom.autoplayToggleBtn.title = isAutoplayEnabled ? '自动朗读已开启' : '开启自动朗读';
}

function toggleAutoplay() {
    isAutoplayEnabled = !isAutoplayEnabled;
    updateAutoplayButton();
}

function triggerAutoplay() {
    if (isAutoplayEnabled && currentStudyMode === 'sentences' && currentFilteredSentences.length > 0) {
        const currentSentence = currentFilteredSentences[sentenceIndex];
        if (currentSentence) {
            readText(currentSentence.spanish_text, false, dom.sentenceReadBtn);
        }
    }
}

async function logStudyEvent(itemId, itemType) {
    if (!currentUser || !itemId || !itemType) return;
    const { error } = await supabase.from('study_log').upsert({
        user_id: currentUser.id,
        item_id: itemId,
        item_type: itemType,
    }, {
        onConflict: 'user_id, item_id, item_type'
    });
    if (error) {
        console.error('Error logging study event:', error);
    }
}

async function fetchInitialData() {
    dom.emptyMessage.textContent = '加载中...';
    const sentencePromise = supabase.from('sentences').select('*').eq('user_id', currentUser.id).order('id', {
        ascending: true
    });
    const wordPromise = supabase.from('high_frequency_words').select('*').eq('user_id', currentUser.id);
    const wordMapPromise = supabase.from('high_frequency_words').select('spanish_word, chinese_translation').eq('user_id', currentUser.id);
    const [{ data: sentencesData, error: sentencesError }, { data: wordsData, error: wordsError }, { data: wordMapData, error: wordMapError }] = await Promise.all([sentencePromise, wordPromise, wordMapPromise]);
    if (sentencesError || wordsError || wordMapError) {
        console.error('Data fetching error:', sentencesError || wordsError || wordMapError);
        dom.emptyMessage.textContent = '数据加载失败。';
        return false;
    }
    allSentences = sentencesData || [];
    allWords = wordsData || [];
    wordTranslationMap.clear();
    (wordMapData || []).forEach(word => {
        if (word.chinese_translation) {
            wordTranslationMap.set(word.spanish_word, word.chinese_translation)
        }
    });
    return true;
}

function updatePillPosition() {
    if (!dom.studyModeSwitcher) return;
    const activeButton = dom.studyModeSwitcher.querySelector('button.active');
    if (activeButton && dom.switcherPill) {
        dom.switcherPill.style.width = `${activeButton.offsetWidth}px`;
        dom.switcherPill.style.transform = `translateX(${activeButton.offsetLeft - 4}px)`;
    }
}

function initializeStudySession() {
    const sessionData = sessionStorage.getItem('studySession');
    if (sessionData) {
        studySession = JSON.parse(sessionData);
        currentStudyMode = 'sentences';
    }
}

function updateStudyProgressBar() {
    const shouldShowProgressBar = currentStudyMode === 'sentences' && currentFilteredSentences.length > 0;
    if (shouldShowProgressBar) {
        if (!studyProgressContainer) {
            studyProgressContainer = document.createElement('div');
            studyProgressContainer.className = 'session-progress';
            dom.mainContent.prepend(studyProgressContainer);
        }
        studyProgressContainer.style.display = 'block';
        const total = currentFilteredSentences.length;
        const current = sentenceIndex + 1;
        
        let exitLinkHTML = '';
        if (studySession) {
            exitLinkHTML = `<a id="session-exit-link" class="session-exit-link">退出会话</a>`;
        }
        
        studyProgressContainer.innerHTML = `
            <div class="container">
                <span class="session-progress-text">进度: ${current} / ${total}</span>
                ${exitLinkHTML}
            </div>
        `;

        if (studySession) {
            document.getElementById('session-exit-link').addEventListener('click', async () => {
                const confirmation = await showCustomConfirm('确定要退出本次专注学习吗？');
                if (confirmation) {
                    sessionStorage.removeItem('studySession');
                    window.location.href = 'index.html';
                }
            });
        }

    } else {
        if (studyProgressContainer) {
            studyProgressContainer.style.display = 'none';
        }
    }
}

function filterAndSortSentences() {
    let sourceData = studySession ? allSentences.filter(s => new Set(studySession.sentenceIds).has(s.id)) : allSentences;

    let filtered = sourceData;
    if (sentenceStatusFilter !== 'all') {
        if (sentenceStatusFilter === 'unmastered') filtered = sourceData.filter(s => !s.mastered);
        else if (sentenceStatusFilter === 'mastered') filtered = sourceData.filter(s => s.mastered);
    }

    if (sentenceSortOrder === 'random') {
        currentFilteredSentences = [...filtered].sort(() => Math.random() - 0.5);
    } else {
        currentFilteredSentences = [...filtered].sort((a, b) => a.id - b.id);
    }

    if (sentenceIndex >= currentFilteredSentences.length) {
        sentenceIndex = 0;
    }

    seenInThisSession.clear();
    if (currentFilteredSentences.length > 0) {
        seenInThisSession.add(currentFilteredSentences[sentenceIndex].id);
    }
}

function handleCardNavigation(direction) {
    if (currentFilteredSentences.length === 0) return;
    
    const currentSentenceId = currentFilteredSentences[sentenceIndex].id;
    seenInThisSession.add(currentSentenceId);
    logStudyEvent(currentSentenceId, 'sentence');

    const isCompletionTriggered = (studySession || sentenceStatusFilter !== 'all') && seenInThisSession.size >= currentFilteredSentences.length;

    if (isCompletionTriggered && direction === 'next') {
        showSessionEndModal();
        return;
    }

    const oldIndex = sentenceIndex;
    if (direction === 'next') {
        sentenceIndex = (sentenceIndex < currentFilteredSentences.length - 1) ? sentenceIndex + 1 : 0;
    } else {
        sentenceIndex = (sentenceIndex > 0) ? sentenceIndex - 1 : currentFilteredSentences.length - 1;
    }

    if (oldIndex !== sentenceIndex) {
        renderSentenceCard();
        triggerAutoplay();
        
        const nextSentenceObject = currentFilteredSentences[sentenceIndex];
        const nextSentenceId = nextSentenceObject.id;
        seenInThisSession.add(nextSentenceId);

        if (!studySession) {
            supabase.from('profiles').update({
                last_sentence_id: nextSentenceId,
                updated_at: new Date()
            }).eq('id', currentUser.id).then();
        }
    }
}

function renderUI() {
    const isSentenceMode = currentStudyMode === 'sentences';
    if (dom.autoplayContainer) dom.autoplayContainer.style.display = isSentenceMode ? 'block' : 'none';
    if (dom.sentenceFilters) dom.sentenceFilters.style.display = isSentenceMode ? 'flex' : 'none';
    if (dom.wordFilters) dom.wordFilters.style.display = isSentenceMode ? 'none' : 'flex';

    if (isSentenceMode) {
        if (dom.wordCardContainer) dom.wordCardContainer.style.display = 'none';
        renderSentenceCard();
    } else {
        if (studyProgressContainer) studyProgressContainer.style.display = 'none';
        if (dom.sentenceCardContainer) dom.sentenceCardContainer.style.display = 'none';
        renderWordList();
    }
    updatePillPosition();
}

function renderSentenceCard() {
    updateStudyProgressBar();
    if (currentFilteredSentences.length === 0) {
        if (dom.sentenceCardContainer) dom.sentenceCardContainer.style.display = 'none';
        if (dom.emptyMessage) dom.emptyMessage.style.display = 'flex';

        if (studySession) {
            dom.emptyMessage.textContent = '无法加载学习会话内容，请返回主页重试。';
        } else if (sentenceStatusFilter === 'mastered') {
            dom.emptyMessage.textContent = '您还没有掌握任何句子！';
        } else if (sentenceStatusFilter === 'unmastered' && allSentences.length > 0) {
            dom.emptyMessage.textContent = '恭喜！所有句子都已掌握。';
        } else {
            dom.emptyMessage.textContent = '您的句子列表为空，请在“管理”页面添加新句子。';
        }
        return;
    }
    if (dom.emptyMessage) dom.emptyMessage.style.display = 'none';
    if (dom.sentenceCardContainer) dom.sentenceCardContainer.style.display = 'flex';

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

function renderWordList(loadMore = false) {
    if (!loadMore) {
        wordListPage = 1;
        filterAndSortWords();
        dom.wordListContainer.innerHTML = '';
        if (currentFilteredWords.length > 0) {
            const headerHTML = `<h2 class="word-list-title">单词列表</h2><p class="word-list-note">点击单词本身可查看 AI 深度解析。</p>`;
            dom.wordListContainer.innerHTML = headerHTML;
        }
    }
    if (currentFilteredWords.length === 0) {
        dom.wordCardContainer.style.display = 'none';
        dom.emptyMessage.style.display = 'flex';
        if (wordStatusFilter === 'mastered') dom.emptyMessage.textContent = '您还没有掌握任何词汇！';
        else if (wordStatusFilter === 'unmastered' && allWords.length > 0) dom.emptyMessage.textContent = '恭喜！所有词汇都已掌握。';
        else if (studySession) dom.emptyMessage.textContent = '当前会话的句子中没有高频词汇。';
        else dom.emptyMessage.textContent = '暂无高频词汇，请先添加一些句子。';
        return;
    }
    dom.emptyMessage.style.display = 'none';
    dom.wordCardContainer.style.display = 'block';
    const startIndex = (wordListPage - 1) * WORDS_PER_PAGE;
    const endIndex = startIndex + WORDS_PER_PAGE;
    const wordsToRender = currentFilteredWords.slice(startIndex, endIndex);
    if (wordsToRender.length === 0 && !loadMore) {
        dom.emptyMessage.style.display = 'flex';
        dom.wordCardContainer.style.display = 'none';
        return;
    }
    const fragment = document.createDocumentFragment();
    wordsToRender.forEach(word => {
        const item = document.createElement('div');
        item.className = 'word-list-item';
        item.dataset.wordId = word.id;
        item.innerHTML = `
            <div class="mastered-toggle-word ${word.mastered ? 'mastered' : ''}" title="标记已掌握">
                <svg class="mastered-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.79"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </div>
            <span class="word-text">${word.spanish_word}</span>
            <div class="actions">
                <button class="icon-btn-list read-btn" title="朗读">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <button class="icon-btn-list slow-read-btn" title="慢速朗读">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </button>
            </div>
        `;
        fragment.appendChild(item);
    });
    dom.wordListContainer.appendChild(fragment);
    isLoadingMoreWords = false;
    wordListPage++;
}

function filterAndSortWords() {
    let sourceData = allWords;
    if (studySession) {
        const sessionWordSet = new Set();
        const sessionSentencesText = studySession.sentences.map(s => s.spanish_text);
        sessionSentencesText.forEach(text => {
            const wordsInSentence = getWordsFromSentence(text);
            wordsInSentence.forEach(word => sessionWordSet.add(word));
        });
        sourceData = allWords.filter(wordObj => sessionWordSet.has(wordObj.spanish_word));
    }

    let filtered = sourceData;
    if (wordStatusFilter !== 'all') {
        if (wordStatusFilter === 'unmastered') filtered = sourceData.filter(w => !w.mastered);
        else if (wordStatusFilter === 'mastered') filtered = sourceData.filter(w => w.mastered);
    }

    if (wordSortOrder === 'random') currentFilteredWords = [...filtered].sort(() => Math.random() - 0.5);
    else currentFilteredWords = [...filtered].sort((a, b) => b.frequency - a.frequency);

    wordIndex = 0;
}

async function showSessionEndModal() {
    const confirmModal = document.getElementById('confirmModal');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    let titleText = studySession ? "本次学习已完成！" : "恭喜！已学完当前列表！";

    confirmMessage.innerHTML = `
        <p style="font-size: 1.2rem; font-weight: 500; text-align: center; margin-bottom: 1.5rem;">${titleText}</p>
        <p style="text-align: center; margin-top: -1rem; margin-bottom: 2rem;">接下来您想做什么？</p>
        <div class="modal-multi-choice">
            <button id="session-action-quiz-mixed" class="btn btn-primary">开始综合测试</button>
            <button id="session-action-quiz-sentence" class="btn btn-secondary">只测句子</button>
            <button id="session-action-quiz-word" class="btn btn-secondary">只测单词</button>
            <button id="session-action-restart" class="btn btn-secondary">重新学习本轮</button>
            <button id="session-action-home" class="btn btn-secondary">返回主页</button>
        </div>
    `;
    confirmBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    confirmModal.style.display = 'flex';

    const closeModal = () => {
        confirmModal.style.display = 'none';
        confirmMessage.innerHTML = '<p id="confirmMessage"></p>';
        confirmBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';
    };

    document.getElementById('session-action-quiz-mixed').onclick = () => {
        startQuizSession('mixed');
        closeModal();
    };
    document.getElementById('session-action-quiz-sentence').onclick = () => {
        startQuizSession('sentence');
        closeModal();
    };
    document.getElementById('session-action-quiz-word').onclick = () => {
        startQuizSession('word');
        closeModal();
    };
    document.getElementById('session-action-restart').onclick = () => {
        sentenceIndex = 0;
        filterAndSortSentences();
        renderSentenceCard();
        closeModal();
    };
    document.getElementById('session-action-home').onclick = () => {
        sessionStorage.removeItem('studySession');
        window.location.href = 'index.html';
        closeModal();
    };
}

function startQuizSession(type) {
    const idsToTest = Array.from(seenInThisSession);
    const quizSessionData = {
        type,
        sentenceIds: idsToTest
    };

    if (type === 'word' || type === 'mixed') {
        const wordSet = new Set();
        const sentencesForQuiz = allSentences.filter(s => idsToTest.includes(s.id));
        const sessionSentencesText = sentencesForQuiz.map(s => s.spanish_text);

        sessionSentencesText.forEach(text => {
            const wordsInSentence = getWordsFromSentence(text);
            wordsInSentence.forEach(word => wordSet.add(word));
        });
        const wordIds = Array.from(wordSet).map(spanishWord => {
            const foundWord = allWords.find(w => w.spanish_word === spanishWord);
            return foundWord ? foundWord.id : null;
        }).filter(id => id !== null);
        quizSessionData.wordIds = wordIds;
    }
    sessionStorage.setItem('quizSession', JSON.stringify(quizSessionData));
    window.location.href = 'quiz.html';
}

async function toggleSentenceMastered() {
    if (currentFilteredSentences.length === 0) return;
    const sentence = currentFilteredSentences[sentenceIndex];
    const newStatus = !sentence.mastered;
    const { error } = await supabase.from('sentences').update({
        mastered: newStatus
    }).eq('id', sentence.id).eq('user_id', currentUser.id);
    if (error) {
        console.error('更新句子掌握状态失败:', error);
        await showCustomConfirm("状态更新失败！");
    } else {
        sentence.mastered = newStatus;
        
        if (!studySession && sentenceStatusFilter === 'unmastered') {
            const unmasteredSentences = allSentences.filter(s => !s.mastered);
            if (unmasteredSentences.length === 0) {
                showSessionEndModal();
                return;
            }
        }
        renderSentenceCard();
    }
}

async function toggleWordMastered(wordId, buttonElement) {
    const word = allWords.find(w => w.id === wordId);
    if (!word) return;
    const newStatus = !word.mastered;
    const { error } = await supabase.from('high_frequency_words').update({
        mastered: newStatus
    }).eq('id', wordId).eq('user_id', currentUser.id);
    if (error) {
        console.error('更新单词掌握状态失败:', error);
        await showCustomConfirm('更新掌握状态失败。');
    } else {
        word.mastered = newStatus;
        buttonElement.classList.toggle('mastered', newStatus);
        if ((wordStatusFilter === 'unmastered' && newStatus) || (wordStatusFilter === 'mastered' && !newStatus)) {
            buttonElement.parentElement.style.display = 'none';
        }
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
            sentenceIndex = 0;
            renderUI();
        }
    }
}

function resetAddSentenceModal() {
    dom.addSentenceForm.querySelector('#add-sentence-title').textContent = '新增句子';
    dom.addSentenceForm.reset();
    document.getElementById('add-chinese-group').style.display = 'none';
    document.getElementById('new-chinese-text').value = '';
    document.getElementById('add-sentence-submit-btn').textContent = '获取翻译';
    document.getElementById('add-sentence-submit-btn').disabled = false;
    document.getElementById('add-sentence-error').textContent = '';
    dom.addSentenceForm.dataset.state = 'input';
}

async function handleAddSentence(e) {
    e.preventDefault();
    const form = e.target;
    const state = form.dataset.state || 'input';
    const spanishText = document.getElementById('new-spanish-text').value.trim();
    const errorEl = document.getElementById('add-sentence-error');
    const submitBtn = document.getElementById('add-sentence-submit-btn');
    if (state === 'input') {
        if (!spanishText) {
            errorEl.textContent = '请输入西班牙语句子。';
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = '翻译中...';
        errorEl.textContent = '';
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("用户未认证");
            const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    sentences: [{
                        spanish_text: spanishText
                    }],
                    getTranslation: true
                })
            });
            if (!response.ok) throw new Error(`AI翻译服务出错: ${await response.text()}`);
            const { translatedSentences } = await response.json();
            if (translatedSentences && translatedSentences.length > 0) {
                document.getElementById('new-chinese-text').value = translatedSentences[0].chinese_translation;
                document.getElementById('add-chinese-group').style.display = 'block';
                submitBtn.textContent = '确认保存';
                form.dataset.state = 'confirm';
            } else {
                throw new Error('AI未能返回翻译。');
            }
        } catch (error) {
            console.error('获取翻译失败:', error);
            errorEl.textContent = `翻译失败: ${error.message}`;
            submitBtn.textContent = '获取翻译';
        } finally {
            submitBtn.disabled = false;
        }
    } else if (state === 'confirm') {
        const chineseText = document.getElementById('new-chinese-text').value.trim();
        if (!chineseText) {
            errorEl.textContent = '中文翻译不能为空。';
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = '保存中...';
        const { error } = await supabase.from('sentences').insert([{
            spanish_text: spanishText,
            chinese_translation: chineseText,
            user_id: currentUser.id
        }]);
        if (error) {
            errorEl.textContent = `保存失败: ${error.message}`;
            submitBtn.disabled = false;
            submitBtn.textContent = '确认保存';
        } else {
            dom.addSentenceModal.style.display = 'none';
            await showCustomConfirm('添加成功！', false);
            setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
            await fetchInitialData();
            await generateAndUpdateHighFrequencyWords(currentUser.id);
            sentenceIndex = allSentences.findIndex(s => s.spanish_text === spanishText);
            if (sentenceIndex === -1) sentenceIndex = 0;
            renderUI();
        }
    }
}

function openEditSentenceModal() {
    if (currentFilteredSentences.length === 0) return;
    const sentenceToEdit = currentFilteredSentences[sentenceIndex];
    dom.editSentenceForm.querySelector('#edit-sentence-id').value = sentenceToEdit.id;
    dom.editSentenceForm.querySelector('#edit-spanish-text').value = sentenceToEdit.spanish_text;
    dom.editSentenceForm.querySelector('#edit-chinese-text').value = sentenceToEdit.chinese_translation;
    dom.editSentenceModal.style.display = 'flex';
}

async function handleEditSentence(e) {
    e.preventDefault();
    const id = dom.editSentenceForm.querySelector('#edit-sentence-id').value;
    const spanishText = dom.editSentenceForm.querySelector('#edit-spanish-text').value.trim();
    const chineseText = dom.editSentenceForm.querySelector('#edit-chinese-text').value.trim();
    if (!spanishText || !chineseText) {
        await showCustomConfirm('西班牙语和中文翻译均不能为空！');
        return;
    }
    const { error } = await supabase.from('sentences').update({
        spanish_text: spanishText,
        chinese_translation: chineseText,
        ai_notes: null
    }).eq('id', id).eq('user_id', currentUser.id);
    if (error) {
        await showCustomConfirm(`更新失败: ${error.message}`);
    } else {
        dom.editSentenceModal.style.display = 'none';
        await showCustomConfirm('更新成功！', false);
        setTimeout(() => document.getElementById('confirmModal').style.display = 'none', 1000);
        await fetchInitialData();
        renderUI();
    }
}

async function getAiSentenceExplanation() {
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
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                sentence: currentSentence.spanish_text,
                getExplanation: true
            })
        });
        if (!response.ok) throw new Error(`AI 服务错误 (${response.status}): ${await response.text()}`);
        const result = await response.json();
        const explanation = result.explanation || '未能获取 AI 解释。';
        await supabase.from('sentences').update({
            ai_notes: explanation
        }).eq('id', currentSentence.id);
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

async function getAiWordExplanation(word) {
    if (!word) return;
    dom.aiWordExplanationTitle.textContent = `“${word.spanish_word}”`;
    dom.aiWordExplanationModal.style.display = 'flex';
    if (word.ai_explanation && Object.keys(word.ai_explanation).length > 0) {
        renderAiWordExplanation(word.ai_explanation, word.spanish_word);
        return;
    }
    dom.aiWordExplanationContent.innerHTML = `<div class="loading-spinner"></div><p style="text-align: center;">AI 正在生成深度解析，请稍候...</p>`;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("用户未认证");
        const response = await fetch('https://rvarfascuwvponxwdeoe.supabase.co/functions/v1/explain-sentence', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                word: word.spanish_word,
                getExplanation: true
            })
        });
        if (!response.ok) throw new Error(`AI 服务错误 (${response.status}): ${await response.text()}`);
        const data = await response.json();
        const { error: updateError } = await supabase.from('high_frequency_words').update({
            ai_explanation: data
        }).eq('id', word.id);
        if (updateError) {
            console.error('Failed to cache AI word explanation:', updateError);
        } else {
            word.ai_explanation = data;
        }
        renderAiWordExplanation(data, word.spanish_word);
    } catch (error) {
        console.error('获取 AI 单词解析失败:', error);
        dom.aiWordExplanationContent.innerHTML = `<p>无法连接到 AI 服务。错误详情: ${error.message}</p>`;
    }
}

function renderAiWordExplanation(data, wordText) {
    let html = '';
    if (data.ipa) {
        html += `<div class="ai-section"><div class="ai-section-title">发音</div><div class="ipa-container"><span class="ipa-text">${data.ipa}</span><div class="ipa-actions"><button class="icon-btn-modal read-btn" title="朗读"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg></button><button class="icon-btn-modal slow-read-btn" title="慢速朗读"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></button></div></div>${data.pronunciationTip ? `<p class="pronunciation-tip">${data.pronunciationTip}</p>` : ''}</div>`;
    }
    html += `<div class="ai-section"><div class="ai-section-title">核心信息</div><p><strong>词性:</strong> ${data.partOfSpeech || 'N/A'}</p>${data.gender ? `<p><strong>阴阳性:</strong> ${data.gender}</p>` : ''}<p><strong>核心含义:</strong> ${data.coreMeaning || 'N/A'}</p></div>`;
    if (data.usageNotes) {
        html += `<div class="ai-section"><div class="ai-section-title">用法与搭配</div><p>${data.usageNotes.replace(/\n/g, '<br>')}</p></div>`;
    }
    if (data.conjugationTable && data.conjugationTable.forms && data.conjugationTable.forms.length > 0) {
        html += `<div class="ai-section"><div class="ai-section-title">${data.conjugationTable.tense || '动词变位'}</div><ul class="conjugation-table">${data.conjugationTable.forms.map(form => `<li>${form}</li>`).join('')}</ul></div>`;
    }
    if (data.mnemonic) {
        html += `<div class="ai-section"><div class="ai-section-title">联想记忆</div><p>${data.mnemonic.replace(/\n/g, '<br>')}</p></div>`;
    }
    if ((data.synonyms && data.synonyms.length > 0) || (data.antonyms && data.antonyms.length > 0)) {
        html += `<div class="ai-section"><div class="ai-section-title">相关词汇</div>`;
        if (data.synonyms && data.synonyms.length > 0) {
            html += `<p><strong>近义词:</strong> ${data.synonyms.join(', ')}</p>`;
        }
        if (data.antonyms && data.antonyms.length > 0) {
            html += `<p><strong>反义词:</strong> ${data.antonyms.join(', ')}</p>`;
        }
        html += `</div>`;
    }
    dom.aiWordExplanationContent.innerHTML = html;
    const modalReadBtn = dom.aiWordExplanationContent.querySelector('.read-btn');
    const modalSlowReadBtn = dom.aiWordExplanationContent.querySelector('.slow-read-btn');
    if (modalReadBtn) modalReadBtn.onclick = () => readText(wordText, false, modalReadBtn);
    if (modalSlowReadBtn) modalSlowReadBtn.onclick = () => readText(wordText, true, modalSlowReadBtn);
}

function initializeWordListContainer() {
    const oldCard = document.getElementById('word-card');
    const oldFooter = document.getElementById('word-card-footer');
    if (oldCard) oldCard.style.display = 'none';
    if (oldFooter) oldFooter.style.display = 'none';
    let container = document.getElementById('word-list-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'word-list-container';
        if (dom.wordCardContainer) dom.wordCardContainer.prepend(container);
    }
    dom.wordListContainer = container;
}

function setupEventListeners() {
    if (dom.filterMenuBtn) dom.filterMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dom.filterPanel.classList.toggle('is-visible');
    });
    document.addEventListener('click', (e) => {
        if (dom.filterPanel && dom.filterPanel.classList.contains('is-visible') && !dom.filterMenuBtn.contains(e.target) && !dom.filterPanel.contains(e.target)) {
            dom.filterPanel.classList.remove('is-visible');
        }
    });
    if (dom.studyModeSwitcher) dom.studyModeSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || e.target.classList.contains('active')) return;
        currentStudyMode = e.target.dataset.mode;
        supabase.from('profiles').update({
            last_study_mode: currentStudyMode
        }).eq('id', currentUser.id).then();
        const activeButton = dom.studyModeSwitcher.querySelector(`[data-mode="${currentStudyMode}"]`);
        if (activeButton && !activeButton.classList.contains('active')) {
            const currentActive = dom.studyModeSwitcher.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            activeButton.classList.add('active');
        }
        updatePillPosition();
        renderUI();
    });
    if (dom.sentenceStatusFilterGroup) dom.sentenceStatusFilterGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        sentenceStatusFilter = e.target.dataset.value;
        const currentActive = dom.sentenceStatusFilterGroup.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        e.target.classList.add('active');
        filterAndSortSentences();
        renderUI();
    });
    if (dom.sentenceSortOrderGroup) dom.sentenceSortOrderGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        sentenceSortOrder = e.target.dataset.value;
        const currentActive = dom.sentenceSortOrderGroup.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        e.target.classList.add('active');
        filterAndSortSentences();
        renderUI();
    });
    if (dom.wordStatusFilterGroup) dom.wordStatusFilterGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        wordStatusFilter = e.target.dataset.value;
        const currentActive = dom.wordStatusFilterGroup.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        e.target.classList.add('active');
        renderUI();
    });
    if (dom.wordSortOrderGroup) dom.wordSortOrderGroup.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        wordSortOrder = e.target.dataset.value;
        const currentActive = dom.wordSortOrderGroup.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        e.target.classList.add('active');
        renderUI();
    });
    if (dom.sentenceCard) dom.sentenceCard.addEventListener('click', (e) => {
        if (e.target.closest('.card-actions, .card-footer, .highlight-word')) return;
        const rect = dom.sentenceCard.getBoundingClientRect();
        const direction = e.clientX < (rect.left + rect.width / 2) ? 'prev' : 'next';
        handleCardNavigation(direction);
    });
    if (dom.sentenceSpanishText) dom.sentenceSpanishText.addEventListener('click', (event) => {
        if (event.target.classList.contains('highlight-word')) {
            event.stopPropagation();
            const wordText = event.target.dataset.word;
            const wordObject = allWords.find(w => w.spanish_word === wordText);
            if (wordObject) {
                logStudyEvent(wordObject.id, 'word');
                getAiWordExplanation(wordObject);
            } else {
                showCustomConfirm(`“${wordText}” 不在您的高频词库中。`);
            }
        }
    });
    if (dom.wordListContainer) {
        dom.wordListContainer.addEventListener('click', (e) => {
            const target = e.target;
            const listItem = target.closest('.word-list-item');
            if (!listItem) return;
            const wordId = parseInt(listItem.dataset.wordId, 10);
            const word = allWords.find(w => w.id === wordId);
            if (!word) return;
            supabase.from('profiles').update({
                last_word_id: word.id,
                updated_at: new Date()
            }).eq('id', currentUser.id).then();
            if (target.closest('.mastered-toggle-word')) {
                toggleWordMastered(wordId, target.closest('.mastered-toggle-word'));
            } else if (target.closest('.read-btn')) {
                readText(word.spanish_word, false, target.closest('.read-btn'));
            } else if (target.closest('.slow-read-btn')) {
                readText(word.spanish_word, true, target.closest('.slow-read-btn'));
            } else if (target.closest('.word-text')) {
                logStudyEvent(word.id, 'word');
                getAiWordExplanation(word);
            }
        });
        dom.wordListContainer.addEventListener('scroll', () => {
            if (isLoadingMoreWords) return;
            const { scrollTop, scrollHeight, clientHeight } = dom.wordListContainer;
            if (scrollHeight - scrollTop - clientHeight < 200) {
                isLoadingMoreWords = true;
                const totalRendered = (wordListPage - 1) * WORDS_PER_PAGE;
                if (totalRendered < currentFilteredWords.length) {
                    renderWordList(true);
                }
            }
        });
    }
    if (dom.addSentenceLink) dom.addSentenceLink.addEventListener('click', () => {
        resetAddSentenceModal();
        dom.addSentenceModal.style.display = 'flex';
    });
    if (dom.editSentenceLink) dom.editSentenceLink.addEventListener('click', openEditSentenceModal);
    if (dom.deleteSentenceLink) dom.deleteSentenceLink.addEventListener('click', deleteCurrentSentence);
    if (dom.masteredToggle) dom.masteredToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSentenceMastered();
    });
    // ====================== 语法修正 开始 ======================
    if (dom.sentenceReadBtn) dom.sentenceReadBtn.addEventListener('click', () => readText(currentFilteredSentences[sentenceIndex]?.spanish_text, false, dom.sentenceReadBtn));
    if (dom.sentenceSlowReadBtn) dom.sentenceSlowReadBtn.addEventListener('click', () => readText(currentFilteredSentences[sentenceIndex]?.spanish_text, true, dom.sentenceSlowReadBtn));
    // ====================== 语法修正 结束 ======================
    if (dom.sentenceWordReadBtn) dom.sentenceWordReadBtn.addEventListener('click', readSentenceWordByWord);
    if (dom.sentenceAiExplainBtn) dom.sentenceAiExplainBtn.addEventListener('click', getAiSentenceExplanation);
    if (dom.addSentenceForm) dom.addSentenceForm.addEventListener('submit', handleAddSentence);
    if (dom.addSentenceForm) dom.addSentenceForm.querySelector('#cancel-add-btn').addEventListener('click', () => dom.addSentenceModal.style.display = 'none');
    if (dom.editSentenceForm) dom.editSentenceForm.addEventListener('submit', handleEditSentence);
    if (dom.editSentenceForm) dom.editSentenceForm.querySelector('#cancel-edit-btn').addEventListener('click', () => dom.editSentenceModal.style.display = 'none');
    if (dom.aiExplanationCloseBtn) dom.aiExplanationCloseBtn.addEventListener('click', () => dom.aiExplanationModal.style.display = 'none');
    if (dom.aiWordExplanationCloseBtn) dom.aiWordExplanationCloseBtn.addEventListener('click', () => dom.aiWordExplanationModal.style.display = 'none');
    if (dom.sentenceListCloseBtn) dom.sentenceListCloseBtn.addEventListener('click', () => dom.sentenceListModal.style.display = 'none');
}

async function initializePage() {
    currentUser = await protectPage();
    if (!currentUser) return;

    // 音频修复：添加一个一次性的全局事件监听器来解锁音频上下文
    document.body.addEventListener('pointerdown', unlockAudioContext, {
        once: true
    });

    populateDomObject();

    await initializeHeader(currentUser);
    initializeDropdowns();
    initializeWordListContainer();
    initializeStudySession();
    setupAutoplay();

    const success = await fetchInitialData();
    if (success) {
        let lastSentenceIdToRestore = null;
        const targetSentenceId = sessionStorage.getItem('targetSentenceId');

        if (targetSentenceId) {
            sessionStorage.removeItem('targetSentenceId');
            lastSentenceIdToRestore = parseInt(targetSentenceId, 10);
        } else if (!studySession) {
            const { data: profile } = await supabase.from('profiles').select('last_sentence_id, last_study_mode').eq('id', currentUser.id).single();
            if (profile) {
                if (profile.last_study_mode === 'words') {
                    currentStudyMode = 'words';
                }
                if (profile.last_sentence_id) {
                    lastSentenceIdToRestore = profile.last_sentence_id;
                }
            }
        }

        if (lastSentenceIdToRestore) {
            const lastSentence = allSentences.find(s => s.id === lastSentenceIdToRestore);
            if (lastSentence && lastSentence.mastered && sentenceStatusFilter === 'unmastered') {
                sentenceStatusFilter = 'all';
            }
        }

        if (studySession) {
            sentenceIndex = 0;
        }

        if (dom.studyModeSwitcher) {
            const currentActive = dom.studyModeSwitcher.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            
            const activeButton = dom.studyModeSwitcher.querySelector(`[data-mode="${currentStudyMode}"]`);
            if (activeButton) activeButton.classList.add('active');
        }

        if (dom.sentenceStatusFilterGroup) {
            const currentActive = dom.sentenceStatusFilterGroup.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            
            const newActive = dom.sentenceStatusFilterGroup.querySelector(`[data-value="${sentenceStatusFilter}"]`);
            if (newActive) newActive.classList.add('active');
        }

        filterAndSortSentences();

        if (lastSentenceIdToRestore && !studySession) {
            const restoredIndex = currentFilteredSentences.findIndex(s => s.id === lastSentenceIdToRestore);
            if (restoredIndex !== -1) {
                sentenceIndex = restoredIndex;
            }
        }

        setupEventListeners();
        renderUI();
    }
}

initializePage();